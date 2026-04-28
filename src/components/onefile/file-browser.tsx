'use client';

import { deleteFile, listFiles } from '@/components/onefile/api';
import { FileTable } from '@/components/onefile/file-table';
import {
  buildAddress,
  normalizePrefix,
  parentPrefix,
  parseAddress,
  pathSegments,
} from '@/components/onefile/path';
import type { FileItem, StorageBucket } from '@/components/onefile/types';
import { UploadPanel } from '@/components/onefile/upload-panel';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { Separator } from '@/components/ui/separator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Boxes,
  FolderOpen,
  Home,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export function FileBrowser({
  bucket,
  onOpenAccounts,
}: {
  bucket: StorageBucket | null;
  onOpenAccounts: () => void;
}) {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setPrefix('');
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
    mutationFn: (item: FileItem) =>
      deleteFile({
        bucket_id: bucket!.id,
        object_key: item.path,
      }),
    onSuccess: async () => {
      toast.success('对象已删除');
      await queryClient.invalidateQueries({
        queryKey: ['onefile', 'files', bucket?.id],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '删除失败'),
  });

  const crumbs = useMemo(() => pathSegments(prefix), [prefix]);

  const refresh = () => {
    void filesQuery.refetch();
  };

  const openFolder = (item: FileItem) => {
    if (item.kind !== 'folder') return;
    setPrefix(normalizePrefix(item.path));
  };

  const submitAddress = () => {
    if (!bucket) return;
    setPrefix(parseAddress(address, bucket.name));
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
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <InputGroup className="xl:flex-1">
            <InputGroupAddon align="inline-start">
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                onClick={() => setPrefix((current) => parentPrefix(current))}
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
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                onClick={refresh}
              >
                <RefreshCw
                  className={filesQuery.isFetching ? 'animate-spin' : undefined}
                />
                <span className="sr-only">刷新目录</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <InputGroup className="xl:w-72">
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索文件"
            />
          </InputGroup>
        </div>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={() => setPrefix('')}>
                  <Home />
                  {bucket.name}
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((crumb, index) => (
              <BreadcrumbItem key={crumb.prefix}>
                <BreadcrumbSeparator />
                {index === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      onClick={() => setPrefix(crumb.prefix)}
                    >
                      {crumb.label}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <UploadPanel bucket={bucket} prefix={prefix} onCompleted={refresh} />
        <Separator />
        <FileTable
          items={filesQuery.data?.items || []}
          loading={filesQuery.isLoading}
          error={
            filesQuery.error instanceof Error ? filesQuery.error.message : null
          }
          deleting={deleteMutation.isPending}
          onOpenFolder={openFolder}
          onDeleteFile={(item) => deleteMutation.mutate(item)}
        />
      </div>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          <FolderOpen /> {prefix || '/'}
        </span>
        <span>{filesQuery.data?.items.length || 0} items</span>
      </div>
    </section>
  );
}
