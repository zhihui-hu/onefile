'use client';

import { ImagePreview } from '@/components/onefile/image-preview';
import type { FileItem, StorageBucket } from '@/components/onefile/types';
import { Button } from '@/components/ui/button';
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type Column } from '@tanstack/react-table';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  ExternalLink,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function publicObjectUrl(bucket: StorageBucket | null, item: FileItem) {
  if (!bucket?.public_base_url || item.kind !== 'file') return null;

  const base = bucket.public_base_url.replace(/\/+$/, '');
  const prefix = bucket.key_prefix?.replace(/^\/+|\/+$/g, '');
  const path = item.path.replace(/^\/+/, '');
  const objectKey = [prefix, path].filter(Boolean).join('/');
  const encodedKey = objectKey
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return encodedKey ? `${base}/${encodedKey}` : base;
}

export function SortHeader({
  column,
  label,
}: {
  column: Column<FileItem, unknown>;
  label: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 px-1 text-xs"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp data-icon="inline-end" />
      ) : sorted === 'desc' ? (
        <ArrowDown data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  );
}

function fileExtension(item: FileItem) {
  const source = item.name || item.path;
  const match = /\.([^.\/]+)$/.exec(source);
  return match?.[1]?.toLowerCase() || '';
}

function isRasterImage(item: FileItem) {
  if (item.kind !== 'file') return false;

  if (item.mime_type?.startsWith('image/')) {
    return item.mime_type !== 'image/svg+xml';
  }

  return ['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'webp'].includes(
    fileExtension(item),
  );
}

function fileIcon(item: FileItem) {
  if (item.kind === 'folder') return <Folder />;

  const mime = item.mime_type || '';
  const ext = fileExtension(item);

  if (isRasterImage(item) || mime === 'image/svg+xml' || ext === 'svg') {
    return <FileImage />;
  }

  if (mime.startsWith('video/')) return <FileVideo />;
  if (mime.startsWith('audio/')) return <FileAudio />;
  if (mime.includes('json') || ['json', 'jsonl', 'map'].includes(ext)) {
    return <FileJson />;
  }
  if (mime.startsWith('text/') || ['csv', 'log', 'md', 'txt'].includes(ext)) {
    return <FileText />;
  }
  if (
    [
      'css',
      'go',
      'html',
      'js',
      'jsx',
      'py',
      'rs',
      'sh',
      'sql',
      'ts',
      'tsx',
      'vue',
      'xml',
      'yaml',
      'yml',
    ].includes(ext)
  ) {
    return <FileCode2 />;
  }
  if (['ods', 'xls', 'xlsm', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet />;
  }
  if (['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'zip'].includes(ext)) {
    return <FileArchive />;
  }
  if (['app', 'dmg', 'exe', 'pkg'].includes(ext)) {
    return <Archive />;
  }

  return <File />;
}

export function NameCell({
  item,
  previewUrl,
  onOpenFolder,
}: {
  item: FileItem;
  previewUrl?: string | null;
  onOpenFolder: (item: FileItem) => void;
}) {
  const label = item.name || item.path;
  const imagePreviewUrl = isRasterImage(item) && previewUrl ? previewUrl : null;
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const node = labelRef.current;
    if (!node) return;

    const updateOverflow = () => {
      setIsOverflowing(node.scrollWidth > node.clientWidth + 1);
    };

    updateOverflow();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateOverflow);
      return () => window.removeEventListener('resize', updateOverflow);
    }

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [label]);

  const content = (
    <span className="flex min-w-0 items-center gap-2">
      {imagePreviewUrl ? (
        <ImagePreview
          src={imagePreviewUrl}
          alt={label}
          title={item.path || label}
          fallback={fileIcon(item)}
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground [&_svg]:size-4">
          {fileIcon(item)}
        </span>
      )}
      <span
        ref={labelRef}
        className="block cursor-pointer underline-hover min-w-0 flex-1 truncate leading-tight"
      >
        {label}
      </span>
    </span>
  );

  const trigger =
    item.kind === 'folder' ? (
      <Button
        type="button"
        variant="ghost"
        className="h-8 max-w-96 justify-start px-1"
        onClick={() => onOpenFolder(item)}
      >
        {content}
      </Button>
    ) : (
      <div className="flex h-8 max-w-96 items-center px-1">{content}</div>
    );

  if (!isOverflowing) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{item.path || label}</TooltipContent>
    </Tooltip>
  );
}

export function FileDropdownMenu({
  item,
  publicUrl,
  deleting,
  onOpen,
  onCopy,
  onRequestDelete,
}: {
  item: FileItem;
  publicUrl: string | null;
  deleting: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="cursor-pointer"
          size="icon-sm"
          variant="ghost"
          disabled={deleting}
        >
          <MoreHorizontal />
          <span className="sr-only">文件操作</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={item.kind === 'file' && !publicUrl}
            onSelect={onOpen}
          >
            <ExternalLink />
            打开
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!publicUrl} onSelect={onCopy}>
            <Copy />
            复制链接
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={item.kind === 'folder' || deleting}
            onSelect={onRequestDelete}
          >
            <Trash2 />
            删除
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FileContextMenuContent({
  item,
  publicUrl,
  deleting,
  onOpen,
  onCopy,
  onRequestDelete,
}: {
  item: FileItem;
  publicUrl: string | null;
  deleting: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <ContextMenuContent className="w-40">
      <ContextMenuGroup>
        <ContextMenuItem
          disabled={item.kind === 'file' && !publicUrl}
          onSelect={onOpen}
        >
          <ExternalLink />
          打开
        </ContextMenuItem>
        <ContextMenuItem disabled={!publicUrl} onSelect={onCopy}>
          <Copy />
          复制链接
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          variant="destructive"
          disabled={item.kind === 'folder' || deleting}
          onSelect={onRequestDelete}
        >
          <Trash2 />
          删除
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}

export function tableColumnClass(id: string) {
  if (id === 'select') return 'w-5 text-center';
  if (id === 'name') return 'w-96';
  if (id === 'kind') return 'w-24';
  if (id === 'size') return 'w-24 text-right';
  if (id === 'updated_at') return 'w-40';
  if (id === 'actions') return 'w-10 text-right';
  return undefined;
}
