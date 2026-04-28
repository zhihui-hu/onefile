'use client';

import {
  getCurrentUser,
  listBuckets,
  listStorageAccounts,
  setDefaultBucket,
} from '@/components/onefile/api';
import { AuthGate } from '@/components/onefile/auth-gate';
import { BucketSidebar } from '@/components/onefile/bucket-sidebar';
import { FileBrowser } from '@/components/onefile/file-browser';
import { StorageAccountDialog } from '@/components/onefile/storage-account-dialog';
import type { StorageBucket } from '@/components/onefile/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

function bucketDefault(bucket: StorageBucket) {
  return bucket.is_default === true || bucket.is_default === 1;
}

export function OneFileHome() {
  const queryClient = useQueryClient();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);

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
    onSuccess: async () => {
      toast.success('默认 bucket 已更新');
      await queryClient.invalidateQueries({ queryKey: ['onefile', 'buckets'] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '设置失败'),
  });

  const buckets = useMemo(() => bucketsQuery.data || [], [bucketsQuery.data]);
  const selectedBucket = useMemo(
    () =>
      buckets.find((bucket) => String(bucket.id) === selectedBucketId) || null,
    [buckets, selectedBucketId],
  );

  useEffect(() => {
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
  }, [buckets, selectedBucketId]);

  if (meQuery.isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-7rem)] flex-col gap-3 p-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="min-h-96 flex-1" />
      </main>
    );
  }

  if (!meQuery.data) {
    return <AuthGate />;
  }

  const loadingBuckets = accountsQuery.isLoading || bucketsQuery.isLoading;
  const loadError =
    accountsQuery.error instanceof Error
      ? accountsQuery.error.message
      : bucketsQuery.error instanceof Error
        ? bucketsQuery.error.message
        : null;

  return (
    <main className="flex min-h-[calc(100vh-7rem)] flex-1 flex-col">
      {loadError && (
        <Alert variant="destructive" className="m-3">
          <AlertTriangle />
          <AlertTitle>存储数据读取失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[18rem_minmax(0,1fr)]">
        <BucketSidebar
          accounts={accountsQuery.data || []}
          buckets={buckets}
          selectedBucket={selectedBucket}
          loading={loadingBuckets}
          refreshing={bucketsQuery.isFetching}
          onRefresh={() => void bucketsQuery.refetch()}
          onOpenAccounts={() => setAccountsOpen(true)}
          onSelectBucket={(bucket) => setSelectedBucketId(String(bucket.id))}
          onSetDefault={(bucket) => defaultMutation.mutate(bucket.id)}
        />
        <FileBrowser
          bucket={selectedBucket}
          onOpenAccounts={() => setAccountsOpen(true)}
        />
      </div>

      <StorageAccountDialog
        open={accountsOpen}
        onOpenChange={setAccountsOpen}
      />
    </main>
  );
}
