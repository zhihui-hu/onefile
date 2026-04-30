'use client';

import {
  getCurrentUser,
  listBuckets,
  listStorageAccounts,
  setDefaultBucket,
} from '@/app/(main)/components/api';
import { AuthGate } from '@/app/(main)/components/auth/auth-gate';
import { FileBrowser } from '@/app/(main)/components/files/file-browser';
import { BucketSidebar } from '@/app/(main)/components/layout/bucket-sidebar';
import { normalizePrefix } from '@/app/(main)/components/path';
import { SqlBackupDialog } from '@/app/(main)/components/storage/sql-backup-dialog';
import { StorageAccountDialog } from '@/app/(main)/components/storage/storage-account-dialog';
import type { StorageBucket } from '@/app/(main)/components/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Database, FileUp, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const FILE_LOCATION_STORAGE_KEY = 'onefile:file-location:v1';

type StoredFileLocation = {
  selectedBucketId: string | null;
  prefixes: Record<string, string>;
};

function readStoredFileLocation(): StoredFileLocation {
  if (typeof window === 'undefined') {
    return { selectedBucketId: null, prefixes: {} };
  }

  try {
    const raw = window.localStorage.getItem(FILE_LOCATION_STORAGE_KEY);
    if (!raw) {
      return { selectedBucketId: null, prefixes: {} };
    }

    const parsed = JSON.parse(raw) as Partial<StoredFileLocation>;
    const prefixes =
      parsed.prefixes && typeof parsed.prefixes === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.prefixes)
              .filter(
                ([bucketId, prefix]) => bucketId && typeof prefix === 'string',
              )
              .map(([bucketId, prefix]) => [bucketId, normalizePrefix(prefix)]),
          )
        : {};

    return {
      selectedBucketId:
        typeof parsed.selectedBucketId === 'string'
          ? parsed.selectedBucketId
          : null,
      prefixes,
    };
  } catch {
    return { selectedBucketId: null, prefixes: {} };
  }
}

function writeStoredFileLocation(location: StoredFileLocation) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      FILE_LOCATION_STORAGE_KEY,
      JSON.stringify(location),
    );
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}

function bucketDefault(bucket: StorageBucket) {
  return bucket.is_default === true || bucket.is_default === 1;
}

function markDefaultBucket(
  buckets: StorageBucket[] | undefined,
  bucketId: number | string,
  updatedBucket?: StorageBucket,
) {
  if (!buckets) {
    return buckets;
  }

  const targetId = String(bucketId);
  return buckets.map((bucket) => {
    const isTarget = String(bucket.id) === targetId;
    if (isTarget) {
      return {
        ...bucket,
        ...updatedBucket,
        is_default: true,
      };
    }

    return bucketDefault(bucket) ? { ...bucket, is_default: false } : bucket;
  });
}

export function OneFileHome() {
  const queryClient = useQueryClient();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [bucketPrefixes, setBucketPrefixes] = useState<Record<string, string>>(
    {},
  );

  const meQuery = useQuery({
    queryKey: ['onefile', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const accountsQuery = useQuery({
    queryKey: ['onefile', 'storage-accounts'],
    queryFn: listStorageAccounts,
    enabled: Boolean(meQuery.data),
    retry: false,
  });

  const bucketsQuery = useQuery({
    queryKey: ['onefile', 'buckets'],
    queryFn: listBuckets,
    enabled: Boolean(meQuery.data),
    retry: false,
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultBucket,
    onMutate: async (bucketId) => {
      await queryClient.cancelQueries({ queryKey: ['onefile', 'buckets'] });
      const previousBuckets = queryClient.getQueryData<StorageBucket[]>([
        'onefile',
        'buckets',
      ]);

      queryClient.setQueryData<StorageBucket[]>(
        ['onefile', 'buckets'],
        (current) => markDefaultBucket(current, bucketId),
      );

      return { previousBuckets };
    },
    onSuccess: (updatedBucket, bucketId) => {
      queryClient.setQueryData<StorageBucket[]>(
        ['onefile', 'buckets'],
        (current) => markDefaultBucket(current, bucketId, updatedBucket),
      );
      setSelectedBucketId(String(bucketId));
      toast.success('默认 bucket 已更新');
    },
    onError: (error, _bucketId, context) => {
      if (context?.previousBuckets) {
        queryClient.setQueryData(
          ['onefile', 'buckets'],
          context.previousBuckets,
        );
      }
      toast.error(error instanceof Error ? error.message : '设置失败');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['onefile', 'buckets'] });
    },
  });

  const accounts = useMemo(
    () => accountsQuery.data || [],
    [accountsQuery.data],
  );
  const buckets = useMemo(() => bucketsQuery.data || [], [bucketsQuery.data]);
  const selectedBucket = useMemo(
    () =>
      buckets.find((bucket) => String(bucket.id) === selectedBucketId) || null,
    [buckets, selectedBucketId],
  );
  const selectedPrefix = selectedBucket
    ? bucketPrefixes[String(selectedBucket.id)] || ''
    : '';

  useEffect(() => {
    const stored = readStoredFileLocation();
    setSelectedBucketId(stored.selectedBucketId);
    setBucketPrefixes(stored.prefixes);
    setLocationReady(true);
  }, []);

  useEffect(() => {
    if (!locationReady) {
      return;
    }

    if (!buckets.length) {
      setSelectedBucketId(null);
      return;
    }

    if (
      selectedBucketId &&
      buckets.some((bucket) => String(bucket.id) === selectedBucketId)
    ) {
      return;
    }

    const next = buckets.find(bucketDefault) || buckets[0];
    setSelectedBucketId(String(next.id));
  }, [buckets, locationReady, selectedBucketId]);

  useEffect(() => {
    if (!locationReady) {
      return;
    }

    writeStoredFileLocation({
      selectedBucketId,
      prefixes: bucketPrefixes,
    });
  }, [bucketPrefixes, locationReady, selectedBucketId]);

  const updateSelectedPrefix = (nextPrefix: string) => {
    if (!selectedBucket) return;

    const bucketId = String(selectedBucket.id);
    setBucketPrefixes((current) => ({
      ...current,
      [bucketId]: normalizePrefix(nextPrefix),
    }));
  };

  if (meQuery.isLoading) {
    return (
      <main className="flex h-[calc(100vh-7rem)] flex-col gap-3 overflow-hidden p-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="min-h-0 flex-1" />
      </main>
    );
  }

  if (!meQuery.data) {
    return <AuthGate />;
  }

  const loadingBuckets =
    !locationReady || accountsQuery.isLoading || bucketsQuery.isLoading;
  const loadError =
    accountsQuery.error instanceof Error
      ? accountsQuery.error.message
      : bucketsQuery.error instanceof Error
        ? bucketsQuery.error.message
        : null;
  const emptyStorage =
    !loadingBuckets &&
    !loadError &&
    accounts.length === 0 &&
    buckets.length === 0;
  const isAdmin = meQuery.data.role === 'admin';

  if (emptyStorage) {
    return (
      <main className="flex h-[calc(100vh-7rem)] flex-1 items-center justify-center overflow-hidden p-4">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>
              {isAdmin ? '配置第一个存储账号' : '等待管理员配置存储'}
            </EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? '添加对象存储账号后同步 bucket，或导入已有 SQL 备份文件恢复数据。'
                : '当前还没有可用的存储数据，请联系管理员新增账号或导入备份。'}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && (
            <EmptyContent className="sm:flex-row sm:justify-center">
              <Button onClick={() => setCreateAccountOpen(true)}>
                <Plus data-icon="inline-start" />
                新增账号
              </Button>
              <Button variant="outline" onClick={() => setBackupOpen(true)}>
                <FileUp data-icon="inline-start" />
                导入文件
              </Button>
            </EmptyContent>
          )}
        </Empty>

        <StorageAccountDialog
          open={accountsOpen}
          onOpenChange={setAccountsOpen}
          createOpen={createAccountOpen}
          onCreateOpenChange={setCreateAccountOpen}
        />
        {isAdmin && (
          <SqlBackupDialog
            open={backupOpen}
            onOpenChange={setBackupOpen}
            initialTab="import"
          />
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {loadError && (
        <Alert variant="destructive" className="m-3 shrink-0">
          <AlertTriangle />
          <AlertTitle>存储数据读取失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]">
        <BucketSidebar
          accounts={accounts}
          buckets={buckets}
          selectedBucket={selectedBucket}
          loading={loadingBuckets}
          refreshing={bucketsQuery.isFetching}
          defaultBucketPendingId={
            defaultMutation.isPending && defaultMutation.variables !== undefined
              ? String(defaultMutation.variables)
              : null
          }
          onRefresh={() => void bucketsQuery.refetch()}
          onCreateAccount={() => setCreateAccountOpen(true)}
          onSelectBucket={(bucket) => setSelectedBucketId(String(bucket.id))}
          onSetDefault={(bucket) => defaultMutation.mutate(bucket.id)}
        />
        <FileBrowser
          bucket={selectedBucket}
          prefix={selectedPrefix}
          onPrefixChange={updateSelectedPrefix}
          onOpenAccounts={() => setAccountsOpen(true)}
        />
      </div>

      <StorageAccountDialog
        open={accountsOpen}
        onOpenChange={setAccountsOpen}
        createOpen={createAccountOpen}
        onCreateOpenChange={setCreateAccountOpen}
      />
    </main>
  );
}
