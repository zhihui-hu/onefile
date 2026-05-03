'use client';

import {
  DirectoryContextMenuContent,
  FileContextMenuContent,
  FileDropdownMenu,
  NameCell,
  SortHeader,
  publicObjectUrl,
  tableColumnClass,
} from '@/app/(main)/components/files/file-table/parts';
import { FileTableSkeleton } from '@/app/(main)/components/files/file-table/skeleton';
import {
  absoluteDate,
  formatBytes,
  formatDate,
} from '@/app/(main)/components/format';
import type { FileItem, StorageBucket } from '@/app/(main)/components/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { debugLog, debugLogLimited } from '@/lib/debug';
import { cn } from '@/lib/utils';
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, Folder, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

function fileTypeLabel(item: FileItem) {
  return item.kind === 'folder' ? '目录' : '文件';
}

export function FileTable({
  bucket,
  items,
  loading,
  error,
  deleting,
  hasMore = false,
  loadingMore = false,
  selectionResetKey,
  refreshing,
  creatingFolder,
  onLoadMore,
  onRefresh,
  onCreateFolder,
  onOpenFolder,
  onDeleteFiles,
}: {
  bucket: StorageBucket | null;
  items: FileItem[];
  loading: boolean;
  error?: string | null;
  deleting: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  selectionResetKey?: string;
  refreshing?: boolean;
  creatingFolder?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onCreateFolder?: () => void;
  onOpenFolder: (item: FileItem) => void;
  onDeleteFiles: (items: FileItem[]) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);
  const loadMoreRequestedRef = useRef(false);

  useEffect(() => {
    setRowSelection({});
    setBulkDeleteOpen(false);
  }, [selectionResetKey]);

  useEffect(() => {
    if (!loadingMore) {
      loadMoreRequestedRef.current = false;
    }
  }, [loadingMore]);

  const copyLink = useCallback(async (url: string | null) => {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制');
    } catch {
      toast.error('复制失败');
    }
  }, []);

  const openItem = useCallback(
    (item: FileItem, publicUrl: string | null) => {
      if (item.kind === 'folder') {
        onOpenFolder(item);
        return;
      }

      if (publicUrl) {
        window.open(publicUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [onOpenFolder],
  );

  const columns = useMemo<ColumnDef<FileItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="选择全部文件"
            disabled={
              !table.getRowModel().rows.some((row) => row.getCanSelect())
            }
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(value) =>
              table.toggleAllRowsSelected(Boolean(value))
            }
          />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            aria-label={`选择 ${row.original.name || row.original.path}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: '名称',
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <NameCell
              item={item}
              previewUrl={publicObjectUrl(bucket, item)}
              onOpenFolder={onOpenFolder}
            />
          );
        },
      },
      {
        id: 'kind',
        accessorKey: 'kind',
        header: '类型',
        cell: ({ row }) => fileTypeLabel(row.original),
      },
      {
        id: 'size',
        accessorFn: (row) => (row.kind === 'folder' ? -1 : (row.size ?? 0)),
        header: ({ column }) => <SortHeader column={column} label="大小" />,
        cell: ({ row }) =>
          row.original.kind === 'folder' ? '-' : formatBytes(row.original.size),
      },
      {
        id: 'updated_at',
        accessorFn: (row) =>
          row.updated_at ? Date.parse(row.updated_at) || 0 : 0,
        header: ({ column }) => <SortHeader column={column} label="修改日期" />,
        cell: ({ row }) => (
          <span title={absoluteDate(row.original.updated_at)}>
            {formatDate(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          const publicUrl = publicObjectUrl(bucket, item);
          return (
            <FileDropdownMenu
              item={item}
              publicUrl={publicUrl}
              deleting={deleting}
              onOpen={() => openItem(item, publicUrl)}
              onCopy={() => void copyLink(publicUrl)}
              onRequestDelete={() => setDeleteTarget(item)}
            />
          );
        },
      },
    ],
    [bucket, copyLink, deleting, onOpenFolder, openItem],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) => row.original.kind === 'file',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.path,
  });

  const selectedFiles = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
    .filter((item) => item.kind === 'file');
  const visibleColumnCount = table.getVisibleFlatColumns().length;
  const directoryMenuEnabled =
    selectedFiles.length === 0 && Boolean(onRefresh || onCreateFolder);

  debugLogLimited('file-table:render', {
    bucket_id: bucket?.id ?? null,
    items_count: items.length,
    loading,
    loading_more: loadingMore,
    has_more: hasMore,
    selection_reset_key: selectionResetKey,
    selected_count: selectedFiles.length,
    row_count: table.getRowModel().rows.length,
  });

  useEffect(() => {
    debugLog('file-table:load-more-effect', {
      bucket_id: bucket?.id ?? null,
      items_count: items.length,
      loading,
      loading_more: loadingMore,
      has_more: hasMore,
      has_on_load_more: Boolean(onLoadMore),
    });

    if (!hasMore || loading || loadingMore || !onLoadMore) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const root = scrollRootRef.current;

    if (typeof IntersectionObserver === 'undefined') {
      if (!root) return;

      const requestLoadMore = () => {
        if (loadMoreRequestedRef.current) return;
        loadMoreRequestedRef.current = true;
        debugLog('file-table:load-more:fallback-trigger', {
          bucket_id: bucket?.id ?? null,
          items_count: items.length,
        });
        onLoadMore();
      };

      const loadIfNearBottom = () => {
        const remaining =
          root.scrollHeight - root.scrollTop - root.clientHeight;
        if (remaining <= 180) {
          requestLoadMore();
        }
      };

      root.addEventListener('scroll', loadIfNearBottom, { passive: true });
      loadIfNearBottom();

      return () => root.removeEventListener('scroll', loadIfNearBottom);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (loadMoreRequestedRef.current) return;
          loadMoreRequestedRef.current = true;
          debugLog('file-table:load-more:intersection', {
            bucket_id: bucket?.id ?? null,
            items_count: items.length,
            intersection_ratio: entry.intersectionRatio,
            root_bounds: entry.rootBounds
              ? {
                  height: entry.rootBounds.height,
                  width: entry.rootBounds.width,
                }
              : null,
            bounding_rect: {
              height: entry.boundingClientRect.height,
              top: entry.boundingClientRect.top,
            },
          });
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: '180px 0px',
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [bucket?.id, hasMore, items.length, loading, loadingMore, onLoadMore]);

  if (error) {
    return (
      <Alert variant="destructive" className="h-fit">
        <AlertTriangle />
        <AlertTitle>目录读取失败</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <FileTableSkeleton />;
  }

  if (!items.length && !hasMore && !loadingMore) {
    const emptyState = (
      <Empty className="h-full min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Folder />
          </EmptyMedia>
          <EmptyTitle>目录为空</EmptyTitle>
          <EmptyDescription>上传文件后会自动刷新当前目录。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

    if (!directoryMenuEnabled) {
      return emptyState;
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full min-h-72">{emptyState}</div>
        </ContextMenuTrigger>
        <DirectoryContextMenuContent
          refreshing={refreshing}
          creatingFolder={creatingFolder}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
        />
      </ContextMenu>
    );
  }

  return (
    <TooltipProvider>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <table className="min-w-[840px] w-full table-fixed text-xs sm:text-sm shrink-0">
          <thead className="[&_th]:bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'h-8 px-2 py-1 text-left align-middle font-medium text-foreground whitespace-nowrap',
                      tableColumnClass(header.column.id),
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        </table>
        <div
          ref={scrollRootRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <table className="min-w-[840px] w-full shrink-0 table-fixed text-xs sm:text-sm">
            <tbody className="[&_tr:last-child]:border-0">
              {table.getRowModel().rows.map((row) => {
                const item = row.original;
                const publicUrl = publicObjectUrl(bucket, item);

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <tr
                        data-slot="table-row"
                        className={cn(
                          'group h-9 border-b transition-colors hover:bg-muted/35',
                          row.getIsSelected() && 'bg-muted/50',
                        )}
                        onDoubleClick={() => openItem(item, publicUrl)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn(
                              'h-9 px-2 py-1 align-middle whitespace-nowrap',
                              tableColumnClass(cell.column.id),
                              cell.column.id === 'actions' &&
                                'opacity-70 transition-opacity group-hover:opacity-100',
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    </ContextMenuTrigger>
                    <FileContextMenuContent
                      item={item}
                      publicUrl={publicUrl}
                      deleting={deleting}
                      onOpen={() => openItem(item, publicUrl)}
                      onCopy={() => void copyLink(publicUrl)}
                      onRequestDelete={() => setDeleteTarget(item)}
                    />
                  </ContextMenu>
                );
              })}
              {(hasMore || loadingMore) && (
                <tr ref={loadMoreRef} className="h-8">
                  <td
                    colSpan={visibleColumnCount}
                    className="h-8 px-2 py-2 text-center text-muted-foreground"
                  >
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <Spinner />
                        加载中
                      </span>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {directoryMenuEnabled && (
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="min-h-24 flex-1" aria-label="目录空白区域" />
              </ContextMenuTrigger>
              <DirectoryContextMenuContent
                refreshing={refreshing}
                creatingFolder={creatingFolder}
                onRefresh={onRefresh}
                onCreateFolder={onCreateFolder}
              />
            </ContextMenu>
          )}
        </div>
        {selectedFiles.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-background p-2 shadow-lg">
              <span className="px-2 text-sm text-muted-foreground">
                已选择 {selectedFiles.length} 个文件
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRowSelection({})}
              >
                <X data-icon="inline-start" />
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleting}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 data-icon="inline-start" />
                删除
              </Button>
            </div>
          </div>
        )}
      </div>
      <ResponsiveDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
      >
        <ResponsiveDialog.Content
          className="sm:max-w-md"
          drawerClassName="max-h-[92vh]"
        >
          <ResponsiveDialog.Header className="p-0 text-left">
            <ResponsiveDialog.Title>删除对象</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              将直接从当前 bucket 删除 {deleteTarget?.path}。
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <ResponsiveDialog.Footer className="p-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                if (!deleteTarget) return;
                onDeleteFiles([deleteTarget]);
                setDeleteTarget(null);
              }}
            >
              <Trash2 data-icon="inline-start" />
              删除
            </Button>
          </ResponsiveDialog.Footer>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>

      <ResponsiveDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <ResponsiveDialog.Content
          className="sm:max-w-md"
          drawerClassName="max-h-[92vh]"
        >
          <ResponsiveDialog.Header className="p-0 text-left">
            <ResponsiveDialog.Title>批量删除文件</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              将直接从当前 bucket 删除已选择的 {selectedFiles.length} 个文件。
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <ResponsiveDialog.Footer className="p-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setBulkDeleteOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || selectedFiles.length === 0}
              onClick={() => {
                const files = selectedFiles;
                if (!files.length) return;
                onDeleteFiles(files);
                setBulkDeleteOpen(false);
                setRowSelection({});
              }}
            >
              <Trash2 data-icon="inline-start" />
              删除 {selectedFiles.length} 个文件
            </Button>
          </ResponsiveDialog.Footer>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>
    </TooltipProvider>
  );
}
