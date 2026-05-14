'use client';

import {
  DirectoryContextMenuContent,
  FileContextMenuContent,
  publicObjectUrl,
  tableColumnClass,
} from '@/app/(main)/components/files/file-table/parts';
import { FileTableSkeleton } from '@/app/(main)/components/files/file-table/skeleton';
import type { FileItem, StorageBucket } from '@/app/(main)/components/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, Folder } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useFileTableColumns } from './columns';
import { BulkFileDeleteDialog, SingleFileDeleteDialog } from './delete-dialogs';
import { FileSelectionBar } from './selection-bar';
import { useFileTableLoadMore } from './use-load-more';

type FileTableProps = {
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
};

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
}: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { scrollRootRef, loadMoreRef } = useFileTableLoadMore({
    hasMore,
    itemCount: items.length,
    loading,
    loadingMore,
    onLoadMore,
  });

  useEffect(() => {
    setRowSelection({});
    setBulkDeleteOpen(false);
  }, [selectionResetKey]);

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

  const columns = useFileTableColumns({
    bucket,
    deleting,
    onCopyLink: (url) => void copyLink(url),
    onOpenFolder,
    onOpenItem: openItem,
    onRequestDelete: setDeleteTarget,
  });

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
        <FileSelectionBar
          deleting={deleting}
          selectedFiles={selectedFiles}
          onClearSelection={() => setRowSelection({})}
          onOpenBulkDelete={() => setBulkDeleteOpen(true)}
        />
      </div>
      <SingleFileDeleteDialog
        deleteTarget={deleteTarget}
        deleting={deleting}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        onDeleteFiles={onDeleteFiles}
      />
      <BulkFileDeleteDialog
        open={bulkDeleteOpen}
        deleting={deleting}
        selectedFiles={selectedFiles}
        onOpenChange={setBulkDeleteOpen}
        onDeleteFiles={onDeleteFiles}
        setRowSelection={setRowSelection}
      />
    </TooltipProvider>
  );
}
