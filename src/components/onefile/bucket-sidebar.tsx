'use client';

import { providerLabel } from '@/components/onefile/format';
import type { StorageAccount, StorageBucket } from '@/components/onefile/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Boxes, RefreshCw, Search, Settings, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

function accountId(bucket: StorageBucket) {
  return bucket.storage_account_id ?? bucket.storageAccountId ?? '';
}

function isDefault(bucket: StorageBucket) {
  return bucket.is_default === true || bucket.is_default === 1;
}

export function BucketSidebar({
  accounts,
  buckets,
  selectedBucket,
  loading,
  refreshing,
  onSelectBucket,
  onRefresh,
  onOpenAccounts,
  onSetDefault,
}: {
  accounts: StorageAccount[];
  buckets: StorageBucket[];
  selectedBucket: StorageBucket | null;
  loading: boolean;
  refreshing: boolean;
  onSelectBucket: (bucket: StorageBucket) => void;
  onRefresh: () => void;
  onOpenAccounts: () => void;
  onSetDefault: (bucket: StorageBucket) => void;
}) {
  const [search, setSearch] = useState('');

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [String(account.id), account])),
    [accounts],
  );

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = buckets.filter((bucket) => {
      const account = accountMap.get(String(accountId(bucket)));
      const tokens = [
        bucket.name,
        bucket.provider,
        bucket.provider_name,
        bucket.account_name,
        account?.name,
        account?.provider,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || tokens.includes(query);
    });

    return filtered.reduce<
      Array<{
        key: string;
        label: string;
        provider: string;
        buckets: StorageBucket[];
      }>
    >((all, bucket) => {
      const account = accountMap.get(String(accountId(bucket)));
      const provider = bucket.provider || account?.provider || 'storage';
      const label =
        bucket.account_name || account?.name || providerLabel(provider);
      const key = `${provider}:${label}`;
      const group = all.find((item) => item.key === key);

      if (group) {
        group.buckets.push(bucket);
      } else {
        all.push({ key, label, provider, buckets: [bucket] });
      }

      return all;
    }, []);
  }, [accountMap, buckets, search]);

  return (
    <aside className="flex min-h-0 flex-col border-r bg-muted/20 md:w-72">
      <div className="flex items-center gap-2 border-b p-3">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索 bucket"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              onClick={onRefresh}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
              <span className="sr-only">刷新 bucket</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button size="icon-sm" variant="outline" onClick={onOpenAccounts}>
          <Settings />
          <span className="sr-only">存储账号</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-full" />
              </div>
            ))
          ) : groups.length ? (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                  <span className="truncate">{group.label}</span>
                  <Badge variant="outline">
                    {providerLabel(group.provider)}
                  </Badge>
                </div>
                {group.buckets.map((bucket) => {
                  const selected =
                    String(selectedBucket?.id) === String(bucket.id);
                  return (
                    <div key={bucket.id} className="flex gap-1">
                      <Button
                        variant={selected ? 'secondary' : 'ghost'}
                        className="min-w-0 flex-1 justify-start"
                        onClick={() => onSelectBucket(bucket)}
                      >
                        <Boxes data-icon="inline-start" />
                        <span className="truncate">{bucket.name}</span>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant={isDefault(bucket) ? 'secondary' : 'ghost'}
                        onClick={() => onSetDefault(bucket)}
                      >
                        <Star />
                        <span className="sr-only">设为默认 bucket</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Boxes />
                </EmptyMedia>
                <EmptyTitle>没有 bucket</EmptyTitle>
                <EmptyDescription>配置存储账号后同步 bucket。</EmptyDescription>
              </EmptyHeader>
              <Button size="sm" onClick={onOpenAccounts}>
                <Settings data-icon="inline-start" />
                配置存储
              </Button>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
