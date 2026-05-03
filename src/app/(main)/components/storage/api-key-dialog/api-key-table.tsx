'use client';

import { absoluteDate, formatDate } from '@/app/(main)/components/format';
import type {
  FileApiKey,
  FileApiKeyLinkAction,
} from '@/app/(main)/components/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { OverflowTooltipText } from '@/components/ui/overflow-tooltip-text';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
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
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Copy,
  ExternalLink,
  FileText,
  KeyRound,
  Link2Off,
  MoreHorizontal,
  Pencil,
  QrCode,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';

import { apiDocsUrl, keyToken, publicLink, tokenDisplay } from './utils';

type KeyStatusUpdate = {
  id: FileApiKey['id'];
  status: 'active' | 'inactive';
};

type KeyLinkUpdate = {
  id: FileApiKey['id'];
  action: FileApiKeyLinkAction;
};

type ApiKeyTableProps = {
  apiKeys: FileApiKey[];
  copyText: (value: string, message: string) => void;
  deletePending: boolean;
  isLoading: boolean;
  linkPending: boolean;
  updateStatusPending: boolean;
  onDelete: (id: FileApiKey['id']) => void;
  onEdit: (apiKey: FileApiKey) => void;
  onUpdateLink: (payload: KeyLinkUpdate) => void;
  onUpdateStatus: (payload: KeyStatusUpdate) => void;
};

export function ApiKeyTable({
  apiKeys,
  copyText,
  deletePending,
  isLoading,
  linkPending,
  updateStatusPending,
  onDelete,
  onEdit,
  onUpdateLink,
  onUpdateStatus,
}: ApiKeyTableProps) {
  const [qrTarget, setQrTarget] = useState<{
    name: string;
    url: string;
  } | null>(null);

  const columns = useMemo(() => {
    const helper = createColumnHelper<FileApiKey>();

    return [
      helper.accessor('name', {
        header: '名称',
        cell: ({ row }) => (
          <div className="flex min-w-36 flex-col gap-1">
            <span className="truncate font-medium">{row.original.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.bucket_name || '默认负载均衡'}
            </span>
          </div>
        ),
      }),
      helper.display({
        id: 'token',
        header: 'Key',
        cell: ({ row }) => {
          const token = keyToken(row.original);
          const display = tokenDisplay(row.original);

          return (
            <div className="flex min-w-36 items-center gap-1.5">
              <OverflowTooltipText
                className="max-w-56 font-mono text-xs"
                contentClassName="max-w-sm break-all font-mono"
                tooltip={display}
              >
                {display}
              </OverflowTooltipText>
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={!token}
                onClick={() => copyText(token, '已复制完整 token')}
              >
                <Copy />
                <span className="sr-only">复制完整 token</span>
              </Button>
            </div>
          );
        },
      }),
      helper.accessor('compress_images', {
        header: '压缩状态',
        cell: ({ getValue }) => (
          <Badge variant={getValue() === false ? 'outline' : 'secondary'}>
            {getValue() === false ? '未压缩' : '压缩'}
          </Badge>
        ),
      }),
      helper.accessor('last_used_at', {
        header: '最近使用',
        cell: ({ getValue }) => (
          <span title={absoluteDate(getValue())}>{formatDate(getValue())}</span>
        ),
      }),
      helper.accessor('status', {
        header: '状态',
        cell: ({ row }) => {
          const apiKey = row.original;
          const active = apiKey.status !== 'inactive';

          return (
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                checked={active}
                disabled={updateStatusPending}
                onCheckedChange={(checked) =>
                  onUpdateStatus({
                    id: apiKey.id,
                    status: checked ? 'active' : 'inactive',
                  })
                }
              />
              <span className="text-xs text-muted-foreground">
                {active ? '启用' : '停用'}
              </span>
            </div>
          );
        },
      }),
      helper.display({
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const apiKey = row.original;
          const link = publicLink(apiKey);
          const docsUrl = apiDocsUrl(apiKey);

          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={!link}
                    onClick={() => {
                      window.open(link, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <ExternalLink />
                    <span className="sr-only">打开链接</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>打开链接</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost">
                    <MoreHorizontal />
                    <span className="sr-only">更多操作</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={!link}
                      onSelect={() => copyText(link, '已复制公开上传链接')}
                    >
                      <Copy />
                      复制地址
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!link}
                      onSelect={() =>
                        setQrTarget({ name: apiKey.name, url: link })
                      }
                    >
                      <QrCode />
                      二维码
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        window.open(docsUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <FileText />
                      API 文档
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(apiKey)}>
                      <Pencil />
                      编辑
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={
                        linkPending || updateStatusPending || deletePending
                      }
                      onSelect={() =>
                        onUpdateLink({ id: apiKey.id, action: 'regenerate' })
                      }
                    >
                      <RefreshCw />
                      重新生成 URL
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={
                        linkPending ||
                        updateStatusPending ||
                        deletePending ||
                        !link
                      }
                      onSelect={() =>
                        onUpdateLink({ id: apiKey.id, action: 'revoke' })
                      }
                    >
                      <Link2Off />
                      停用 URL
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={
                        deletePending || updateStatusPending || linkPending
                      }
                      onSelect={() => onDelete(apiKey.id)}
                    >
                      <Trash2 />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ];
  }, [
    copyText,
    deletePending,
    linkPending,
    onDelete,
    onEdit,
    onUpdateLink,
    onUpdateStatus,
    updateStatusPending,
  ]);

  // TanStack Table intentionally returns function-bearing instances.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: apiKeys,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border p-8">
        <Spinner />
      </div>
    );
  }

  if (!apiKeys.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound />
          </EmptyMedia>
          <EmptyTitle>还没有 API key</EmptyTitle>
          <EmptyDescription>
            创建一个 key 后，可以在这里复制 token、打开文档或管理公开上传链接。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="max-h-[58vh] overflow-auto rounded-lg border">
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
      <PublicLinkQrDialog
        name={qrTarget?.name ?? ''}
        url={qrTarget?.url ?? ''}
        open={Boolean(qrTarget)}
        onOpenChange={(open) => {
          if (!open) setQrTarget(null);
        }}
        onCopy={copyText}
      />
    </>
  );
}

function PublicLinkQrDialog({
  name,
  url,
  open,
  onOpenChange,
  onCopy,
}: {
  name: string;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (value: string, message: string) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="sm:max-w-sm"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="p-0 text-left">
          <ResponsiveDialog.Title>公开链接二维码</ResponsiveDialog.Title>
          <ResponsiveDialog.Description className="break-all">
            {name || url}
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg border bg-background p-3">
            {url && (
              <QRCodeSVG
                value={url}
                size={220}
                marginSize={1}
                className="size-56 max-w-full"
              />
            )}
          </div>
          <div className="max-w-full break-all rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {url}
          </div>
        </div>
        <ResponsiveDialog.Footer className="p-2">
          <Button
            variant="outline"
            disabled={!url}
            onClick={() => onCopy(url, '已复制公开上传链接')}
          >
            <Copy data-icon="inline-start" />
            复制地址
          </Button>
          <Button
            disabled={!url}
            onClick={() => {
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink data-icon="inline-start" />
            打开链接
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
