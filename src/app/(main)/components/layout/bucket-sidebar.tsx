'use client';

import { providerLabel } from '@/app/(main)/components/format';
import { providerIconUrl } from '@/app/(main)/components/storage/storage-account-form-dialog';
import type {
  ProviderId,
  StorageAccount,
  StorageBucket,
} from '@/app/(main)/components/types';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';
import { ChevronRight, Database, Plus, RefreshCw, Search } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo, useRef, useState } from 'react';

function accountId(bucket: StorageBucket) {
  return bucket.storage_account_id ?? bucket.storageAccountId ?? '';
}

function BucketItem({
  bucket,
  selected,
  onSelect,
}: {
  bucket: StorageBucket;
  selected: boolean;
  onSelect: () => void;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);

  const checkOverflow = useCallback((node: HTMLSpanElement | null) => {
    textRef.current = node;
    if (node) {
      setOverflowed(node.scrollWidth > node.clientWidth);
    }
  }, []);

  return (
    <Tooltip open={overflowed ? undefined : false}>
      <TooltipTrigger asChild>
        <Button
          variant={selected ? 'secondary' : 'ghost'}
          className="h-7 w-full max-w-full min-w-0 justify-start overflow-hidden px-1.5 text-xs font-normal text-muted-foreground cursor-pointer"
          onClick={onSelect}
        >
          <Database data-icon="inline-start" />
          <span
            ref={checkOverflow}
            className="block min-w-0 flex-1 truncate text-left"
          >
            {bucket.name}
          </span>
        </Button>
      </TooltipTrigger>
      {overflowed && (
        <TooltipContent side="right">{bucket.name}</TooltipContent>
      )}
    </Tooltip>
  );
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
  onSelectBucket,
  onRefresh,
  onCreateAccount,
}: {
  accounts: StorageAccount[];
  buckets: StorageBucket[];
  selectedBucket: StorageBucket | null;
  loading: boolean;
  refreshing: boolean;
  onSelectBucket: (bucket: StorageBucket) => void;
  onRefresh: () => void;
  onCreateAccount: () => void;
}) {
  const [search, setSearch] = useState('');
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [String(account.id), account])),
    [accounts],
  );

  const updateGroupOpen = (key: string, open: boolean) => {
    setCollapsedGroupKeys((current) => {
      const next = new Set(current);
      if (open) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
              className="cursor-pointer"
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
                className="cursor-pointer"
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
        <div className="flex min-w-0 flex-col overflow-hidden p-2">
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
            groups.map((group) => {
              const open = !collapsedGroupKeys.has(group.key);

              return (
                <Collapsible
                  key={group.key}
                  open={open}
                  onOpenChange={(nextOpen) =>
                    updateGroupOpen(group.key, nextOpen)
                  }
                  className="group/collapsible flex min-w-0 flex-col"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="grid h-6 w-full min-w-0 grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)] items-center justify-start gap-1.5 px-1 text-[11px] font-normal text-muted-foreground cursor-pointer"
                    >
                      <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isProviderId(group.provider) ? (
                          <Image
                            alt=""
                            width={14}
                            height={14}
                            className="size-3.5 shrink-0 rounded-sm"
                            src={providerIconUrl(group.provider, 16)}
                            unoptimized
                          />
                        ) : (
                          <Database className="shrink-0" />
                        )}
                        <span className="truncate">
                          {providerLabel(group.provider)}
                        </span>
                      </span>
                      <span className="flex min-w-0 justify-end">
                        <span className="min-w-0 truncate">{group.label}</span>
                        <span className="shrink-0">
                          （{group.buckets.length}）
                        </span>
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex min-w-0  flex-col gap-0.5">
                    <TooltipProvider delayDuration={300}>
                      {group.buckets.map((bucket) => (
                        <BucketItem
                          key={bucket.id}
                          bucket={bucket}
                          selected={
                            String(selectedBucket?.id) === String(bucket.id)
                          }
                          onSelect={() => onSelectBucket(bucket)}
                        />
                      ))}
                    </TooltipProvider>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
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
