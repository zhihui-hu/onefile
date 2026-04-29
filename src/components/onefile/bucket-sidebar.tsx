'use client';

import { providerLabel } from '@/components/onefile/format';
import { providerIconUrl } from '@/components/onefile/storage-account-form-dialog';
import type {
  ProviderId,
  StorageAccount,
  StorageBucket,
} from '@/components/onefile/types';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IMAGE_BLUR_DATA_URL } from '@/lib/image';
import { cn } from '@/lib/utils';
import { Database, Plus, RefreshCw, Search, Star } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';

function accountId(bucket: StorageBucket) {
  return bucket.storage_account_id ?? bucket.storageAccountId ?? '';
}

function isDefault(bucket: StorageBucket) {
  return bucket.is_default === true || bucket.is_default === 1;
}

const providerIds = [
  's3',
  'r2',
  'b2',
  'oci',
  'aliyun_oss',
  'tencent_cos',
] as const satisfies readonly ProviderId[];

function isProviderId(value: string): value is ProviderId {
  return (providerIds as readonly string[]).includes(value);
}

export function BucketSidebar({
  accounts,
  buckets,
  selectedBucket,
  loading,
  refreshing,
  defaultBucketPendingId,
  onSelectBucket,
  onRefresh,
  onCreateAccount,
  onSetDefault,
}: {
  accounts: StorageAccount[];
  buckets: StorageBucket[];
  selectedBucket: StorageBucket | null;
  loading: boolean;
  refreshing: boolean;
  defaultBucketPendingId?: string | null;
  onSelectBucket: (bucket: StorageBucket) => void;
  onRefresh: () => void;
  onCreateAccount: () => void;
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
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-muted/20">
      <div className="flex items-center gap-1.5 border-b p-2">
        <InputGroup className="h-7">
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="outline"
                onClick={onCreateAccount}
              >
                <Plus />
                <span className="sr-only">新增账号</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>新增账号</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col gap-1.5 rounded-lg border p-2"
              >
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))
          ) : groups.length ? (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-0.5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {isProviderId(group.provider) ? (
                      <Image
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 shrink-0 rounded-sm"
                        src={providerIconUrl(group.provider, 16)}
                        placeholder="blur"
                        blurDataURL={IMAGE_BLUR_DATA_URL}
                        unoptimized
                      />
                    ) : (
                      <Database className="shrink-0" />
                    )}
                    <span className="truncate">
                      {providerLabel(group.provider)}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-right">
                    {group.label}
                  </span>
                </div>
                {group.buckets.map((bucket) => {
                  const selected =
                    String(selectedBucket?.id) === String(bucket.id);
                  const defaultBucket = isDefault(bucket);
                  const settingDefault =
                    defaultBucketPendingId === String(bucket.id);
                  return (
                    <div
                      key={bucket.id}
                      className="group/bucket grid min-w-0 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-0.5"
                    >
                      <Button
                        variant={selected ? 'secondary' : 'ghost'}
                        className="h-7 w-full min-w-0 justify-start overflow-hidden px-1.5 text-xs font-normal text-muted-foreground"
                        onClick={() => onSelectBucket(bucket)}
                      >
                        <Database data-icon="inline-start" />
                        <span className="min-w-0 truncate">{bucket.name}</span>
                      </Button>
                      <Button
                        size="icon-xs"
                        variant={defaultBucket ? 'secondary' : 'ghost'}
                        className={cn(
                          'transition-opacity',
                          'pointer-events-none opacity-0 group-focus-within/bucket:pointer-events-auto group-focus-within/bucket:opacity-100 group-hover/bucket:pointer-events-auto group-hover/bucket:opacity-100',
                          (selected || settingDefault) &&
                            'pointer-events-auto opacity-100',
                          defaultBucket && 'text-primary',
                        )}
                        aria-pressed={defaultBucket}
                        disabled={settingDefault}
                        title={
                          defaultBucket ? '默认 bucket' : '设为默认 bucket'
                        }
                        onClick={() => {
                          if (!defaultBucket) {
                            onSetDefault(bucket);
                          }
                        }}
                      >
                        <Star className={cn(defaultBucket && 'fill-current')} />
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
                  <Database />
                </EmptyMedia>
                <EmptyTitle>没有 bucket</EmptyTitle>
                <EmptyDescription>配置存储账号后同步 bucket。</EmptyDescription>
              </EmptyHeader>
              <Button size="sm" onClick={onCreateAccount}>
                <Plus data-icon="inline-start" />
                新增账号
              </Button>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
