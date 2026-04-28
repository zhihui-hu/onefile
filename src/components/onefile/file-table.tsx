'use client';

import {
  absoluteDate,
  formatBytes,
  formatDate,
} from '@/components/onefile/format';
import type { FileItem } from '@/components/onefile/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, File, Folder, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

export function FileTable({
  items,
  loading,
  error,
  deleting,
  onOpenFolder,
  onDeleteFile,
}: {
  items: FileItem[];
  loading: boolean;
  error?: string | null;
  deleting: boolean;
  onOpenFolder: (item: FileItem) => void;
  onDeleteFile: (item: FileItem) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<FileItem>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: '名称',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <Button
              variant="ghost"
              className="max-w-full justify-start px-1"
              disabled={item.kind !== 'folder'}
              onClick={() => onOpenFolder(item)}
            >
              {item.kind === 'folder' ? (
                <Folder data-icon="inline-start" />
              ) : (
                <File data-icon="inline-start" />
              )}
              <span className="truncate">{item.name || item.path}</span>
            </Button>
          );
        },
      },
      {
        id: 'kind',
        accessorKey: 'kind',
        header: '类型',
        cell: ({ row }) => (
          <Badge
            variant={row.original.kind === 'folder' ? 'secondary' : 'outline'}
          >
            {row.original.kind === 'folder' ? '目录' : '文件'}
          </Badge>
        ),
      },
      {
        id: 'size',
        accessorKey: 'size',
        header: '大小',
        cell: ({ row }) =>
          row.original.kind === 'folder' ? '-' : formatBytes(row.original.size),
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: '更新时间',
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
          if (item.kind === 'folder') {
            return (
              <Button size="icon-sm" variant="ghost" disabled>
                <Trash2 />
                <span className="sr-only">目录前缀不可删除</span>
              </Button>
            );
          }

          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  disabled={deleting}
                >
                  <Trash2 />
                  <span className="sr-only">删除文件</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <AlertTriangle />
                  </AlertDialogMedia>
                  <AlertDialogTitle>删除对象</AlertDialogTitle>
                  <AlertDialogDescription>
                    将直接从当前 bucket 删除 {item.path}，不会依赖本地文件表。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDeleteFile(item)}
                  >
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
      },
    ],
    [deleting, onDeleteFile, onOpenFolder],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.path,
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>目录读取失败</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Empty className="min-h-72 border">
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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
