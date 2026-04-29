'use client';

import {
  FileContextMenuContent,
  FileDropdownMenu,
  NameCell,
  SortHeader,
  publicObjectUrl,
  tableColumnClass,
} from '@/components/onefile/file-table-parts';
import {
  absoluteDate,
  formatBytes,
  formatDate,
} from '@/components/onefile/format';
import type { FileItem, StorageBucket } from '@/components/onefile/types';
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
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

function FileTableSkeleton() {
  const colClasses = [
    'w-10 text-center',
    'w-96',
    'w-24',
    'w-24 text-right',
    'w-40',
    'w-10',
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <table className="min-w-[840px] w-full table-fixed text-xs shrink-0">
        <thead className="[&_th]:bg-background">
          <tr className="border-b">
            {(['', '名称', '类型', '大小', '修改日期', ''] as const).map(
              (label, i) => (
                <th
                  key={i}
                  className={cn(
                    'h-8 border-b px-2 py-1 text-left align-middle font-medium text-foreground',
                    colClasses[i],
                  )}
                >
                  {label ? <Skeleton className="h-3 w-14" /> : null}
                </th>
              ),
            )}
          </tr>
        </thead>
      </table>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="min-w-[840px] w-full table-fixed text-xs">
          <tbody>
            {Array.from({ length: 12 }).map((_, index) => (
              <tr key={index} className="border-b last:border-0">
                <td className={cn('h-9 px-2 py-1 align-middle', colClasses[0])}>
                  <Skeleton className="mx-auto size-4 rounded-sm" />
                </td>
                <td className={cn('h-9 px-2 py-1 align-middle', colClasses[1])}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-7" />
                    <Skeleton className="h-4 w-52 max-w-[60vw]" />
                  </div>
                </td>
                <td className={cn('h-9 px-2 py-1 align-middle', colClasses[2])}>
                  <Skeleton className="h-4 w-10" />
                </td>
                <td
                  className={cn(
                    'h-9 px-2 py-1 align-middle text-right',
                    colClasses[3],
                  )}
                >
                  <Skeleton className="ml-auto h-4 w-14" />
                </td>
                <td className={cn('h-9 px-2 py-1 align-middle', colClasses[4])}>
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className={cn('h-9 px-2 py-1 align-middle', colClasses[5])}>
                  <Skeleton className="ml-auto size-7 rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fileTypeLabel(item: FileItem) {
  return item.kind === 'folder' ? '目录' : '文件';
}

export function FileTable({
  bucket,
  items,
  loading,
  error,
  deleting,
  onOpenFolder,
  onDeleteFiles,
}: {
  bucket: StorageBucket | null;
  items: FileItem[];
  loading: boolean;
  error?: string | null;
  deleting: boolean;
  onOpenFolder: (item: FileItem) => void;
  onDeleteFiles: (items: FileItem[]) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    setRowSelection({});
    setBulkDeleteOpen(false);
  }, [items]);

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

  if (!items.length) {
    return (
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="min-w-[840px] w-full table-fixed text-xs sm:text-sm">
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
            </tbody>
          </table>
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
