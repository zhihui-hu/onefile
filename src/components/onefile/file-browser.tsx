'use client';

import { deleteFiles, listFiles } from '@/components/onefile/api';
import { FileTable } from '@/components/onefile/file-table';
import {
  buildAddress,
  normalizePrefix,
  parentPrefix,
  parseAddress,
} from '@/components/onefile/path';
import type { FileItem, StorageBucket } from '@/components/onefile/types';
import { UploadPanel } from '@/components/onefile/upload-panel';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Boxes, RefreshCw, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { toast } from 'sonner';

export function FileBrowser({
  bucket,
  prefix,
  onPrefixChange,
  onOpenAccounts,
}: {
  bucket: StorageBucket | null;
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  onOpenAccounts: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSearch('');
  }, [bucket?.id]);

  useEffect(() => {
    setAddress(bucket ? buildAddress(bucket.name, prefix) : '');
  }, [bucket, prefix]);

  const filesQuery = useQuery({
    queryKey: ['onefile', 'files', bucket?.id, prefix, deferredSearch.trim()],
    queryFn: () =>
      listFiles({
        bucketId: bucket!.id,
        prefix,
        search: deferredSearch.trim(),
      }),
    enabled: Boolean(bucket?.id),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (items: FileItem[]) =>
      deleteFiles({
        bucket_id: bucket!.id,
        object_keys: items.map((item) => item.path),
      }),
    onSuccess: async (_data, items) => {
      toast.success(items.length > 1 ? '文件已批量删除' : '对象已删除');
      await queryClient.invalidateQueries({
        queryKey: ['onefile', 'files', bucket?.id],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '删除失败'),
  });

  const refresh = () => {
    void filesQuery.refetch();
  };

  const openFolder = (item: FileItem) => {
    if (item.kind !== 'folder') return;
    onPrefixChange(normalizePrefix(item.path));
  };

  const submitAddress = () => {
    if (!bucket) return;
    onPrefixChange(parseAddress(address, bucket.name));
  };

  if (!bucket) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Boxes />
            </EmptyMedia>
            <EmptyTitle>选择一个 bucket</EmptyTitle>
            <EmptyDescription>
              左侧选择 bucket 后即可浏览真实对象存储目录。
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onOpenAccounts}>
            <Boxes data-icon="inline-start" />
            配置存储账号
          </Button>
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-w-0 items-start gap-2 px-4 py-3 border-b shrink-0">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon align="inline-start">
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              onClick={() => onPrefixChange(parentPrefix(prefix))}
            >
              <ArrowLeft />
              <span className="sr-only">返回上级</span>
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupInput
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => setAddress(buildAddress(bucket.name, prefix))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitAddress();
              }
            }}
            aria-label="当前目录地址"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" variant="ghost" onClick={refresh}>
              <RefreshCw
                className={filesQuery.isFetching ? 'animate-spin' : undefined}
              />
              <span className="sr-only">刷新目录</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex shrink-0 items-start gap-2 ">
          <InputGroup className="w-56 lg:w-72">
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索文件"
            />
          </InputGroup>

          <UploadPanel
            bucket={bucket}
            prefix={prefix}
            onCompleted={refresh}
            className="shrink-0"
          />
        </div>
      </div>

      <FileTable
        bucket={bucket}
        items={filesQuery.data?.items || []}
        loading={filesQuery.isLoading}
        error={
          filesQuery.error instanceof Error ? filesQuery.error.message : null
        }
        deleting={deleteMutation.isPending}
        onOpenFolder={openFolder}
        onDeleteFiles={(items) => deleteMutation.mutate(items)}
      />
    </section>
  );
}
