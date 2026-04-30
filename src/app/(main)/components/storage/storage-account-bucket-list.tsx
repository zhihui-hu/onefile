'use client';

import type {
  StorageAccount,
  StorageBucket,
} from '@/app/(main)/components/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Database, Pencil, RefreshCw, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { bucketPublicBaseUrl } from './bucket-url';

function isDefaultBucket(bucket: StorageBucket) {
  return bucket.is_default === true || bucket.is_default === 1;
}

function useIsOverflowing<T extends HTMLElement>(value: string) {
  const ref = useRef<T>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const checkOverflow = () => {
      setIsOverflowing(node.scrollWidth > node.clientWidth);
    };

    checkOverflow();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkOverflow);
      return () => window.removeEventListener('resize', checkOverflow);
    }

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return [ref, isOverflowing] as const;
}

function OverflowText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [ref, isOverflowing] = useIsOverflowing<HTMLSpanElement>(children);
  const trigger = (
    <span
      ref={ref}
      className={cn('block min-w-0 truncate cursor-pointer', className)}
    >
      {children}
    </span>
  );

  if (!isOverflowing) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent className="break-all">{children}</TooltipContent>
    </Tooltip>
  );
}

function OverflowLink({ href }: { href: string }) {
  const [ref, isOverflowing] = useIsOverflowing<HTMLAnchorElement>(href);
  const trigger = (
    <a
      ref={ref}
      className="block truncate text-muted-foreground underline-offset-4 hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {href}
    </a>
  );

  if (!isOverflowing) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent className="break-all">{href}</TooltipContent>
    </Tooltip>
  );
}

function bucketColumnClass(columnId: string) {
  if (columnId === 'name') return 'w-[30%]';
  if (columnId === 'region') return 'w-[20%]';
  if (columnId === 'url') return 'w-[34%]';
  return 'w-[16%]';
}

export function StorageAccountBucketList({
  isLoading,
  selectedAccount,
  selectedBuckets,
  syncPending,
  onSyncSelectedAccount,
  onEditBucket,
}: {
  isLoading: boolean;
  selectedAccount: StorageAccount | null;
  selectedBuckets: StorageBucket[];
  syncPending: boolean;
  onSyncSelectedAccount: () => void;
  onEditBucket: (bucket: StorageBucket) => void;
}) {
  const columns = useMemo<ColumnDef<StorageBucket>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: '名称',
        cell: ({ row }) => {
          const bucket = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Database className="size-4 shrink-0 text-muted-foreground" />
              <OverflowText>{bucket.name}</OverflowText>
              {isDefaultBucket(bucket) && (
                <Badge variant="secondary" className="shrink-0">
                  <Star data-icon="inline-start" />
                  默认
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'region',
        accessorFn: (bucket) =>
          bucket.region || selectedAccount?.region || 'global',
        header: '区域',
        cell: ({ getValue }) => (
          <OverflowText>{String(getValue())}</OverflowText>
        ),
      },
      {
        id: 'url',
        accessorFn: (bucket) => bucketPublicBaseUrl(bucket) || '',
        header: 'URL',
        cell: ({ getValue }) => {
          const url = String(getValue());
          return url ? (
            <OverflowLink href={url} />
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
      {
        id: 'actions',
        header: '操作',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onEditBucket(row.original)}
            >
              <Pencil />
              <span className="sr-only">编辑 bucket</span>
            </Button>
          </div>
        ),
      },
    ],
    [onEditBucket, selectedAccount?.region],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: selectedBuckets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database />
          </EmptyMedia>
          <EmptyTitle>选择账号</EmptyTitle>
          <EmptyDescription>
            左侧选择账号后查看已同步的 bucket。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!selectedBuckets.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database />
          </EmptyMedia>
          <EmptyTitle>还没有 bucket</EmptyTitle>
          <EmptyDescription>
            同步当前账号后会显示可浏览 bucket。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            size="sm"
            disabled={syncPending}
            onClick={onSyncSelectedAccount}
          >
            {syncPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            同步 bucket
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <TooltipProvider>
      <Table className="table-fixed">
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col key={column.id} className={bucketColumnClass(column.id)} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(header.column.id === 'actions' && 'text-right')}
                >
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
                <TableCell
                  key={cell.id}
                  className={cn(
                    cell.column.id !== 'actions' && 'min-w-0',
                    cell.column.id === 'actions' && 'text-right',
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
