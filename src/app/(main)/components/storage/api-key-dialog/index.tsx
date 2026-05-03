'use client';

import {
  createFileApiKey,
  deleteFileApiKey,
  listBuckets,
  listFileApiKeys,
  updateFileApiKey,
  updateFileApiKeyLink,
} from '@/app/(main)/components/api';
import type {
  FileApiKey,
  FileApiKeyLinkAction,
} from '@/app/(main)/components/types';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { ApiKeyTable } from './api-key-table';
import { ApiKeyFormFields } from './form-fields';
import {
  type KeyForm,
  createKeyPayload,
  emptyForm,
  formFromKey,
  keyPayload,
} from './utils';

export function ApiKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<KeyForm>(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<FileApiKey | null>(null);
  const [editForm, setEditForm] = useState<KeyForm>(emptyForm);

  const keysQuery = useQuery({
    queryKey: ['onefile', 'api-keys'],
    queryFn: listFileApiKeys,
    enabled: open,
  });

  const bucketsQuery = useQuery({
    queryKey: ['onefile', 'storage-buckets'],
    queryFn: listBuckets,
    enabled: open || createOpen || Boolean(editingKey),
  });

  const invalidateKeys = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['onefile', 'api-keys'] }),
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: () => createFileApiKey(createKeyPayload(form)),
    onSuccess: async () => {
      setForm(emptyForm);
      setCreateOpen(false);
      toast.success('API key 已创建，可在列表复制完整 token');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '创建失败'),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      editingKey
        ? updateFileApiKey(editingKey.id, keyPayload(editForm))
        : Promise.reject(new Error('未选择 API key')),
    onSuccess: async () => {
      setEditingKey(null);
      toast.success('API key 已更新');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '更新失败'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: FileApiKey['id'];
      status: 'active' | 'inactive';
    }) => updateFileApiKey(id, { status }),
    onSuccess: async () => {
      toast.success('API key 状态已更新');
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '更新失败'),
  });

  const linkMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: FileApiKey['id'];
      action: FileApiKeyLinkAction;
    }) => updateFileApiKeyLink(id, { action }),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.action === 'revoke' ? '公开链接已撤销' : '公开链接已更新',
      );
      await invalidateKeys();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '链接操作失败'),
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

  const copyText = useCallback(async (value: string, message: string) => {
    if (!value) {
      toast.error('没有可复制的内容');
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success(message);
  }, []);

  const openCreateDialog = useCallback(() => {
    setForm(emptyForm);
    setCreateOpen(true);
  }, []);

  const openEditDialog = useCallback((apiKey: FileApiKey) => {
    setEditingKey(apiKey);
    setEditForm(formFromKey(apiKey));
  }, []);

  const handleRootOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setCreateOpen(false);
        setEditingKey(null);
      }
    },
    [onOpenChange],
  );

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={handleRootOpenChange}>
        <ResponsiveDialog.Content
          className="sm:max-w-5xl"
          drawerClassName="max-h-[92vh]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <ResponsiveDialog.Header className="min-w-0 p-0 text-left">
              <ResponsiveDialog.Title>API key</ResponsiveDialog.Title>
              <ResponsiveDialog.Description>
                为脚本、外部服务或公开上传链接创建访问密钥。新 key
                可在列表复制完整 token。
              </ResponsiveDialog.Description>
            </ResponsiveDialog.Header>
            <Button className="sm:shrink-0" onClick={openCreateDialog}>
              <Plus data-icon="inline-start" />
              添加
            </Button>
          </div>

          <ApiKeyTable
            apiKeys={keysQuery.data ?? []}
            copyText={copyText}
            deletePending={deleteMutation.isPending}
            isLoading={keysQuery.isLoading}
            linkPending={linkMutation.isPending}
            updateStatusPending={updateStatusMutation.isPending}
            onDelete={deleteMutation.mutate}
            onEdit={openEditDialog}
            onUpdateLink={linkMutation.mutate}
            onUpdateStatus={updateStatusMutation.mutate}
          />
        </ResponsiveDialog.Content>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && createMutation.isPending) return;
          setCreateOpen(nextOpen);
        }}
      >
        <ResponsiveDialog.Content
          className="sm:max-w-md"
          drawerClassName="max-h-[92vh]"
        >
          <ResponsiveDialog.Header className="p-0 text-left">
            <ResponsiveDialog.Title>添加 API key</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              创建用于 API 上传、公开上传或脚本调用的访问密钥。
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <ApiKeyFormFields
              buckets={bucketsQuery.data ?? []}
              form={form}
              setForm={setForm}
            />
            <ResponsiveDialog.Footer className="p-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || !form.name.trim()}
              >
                {createMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                创建 key
              </Button>
            </ResponsiveDialog.Footer>
          </form>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!editingKey}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && editMutation.isPending) return;
          if (!nextOpen) setEditingKey(null);
        }}
      >
        <ResponsiveDialog.Content className="sm:max-w-md">
          <ResponsiveDialog.Header className="p-0 text-left">
            <ResponsiveDialog.Title>编辑 API key</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              调整名称、写入 Bucket 和图片压缩策略。
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              editMutation.mutate();
            }}
          >
            <ApiKeyFormFields
              buckets={bucketsQuery.data ?? []}
              form={editForm}
              setForm={setEditForm}
            />
            <ResponsiveDialog.Footer className="p-2">
              <Button
                type="submit"
                disabled={editMutation.isPending || !editForm.name.trim()}
              >
                {editMutation.isPending && <Spinner data-icon="inline-start" />}
                保存
              </Button>
            </ResponsiveDialog.Footer>
          </form>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>
    </>
  );
}
