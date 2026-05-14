'use client';

import {
  absoluteDate,
  formatBytes,
  formatDate,
} from '@/app/(main)/components/format';
import type { FileItem } from '@/app/(main)/components/types';
import { Checkbox } from '@/components/ui/checkbox';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import {
  FileDropdownMenu,
  NameCell,
  SortHeader,
  publicObjectUrl,
} from './parts';
import type { FileTableActions } from './types';

function fileTypeLabel(item: FileItem) {
  return item.kind === 'folder' ? '目录' : '文件';
}

export function useFileTableColumns({
  bucket,
  deleting,
  onCopyLink,
  onOpenFolder,
  onOpenItem,
  onRequestDelete,
}: FileTableActions) {
  return useMemo<ColumnDef<FileItem>[]>(
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
              onOpen={() => onOpenItem(item, publicUrl)}
              onCopy={() => onCopyLink(publicUrl)}
              onRequestDelete={() => onRequestDelete(item)}
            />
          );
        },
      },
    ],
    [bucket, deleting, onCopyLink, onOpenFolder, onOpenItem, onRequestDelete],
  );
}
