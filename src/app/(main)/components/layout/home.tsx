'use client';

import {
  getCurrentUser,
  listBuckets,
  listStorageAccounts,
} from '@/app/(main)/components/api';
import { AuthGate } from '@/app/(main)/components/auth/auth-gate';
import { FileBrowser } from '@/app/(main)/components/files/file-browser';
import { BucketSidebar } from '@/app/(main)/components/layout/bucket-sidebar';
import { buildAddress, normalizePrefix } from '@/app/(main)/components/path';
import { SqlBackupDialog } from '@/app/(main)/components/storage/sql-backup-dialog';
import { StorageAccountDialog } from '@/app/(main)/components/storage/storage-account-dialog';
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
import { debugLog, debugLogLimited } from '@/lib/debug';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Database, FileUp, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const FILE_LOCATION_STORAGE_KEY = 'onefile:file-location:v1';

type StoredFileLocation = {
  selectedBucketId: string | null;
  selectedAddress: string | null;
  prefixes: Record<string, string>;
};

function readStoredFileLocation(): StoredFileLocation {
  if (typeof window === 'undefined') {
    return { selectedBucketId: null, selectedAddress: null, prefixes: {} };
  }

  try {
    const raw = window.localStorage.getItem(FILE_LOCATION_STORAGE_KEY);
    if (!raw) {
      return { selectedBucketId: null, selectedAddress: null, prefixes: {} };
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
      selectedAddress:
        typeof parsed.selectedAddress === 'string'
          ? parsed.selectedAddress
          : null,
      prefixes,
    };
  } catch {
    return { selectedBucketId: null, selectedAddress: null, prefixes: {} };
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

export function OneFileHome() {
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
  const refetchBuckets = bucketsQuery.refetch;

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
  const storageDialogOpen = accountsOpen || createAccountOpen;
  const storageQueriesReady = accountsQuery.isSuccess && bucketsQuery.isSuccess;

  debugLogLimited('home:render', {
    me_status: meQuery.status,
    accounts_status: accountsQuery.status,
    buckets_status: bucketsQuery.status,
    accounts_count: accounts.length,
    buckets_count: buckets.length,
    selected_bucket_id: selectedBucketId,
    selected_prefix: selectedPrefix,
    location_ready: locationReady,
  });

  useEffect(() => {
    debugLog('home:restore-location:start');
    const stored = readStoredFileLocation();
    debugLog('home:restore-location:end', {
      selected_bucket_id: stored.selectedBucketId,
      selected_address: stored.selectedAddress,
      prefix_count: Object.keys(stored.prefixes).length,
    });
    setSelectedBucketId(stored.selectedBucketId);
    setBucketPrefixes(stored.prefixes);
    setLocationReady(true);
  }, []);

  useEffect(() => {
    if (!locationReady || !bucketsQuery.isSuccess) {
      return;
    }

    if (!buckets.length) {
      if (selectedBucketId !== null) {
        debugLog('home:bucket-selection:empty', {
          previous_bucket_id: selectedBucketId,
        });
        setSelectedBucketId(null);
      }
      return;
    }

    if (
      selectedBucketId &&
      buckets.some((bucket) => String(bucket.id) === selectedBucketId)
    ) {
      return;
    }

    const next = buckets[0];
    debugLog('home:bucket-selection:fallback', {
      previous_bucket_id: selectedBucketId,
      next_bucket_id: next.id,
      next_bucket_name: next.name,
    });
    setSelectedBucketId(String(next.id));
  }, [buckets, bucketsQuery.isSuccess, locationReady, selectedBucketId]);

  useEffect(() => {
    if (!locationReady || !storageQueriesReady) {
      return;
    }

    debugLog('home:persist-location', {
      selected_bucket_id: selectedBucketId,
      selected_address: selectedBucket
        ? buildAddress(selectedBucket.name, selectedPrefix)
        : null,
      prefix_count: Object.keys(bucketPrefixes).length,
    });
    writeStoredFileLocation({
      selectedBucketId,
      selectedAddress: selectedBucket
        ? buildAddress(selectedBucket.name, selectedPrefix)
        : null,
      prefixes: bucketPrefixes,
    });
  }, [
    bucketPrefixes,
    locationReady,
    selectedBucket,
    selectedBucketId,
    selectedPrefix,
    storageQueriesReady,
  ]);

  const updateSelectedPrefix = useCallback(
    (nextPrefix: string) => {
      if (!selectedBucket) return;

      const bucketId = String(selectedBucket.id);
      const normalizedPrefix = normalizePrefix(nextPrefix);
      debugLog('home:update-prefix', {
        bucket_id: bucketId,
        next_prefix: normalizedPrefix,
      });
      setBucketPrefixes((current) =>
        current[bucketId] === normalizedPrefix
          ? current
          : {
              ...current,
              [bucketId]: normalizedPrefix,
            },
      );
    },
    [selectedBucket],
  );

  const selectBucket = useCallback((bucketId: number | string) => {
    const nextBucketId = String(bucketId);
    debugLog('home:select-bucket', {
      bucket_id: nextBucketId,
      reset_prefix: true,
    });
    setSelectedBucketId(nextBucketId);
    setBucketPrefixes((current) =>
      current[nextBucketId]
        ? {
            ...current,
            [nextBucketId]: '',
          }
        : current,
    );
  }, []);

  const refreshBuckets = useCallback(() => {
    void refetchBuckets();
  }, [refetchBuckets]);

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
    !locationReady || accountsQuery.isPending || bucketsQuery.isPending;
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

  if (loadingBuckets) {
    return (
      <main className="flex h-[calc(100vh-7rem)] flex-col gap-3 overflow-hidden p-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="min-h-0 flex-1" />
        {storageDialogOpen && (
          <StorageAccountDialog
            open={accountsOpen}
            onOpenChange={setAccountsOpen}
            createOpen={createAccountOpen}
            onCreateOpenChange={setCreateAccountOpen}
          />
        )}
      </main>
    );
  }

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

        {storageDialogOpen && (
          <StorageAccountDialog
            open={accountsOpen}
            onOpenChange={setAccountsOpen}
            createOpen={createAccountOpen}
            onCreateOpenChange={setCreateAccountOpen}
          />
        )}
        {isAdmin && backupOpen && (
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
          onRefresh={refreshBuckets}
          onCreateAccount={() => setCreateAccountOpen(true)}
          onSelectBucket={(bucket) => selectBucket(bucket.id)}
        />
        <FileBrowser
          bucket={selectedBucket}
          prefix={selectedPrefix}
          onPrefixChange={updateSelectedPrefix}
          onOpenAccounts={() => setAccountsOpen(true)}
        />
      </div>

      {storageDialogOpen && (
        <StorageAccountDialog
          open={accountsOpen}
          onOpenChange={setAccountsOpen}
          createOpen={createAccountOpen}
          onCreateOpenChange={setCreateAccountOpen}
        />
      )}
    </main>
  );
}
