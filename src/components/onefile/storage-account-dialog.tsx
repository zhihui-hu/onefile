'use client';

import {
  createStorageAccount,
  deleteStorageAccount,
  listStorageAccounts,
  syncBuckets,
  updateStorageAccount,
} from '@/components/onefile/api';
import { providerLabel } from '@/components/onefile/format';
import type { ProviderId, StorageAccount } from '@/components/onefile/types';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const providers: ProviderId[] = [
  's3',
  'r2',
  'b2',
  'oci',
  'aliyun_oss',
  'tencent_cos',
];

type AccountForm = {
  name: string;
  provider: ProviderId;
  region: string;
  endpoint: string;
  namespace: string;
  compartment_id: string;
  access_key_id: string;
  secret_key: string;
  extra_config: string;
};

const emptyForm: AccountForm = {
  name: '',
  provider: 's3',
  region: '',
  endpoint: '',
  namespace: '',
  compartment_id: '',
  access_key_id: '',
  secret_key: '',
  extra_config: '{}',
};

function statusVariant(status?: string) {
  if (status === 'error') return 'destructive';
  if (status === 'inactive') return 'outline';
  return 'secondary';
}

export function StorageAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StorageAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const accountsQuery = useQuery({
    queryKey: ['onefile', 'storage-accounts'],
    queryFn: listStorageAccounts,
    enabled: open,
  });

  const invalidateStorage = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['onefile', 'storage-accounts'],
      }),
      queryClient.invalidateQueries({ queryKey: ['onefile', 'buckets'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let extraConfig: unknown = {};
      try {
        extraConfig = form.extra_config.trim()
          ? JSON.parse(form.extra_config)
          : {};
      } catch {
        throw new Error('extra_config 必须是合法 JSON。');
      }

      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        region: form.region.trim() || null,
        endpoint: form.endpoint.trim() || null,
        namespace: form.namespace.trim() || null,
        compartment_id: form.compartment_id.trim() || null,
        access_key_id: form.access_key_id.trim(),
        secret_key: form.secret_key.trim() || undefined,
        extra_config: extraConfig,
      };

      if (editing) {
        return updateStorageAccount(editing.id, payload);
      }

      return createStorageAccount(payload);
    },
    onSuccess: async () => {
      toast.success(editing ? '存储账号已更新' : '存储账号已创建');
      setEditing(null);
      setForm(emptyForm);
      await invalidateStorage();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '保存失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStorageAccount,
    onSuccess: async () => {
      toast.success('存储账号已删除');
      await invalidateStorage();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '删除失败'),
  });

  const syncMutation = useMutation({
    mutationFn: syncBuckets,
    onSuccess: async () => {
      toast.success('bucket 同步完成');
      await invalidateStorage();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '同步失败'),
  });

  const selectAccount = (account: StorageAccount) => {
    setEditing(account);
    setForm({
      name: account.name,
      provider: account.provider,
      region: account.region || '',
      endpoint: account.endpoint || '',
      namespace: account.namespace || '',
      compartment_id: account.compartment_id || '',
      access_key_id: account.access_key_id || '',
      secret_key: '',
      extra_config: '{}',
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>存储账号</DialogTitle>
          <DialogDescription>
            配置 S3-compatible、OSS、COS 等对象存储账号，并同步可浏览的 bucket。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="flex max-h-[56vh] flex-col gap-2 overflow-auto rounded-lg border p-2">
            {accountsQuery.isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Spinner />
              </div>
            ) : accountsQuery.data?.length ? (
              accountsQuery.data.map((account) => (
                <div key={account.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {account.name}
                        </span>
                        <Badge variant={statusVariant(account.status)}>
                          {account.status || 'active'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {providerLabel(account.provider)} ·{' '}
                        {account.region || 'global'}
                      </div>
                      {account.last_error && (
                        <div className="mt-1 text-xs text-destructive">
                          {account.last_error}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => selectAccount(account)}
                      >
                        <Check />
                        <span className="sr-only">编辑</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={syncMutation.isPending}
                        onClick={() => syncMutation.mutate(account.id)}
                      >
                        <RefreshCw />
                        <span className="sr-only">同步 bucket</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(account.id)}
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
                还没有存储账号。
              </div>
            )}
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="account-name">名称</FieldLabel>
                <Input
                  id="account-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Provider</FieldLabel>
                <Select
                  value={form.provider}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      provider: value as ProviderId,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {providers.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {providerLabel(provider)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="account-region">Region</FieldLabel>
                <Input
                  id="account-region"
                  value={form.region}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, region: event.target.value }))
                  }
                  placeholder="us-east-1"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="account-endpoint">Endpoint</FieldLabel>
                <Input
                  id="account-endpoint"
                  value={form.endpoint}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      endpoint: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-namespace">Namespace</FieldLabel>
                  <Input
                    id="account-namespace"
                    value={form.namespace}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        namespace: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-compartment">
                    Compartment
                  </FieldLabel>
                  <Input
                    id="account-compartment"
                    value={form.compartment_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        compartment_id: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="account-access-key">Access key</FieldLabel>
                <Input
                  id="account-access-key"
                  value={form.access_key_id}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      access_key_id: event.target.value,
                    }))
                  }
                  required={!editing}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="account-secret-key">Secret key</FieldLabel>
                <Input
                  id="account-secret-key"
                  type="password"
                  value={form.secret_key}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      secret_key: event.target.value,
                    }))
                  }
                  required={!editing}
                />
                {editing && (
                  <FieldDescription>留空表示不更新密钥。</FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="account-extra">Extra config</FieldLabel>
                <Textarea
                  id="account-extra"
                  value={form.extra_config}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      extra_config: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </Field>
            </FieldGroup>

            <Separator />

            <DialogFooter>
              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X data-icon="inline-start" />
                  新建
                </Button>
              )}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {editing ? '保存修改' : '创建账号'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
