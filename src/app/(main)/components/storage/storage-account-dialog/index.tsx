'use client';

import {
  createStorageAccount,
  deleteStorageAccount,
  listBuckets,
  listStorageAccounts,
  syncBuckets,
  updateBucket,
  updateStorageAccount,
} from '@/app/(main)/components/api';
import { providerLabel } from '@/app/(main)/components/format';
import { StorageAccountBucketList } from '@/app/(main)/components/storage/storage-account-bucket-list';
import {
  type AccountForm,
  StorageAccountFormDialog,
  buildStorageAccountPayload,
} from '@/app/(main)/components/storage/storage-account-form-dialog';
import {
  type BucketForm,
  StorageBucketFormDialog,
  buildStorageBucketPayload,
} from '@/app/(main)/components/storage/storage-bucket-form-dialog';
import type {
  StorageAccount,
  StorageBucket,
} from '@/app/(main)/components/types';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cleanDisplayText } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { StorageAccountList } from './account-list';

function bucketAccountId(bucket: StorageBucket) {
  return bucket.storage_account_id ?? bucket.storageAccountId ?? '';
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return cleanDisplayText(
    error instanceof Error && error.message ? error.message : fallback,
  );
}

export function StorageAccountDialog({
  open,
  onOpenChange,
  createOpen = false,
  onCreateOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StorageAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorageAccount | null>(null);
  const [editingBucket, setEditingBucket] = useState<StorageBucket | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const formOpen = editorOpen || createOpen;

  const accountsQuery = useQuery({
    queryKey: ['onefile', 'storage-accounts'],
    queryFn: listStorageAccounts,
    enabled: open || formOpen,
  });

  const bucketsQuery = useQuery({
    queryKey: ['onefile', 'buckets'],
    queryFn: listBuckets,
    enabled: open || formOpen,
  });

  const accounts = useMemo(
    () => accountsQuery.data || [],
    [accountsQuery.data],
  );
  const buckets = useMemo(() => bucketsQuery.data || [], [bucketsQuery.data]);
  const bucketCountByAccountId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const bucket of buckets) {
      const accountId = String(bucketAccountId(bucket));
      counts.set(accountId, (counts.get(accountId) ?? 0) + 1);
    }

    return counts;
  }, [buckets]);
  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => String(account.id) === selectedAccountId) ||
      null,
    [accounts, selectedAccountId],
  );
  const selectedBuckets = useMemo(
    () =>
      selectedAccount
        ? buckets.filter(
            (bucket) =>
              String(bucketAccountId(bucket)) === String(selectedAccount.id),
          )
        : [],
    [buckets, selectedAccount],
  );

  useEffect(() => {
    if (createOpen) {
      setEditing(null);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!open) return;

    if (!accounts.length) {
      setSelectedAccountId(null);
      return;
    }

    if (
      selectedAccountId &&
      accounts.some((account) => String(account.id) === selectedAccountId)
    ) {
      return;
    }

    setSelectedAccountId(String(accounts[0].id));
  }, [accounts, open, selectedAccountId]);

  const invalidateAccounts = () =>
    queryClient.invalidateQueries({
      queryKey: ['onefile', 'storage-accounts'],
    });

  const invalidateBuckets = () =>
    queryClient.invalidateQueries({ queryKey: ['onefile', 'buckets'] });

  const invalidateStorage = async () => {
    await Promise.all([invalidateAccounts(), invalidateBuckets()]);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: AccountForm) => {
      const wasEditing = Boolean(editing);
      const payload = buildStorageAccountPayload(values, Boolean(editing));
      const account = editing
        ? await updateStorageAccount(editing.id, payload)
        : await createStorageAccount(payload);

      try {
        await syncBuckets(account.id);
      } catch (error) {
        if (!wasEditing) {
          await deleteStorageAccount(account.id).catch(() => undefined);
        }

        throw new Error(
          `bucket 同步失败：${mutationErrorMessage(
            error,
            '请检查 Access key、Secret key、Region 和 Endpoint。',
          )}`,
        );
      }

      return { account, wasEditing };
    },
    onMutate: () => {
      setSaveError(null);
    },
    onSuccess: async ({ account, wasEditing }) => {
      toast.success(wasEditing ? '存储账号已更新' : '存储账号已创建');
      setSelectedAccountId(String(account.id));
      setEditing(null);
      setEditorOpen(false);
      onCreateOpenChange?.(false);
      await invalidateStorage();
    },
    onError: (error) => {
      const message = mutationErrorMessage(error, '保存失败');
      setSaveError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStorageAccount,
    onSuccess: async () => {
      toast.success('存储账号已删除');
      setDeleteTarget(null);
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

  const bucketMutation = useMutation({
    mutationFn: async (values: BucketForm) => {
      if (!editingBucket) {
        throw new Error('请选择 bucket。');
      }

      return updateBucket(editingBucket.id, buildStorageBucketPayload(values));
    },
    onSuccess: async () => {
      toast.success('bucket 已更新');
      setEditingBucket(null);
      await invalidateBuckets();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '保存失败'),
  });

  const openCreateDialog = () => {
    setSaveError(null);
    setEditing(null);
    setEditorOpen(true);
  };

  const openEditDialog = (account: StorageAccount) => {
    setSaveError(null);
    setEditing(account);
    setEditorOpen(true);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialog.Content
          className="sm:max-w-5xl"
          drawerClassName="max-h-[92vh]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ">
            <ResponsiveDialog.Header className="min-w-0 p-0 text-left">
              <ResponsiveDialog.Title>存储账号</ResponsiveDialog.Title>
              <ResponsiveDialog.Description>
                管理对象存储账号，并查看每个账号已同步的 bucket。
              </ResponsiveDialog.Description>
            </ResponsiveDialog.Header>
            <Button className="sm:shrink-0" onClick={openCreateDialog}>
              <Plus data-icon="inline-end" />
              添加
            </Button>
          </div>

          <div className="grid min-h-0 gap-4 md:min-h-[520px] md:grid-cols-[minmax(220px,2fr)_minmax(0,3fr)]">
            <section className="flex min-h-0 flex-col rounded-lg border">
              <div className="border-b p-3">
                <div className="text-sm font-medium">账号</div>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col p-2">
                  <StorageAccountList
                    accounts={accounts}
                    bucketCountByAccountId={bucketCountByAccountId}
                    loading={accountsQuery.isLoading}
                    selectedAccountId={selectedAccountId}
                    syncPending={syncMutation.isPending}
                    onCreate={openCreateDialog}
                    onDelete={setDeleteTarget}
                    onEdit={openEditDialog}
                    onSelect={(account) =>
                      setSelectedAccountId(String(account.id))
                    }
                    onSync={(account) => syncMutation.mutate(account.id)}
                  />
                </div>
              </ScrollArea>
            </section>

            <section className="flex min-h-0 flex-col rounded-lg border">
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">桶</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selectedAccount
                      ? `${selectedAccount.name} · ${providerLabel(selectedAccount.provider)}`
                      : '选择左侧账号'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedAccount || syncMutation.isPending}
                  onClick={() =>
                    selectedAccount && syncMutation.mutate(selectedAccount.id)
                  }
                >
                  {syncMutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  同步
                </Button>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-2 p-3">
                  <StorageAccountBucketList
                    isLoading={bucketsQuery.isLoading}
                    selectedAccount={selectedAccount}
                    selectedBuckets={selectedBuckets}
                    syncPending={syncMutation.isPending}
                    onSyncSelectedAccount={() =>
                      selectedAccount && syncMutation.mutate(selectedAccount.id)
                    }
                    onEditBucket={setEditingBucket}
                  />
                </div>
              </ScrollArea>
            </section>
          </div>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <ResponsiveDialog.Content
          className="sm:max-w-sm"
          drawerClassName="max-h-[92vh]"
        >
          <ResponsiveDialog.Header className="p-0 text-left">
            <ResponsiveDialog.Title>删除存储账号</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              删除 {deleteTarget?.name} 后，该账号下已同步的 bucket 也会移除。
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <ResponsiveDialog.Footer className="p-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              删除
            </Button>
          </ResponsiveDialog.Footer>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>

      <StorageAccountFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && saveMutation.isPending) return;

          setEditorOpen(nextOpen);
          onCreateOpenChange?.(nextOpen);
          if (!nextOpen) {
            setSaveError(null);
            setEditing(null);
          }
        }}
        account={editing}
        pending={saveMutation.isPending}
        errorMessage={saveError}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <StorageBucketFormDialog
        open={Boolean(editingBucket)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingBucket(null);
          }
        }}
        bucket={editingBucket}
        pending={bucketMutation.isPending}
        onSubmit={(values) => bucketMutation.mutate(values)}
      />
    </>
  );
}
