'use client';

import {
  createFileApiKey,
  deleteFileApiKey,
  listFileApiKeys,
  updateFileApiKey,
} from '@/app/(main)/components/api';
import { absoluteDate, formatDate } from '@/app/(main)/components/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type KeyForm = {
  name: string;
  description: string;
  scopes: string;
  expires_at: string;
};

const emptyForm: KeyForm = {
  name: '',
  description: '',
  scopes: 'files:read,files:write,uploads:write,files:delete',
  expires_at: '',
};

function keyStatusVariant(status?: string) {
  return status === 'inactive' ? 'outline' : 'secondary';
}

function normalizeExpiresAt(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatScopes(scopes: string | string[] | null | undefined) {
  if (Array.isArray(scopes)) {
    return scopes.length > 0 ? scopes.join(',') : 'files:read';
  }
  return scopes || 'files:read';
}

export function ApiKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<KeyForm>(emptyForm);
  const [newKey, setNewKey] = useState('');

  const keysQuery = useQuery({
    queryKey: ['onefile', 'api-keys'],
    queryFn: listFileApiKeys,
    enabled: open,
  });

  const invalidateKeys = () =>
    queryClient.invalidateQueries({ queryKey: ['onefile', 'api-keys'] });

  const createMutation = useMutation({
    mutationFn: () =>
      createFileApiKey({
        name: form.name.trim(),
        description: form.description.trim() || null,
        scopes: form.scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean),
        expires_at: normalizeExpiresAt(form.expires_at),
      }),
    onSuccess: async (key) => {
      setForm(emptyForm);
      setNewKey(key.key || key.plain_key || '');
      toast.success('API key 已创建');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) =>
      updateFileApiKey(id, { status }),
    onSuccess: async () => {
      toast.success('API key 状态已更新');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFileApiKey,
    onSuccess: async () => {
      toast.success('API key 已删除');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '删除失败'),
  });

  const copyKey = async () => {
    await navigator.clipboard.writeText(newKey);
    toast.success('已复制 API key');
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="sm:max-w-2xl"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="p-0 text-left">
          <ResponsiveDialog.Title>API key</ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            为脚本或外部服务创建访问密钥。完整 API key 只在创建后显示一次。
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex max-h-[54vh] flex-col gap-2 overflow-auto rounded-lg border p-2">
            {keysQuery.isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Spinner />
              </div>
            ) : keysQuery.data?.length ? (
              keysQuery.data.map((apiKey) => (
                <div key={apiKey.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {apiKey.name}
                        </span>
                        <Badge variant={keyStatusVariant(apiKey.status)}>
                          {apiKey.status || 'active'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {apiKey.key_prefix || 'of_****'} ·{' '}
                        {formatScopes(apiKey.scopes)}
                      </div>
                      <div
                        className="mt-1 text-xs text-muted-foreground"
                        title={absoluteDate(apiKey.last_used_at)}
                      >
                        最近使用：{formatDate(apiKey.last_used_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: apiKey.id,
                            status:
                              apiKey.status === 'inactive'
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
                        onClick={() => deleteMutation.mutate(apiKey.id)}
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
                还没有 API key。
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
                <FieldLabel htmlFor="key-name">名称</FieldLabel>
                <Input
                  id="key-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="key-description">说明</FieldLabel>
                <Textarea
                  id="key-description"
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
                <FieldLabel htmlFor="key-scopes">Scopes</FieldLabel>
                <Input
                  id="key-scopes"
                  value={form.scopes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, scopes: event.target.value }))
                  }
                />
                <FieldDescription>
                  用逗号分隔，例如 files:read,files:write,uploads:write。
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="key-expires">过期时间</FieldLabel>
                <Input
                  id="key-expires"
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

            {newKey && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <KeyRound />新 API key
                </div>
                <div className="break-all rounded-md bg-muted p-2 text-xs">
                  {newKey}
                </div>
                <Button
                  type="button"
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={copyKey}
                >
                  <Copy data-icon="inline-start" />
                  复制
                </Button>
              </div>
            )}

            <Separator />

            <ResponsiveDialog.Footer className="p-0">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                创建 key
              </Button>
            </ResponsiveDialog.Footer>
          </form>
        </div>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
