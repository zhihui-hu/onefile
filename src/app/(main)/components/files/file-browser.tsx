'use client';

import {
  createFolder,
  deleteFiles,
  listFiles,
} from '@/app/(main)/components/api';
import { FileTable } from '@/app/(main)/components/files/file-table';
import {
  buildAddress,
  normalizePrefix,
  parentPrefix,
  parseAddress,
} from '@/app/(main)/components/path';
import type { FileItem, StorageBucket } from '@/app/(main)/components/types';
import { UploadPanel } from '@/app/(main)/components/upload/upload-panel';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { debugLog, debugLogLimited } from '@/lib/debug';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  Database,
  FolderPlus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';

const FILE_PAGE_SIZE = 50;

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
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSearch('');
  }, [bucket?.id]);

  useEffect(() => {
    setAddress(bucket ? buildAddress(bucket.name, prefix) : '');
  }, [bucket, prefix]);

  const filesQuery = useInfiniteQuery({
    queryKey: ['onefile', 'files', bucket?.id, prefix, deferredSearch.trim()],
    queryFn: ({ pageParam }) =>
      listFiles({
        bucketId: bucket!.id,
        prefix,
        search: deferredSearch.trim(),
        cursor: pageParam,
        limit: FILE_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page?.next_cursor ?? undefined,
    enabled: Boolean(bucket?.id),
    retry: false,
  });

  const items = useMemo(
    () => filesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [filesQuery.data?.pages],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = filesQuery;

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    debugLog('file-browser:load-more', {
      bucket_id: bucket?.id ?? null,
      prefix,
      search: deferredSearch.trim(),
      page_count: filesQuery.data?.pages.length ?? 0,
    });
    void fetchNextPage();
  }, [
    bucket?.id,
    deferredSearch,
    fetchNextPage,
    filesQuery.data?.pages.length,
    hasNextPage,
    isFetchingNextPage,
    prefix,
  ]);

  debugLogLimited('file-browser:render', {
    bucket_id: bucket?.id ?? null,
    prefix,
    search,
    deferred_search: deferredSearch,
    status: filesQuery.status,
    fetch_status: filesQuery.fetchStatus,
    is_fetching: filesQuery.isFetching,
    is_loading: filesQuery.isLoading,
    is_fetching_next_page: filesQuery.isFetchingNextPage,
    page_count: filesQuery.data?.pages.length ?? 0,
    items_count: items.length,
    has_next_page: filesQuery.hasNextPage,
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

  const createFolderMutation = useMutation({
    mutationFn: () =>
      createFolder({
        bucket_id: bucket!.id,
        prefix,
        name: folderName.trim(),
      }),
    onSuccess: async () => {
      toast.success('文件夹已创建');
      setCreateFolderOpen(false);
      setFolderName('');
      await queryClient.invalidateQueries({
        queryKey: ['onefile', 'files', bucket?.id],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '创建文件夹失败'),
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

  const submitCreateFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!folderName.trim() || createFolderMutation.isPending) return;
    createFolderMutation.mutate();
  };

  if (!bucket) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>选择一个 bucket</EmptyTitle>
            <EmptyDescription>
              左侧选择 bucket 后即可浏览真实对象存储目录。
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onOpenAccounts} className="cursor-pointer">
            <Database data-icon="inline-start" />
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
              className="cursor-pointer"
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
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              onClick={refresh}
              className="cursor-pointer"
            >
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
        items={items}
        loading={filesQuery.isLoading}
        error={
          filesQuery.error instanceof Error ? filesQuery.error.message : null
        }
        deleting={deleteMutation.isPending}
        hasMore={filesQuery.hasNextPage}
        loadingMore={filesQuery.isFetchingNextPage}
        selectionResetKey={[bucket.id, prefix, deferredSearch.trim()].join('|')}
        refreshing={filesQuery.isFetching}
        creatingFolder={createFolderMutation.isPending}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onCreateFolder={() => {
          setFolderName('');
          setCreateFolderOpen(true);
        }}
        onOpenFolder={openFolder}
        onDeleteFiles={(items) => deleteMutation.mutate(items)}
      />

      <ResponsiveDialog
        open={createFolderOpen}
        onOpenChange={(nextOpen) => {
          if (createFolderMutation.isPending) return;
          setCreateFolderOpen(nextOpen);
          if (!nextOpen) {
            setFolderName('');
          }
        }}
      >
        <ResponsiveDialog.Content
          className="sm:max-w-md"
          drawerClassName="max-h-[92vh]"
        >
          <form className="flex flex-col gap-4" onSubmit={submitCreateFolder}>
            <ResponsiveDialog.Header className="p-0 text-left">
              <ResponsiveDialog.Title>新增文件夹</ResponsiveDialog.Title>
              <ResponsiveDialog.Description>
                在当前目录创建一个文件夹。
              </ResponsiveDialog.Description>
            </ResponsiveDialog.Header>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="folder-name">文件夹名称</FieldLabel>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  autoFocus
                  maxLength={255}
                  placeholder="新建文件夹"
                />
              </Field>
            </FieldGroup>
            <ResponsiveDialog.Footer className="p-2">
              <Button
                type="submit"
                disabled={!folderName.trim() || createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FolderPlus data-icon="inline-start" />
                )}
                创建
              </Button>
            </ResponsiveDialog.Footer>
          </form>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>
    </section>
  );
}
