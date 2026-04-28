'use client';

import {
  createFileApiToken,
  deleteFileApiToken,
  listFileApiTokens,
  updateFileApiToken,
} from '@/components/onefile/api';
import { absoluteDate, formatDate } from '@/components/onefile/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type TokenForm = {
  name: string;
  description: string;
  scopes: string;
  expires_at: string;
};

const emptyForm: TokenForm = {
  name: '',
  description: '',
  scopes: 'files:read,files:write,files:delete',
  expires_at: '',
};

function tokenStatusVariant(status?: string) {
  return status === 'inactive' ? 'outline' : 'secondary';
}

export function ApiTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TokenForm>(emptyForm);
  const [newToken, setNewToken] = useState('');

  const tokensQuery = useQuery({
    queryKey: ['onefile', 'api-tokens'],
    queryFn: listFileApiTokens,
    enabled: open,
  });

  const invalidateTokens = () =>
    queryClient.invalidateQueries({ queryKey: ['onefile', 'api-tokens'] });

  const createMutation = useMutation({
    mutationFn: () =>
      createFileApiToken({
        name: form.name.trim(),
        description: form.description.trim() || null,
        scopes: form.scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
          .join(','),
        expires_at: form.expires_at || null,
      }),
    onSuccess: async (token) => {
      setForm(emptyForm);
      setNewToken(token.token || token.plain_token || '');
      toast.success('API token 已创建');
      await invalidateTokens();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) =>
      updateFileApiToken(id, { status }),
    onSuccess: async () => {
      toast.success('Token 状态已更新');
      await invalidateTokens();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFileApiToken,
    onSuccess: async () => {
      toast.success('Token 已删除');
      await invalidateTokens();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '删除失败'),
  });

  const copyToken = async () => {
    await navigator.clipboard.writeText(newToken);
    toast.success('已复制 token');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>API token</DialogTitle>
          <DialogDescription>
            为脚本或外部服务创建访问令牌。完整 token 只在创建后显示一次。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex max-h-[54vh] flex-col gap-2 overflow-auto rounded-lg border p-2">
            {tokensQuery.isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Spinner />
              </div>
            ) : tokensQuery.data?.length ? (
              tokensQuery.data.map((token) => (
                <div key={token.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {token.name}
                        </span>
                        <Badge variant={tokenStatusVariant(token.status)}>
                          {token.status || 'active'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {token.token_prefix || 'of_****'} ·{' '}
                        {token.scopes || 'files:read'}
                      </div>
                      <div
                        className="mt-1 text-xs text-muted-foreground"
                        title={absoluteDate(token.last_used_at)}
                      >
                        最近使用：{formatDate(token.last_used_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: token.id,
                            status:
                              token.status === 'inactive'
                                ? 'active'
                                : 'inactive',
                          })
                        }
                      >
                        <Power />
                        <span className="sr-only">切换状态</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(token.id)}
                      >
                        <Trash2 />
                        <span className="sr-only">删除</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                还没有 API token。
              </div>
            )}
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token-name">名称</FieldLabel>
                <Input
                  id="token-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="token-description">说明</FieldLabel>
                <Textarea
                  id="token-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="token-scopes">Scopes</FieldLabel>
                <Input
                  id="token-scopes"
                  value={form.scopes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, scopes: event.target.value }))
                  }
                />
                <FieldDescription>
                  用逗号分隔，例如 files:read,files:write。
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="token-expires">过期时间</FieldLabel>
                <Input
                  id="token-expires"
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      expires_at: event.target.value,
                    }))
                  }
                />
              </Field>
            </FieldGroup>

            {newToken && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <KeyRound />新 token
                </div>
                <div className="break-all rounded-md bg-muted p-2 text-xs">
                  {newToken}
                </div>
                <Button
                  type="button"
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={copyToken}
                >
                  <Copy data-icon="inline-start" />
                  复制
                </Button>
              </div>
            )}

            <Separator />

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                创建 token
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
