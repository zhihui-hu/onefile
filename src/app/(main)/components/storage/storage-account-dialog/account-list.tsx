import { providerIconUrl } from '@/app/(main)/components/storage/storage-account-form-dialog';
import type { StorageAccount } from '@/app/(main)/components/types';
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
  Database,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';

export function StorageAccountList({
  accounts,
  bucketCountByAccountId,
  loading,
  selectedAccountId,
  syncPending,
  onCreate,
  onDelete,
  onEdit,
  onSelect,
  onSync,
}: {
  accounts: StorageAccount[];
  bucketCountByAccountId: Map<string, number>;
  loading: boolean;
  selectedAccountId: string | null;
  syncPending: boolean;
  onCreate: () => void;
  onDelete: (account: StorageAccount) => void;
  onEdit: (account: StorageAccount) => void;
  onSelect: (account: StorageAccount) => void;
  onSync: (account: StorageAccount) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database />
          </EmptyMedia>
          <EmptyTitle>还没有存储账号</EmptyTitle>
          <EmptyDescription>添加账号后可以同步 bucket。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={onCreate}>
            <Plus data-icon="inline-start" />
            添加账号
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return accounts.map((account) => {
    const selected = String(account.id) === selectedAccountId;
    const bucketCount = bucketCountByAccountId.get(String(account.id)) ?? 0;
    return (
      <div
        key={account.id}
        className={cn(
          'flex items-center gap-1 rounded-lg cursor-pointer',
          selected && 'bg-muted',
        )}
      >
        <Button
          variant="ghost"
          className="h-9 min-w-0  flex-1 justify-start gap-3 px-2"
          onClick={() => onSelect(account)}
        >
          <Image
            alt=""
            width={28}
            height={28}
            className="size-5 shrink-0 "
            src={providerIconUrl(account.provider)}
            unoptimized
          />
          <span className="flex min-w-0 text-sm font-medium">
            <span className="min-w-0 truncate">{account.name}</span>
            <span className="shrink-0">（{bucketCount}）</span>
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost">
              <MoreHorizontal />
              <span className="sr-only">账号操作</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onEdit(account)}>
                <Pencil />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={syncPending}
                onSelect={() => onSync(account)}
              >
                <RefreshCw />
                同步桶
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(account)}
              >
                <Trash2 />
                删除
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  });
}
