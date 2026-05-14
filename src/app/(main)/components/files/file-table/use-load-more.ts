'use client';

import { useEffect, useRef } from 'react';

export function useFileTableLoadMore({
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  itemCount,
}: {
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore?: () => void;
  itemCount: number;
}) {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);
  const loadMoreRequestedRef = useRef(false);

  useEffect(() => {
    if (!loadingMore) {
      loadMoreRequestedRef.current = false;
    }
  }, [loadingMore]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || !onLoadMore) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const root = scrollRootRef.current;

    const requestLoadMore = () => {
      if (loadMoreRequestedRef.current) return;
      loadMoreRequestedRef.current = true;
      onLoadMore();
    };

    if (typeof IntersectionObserver === 'undefined') {
      if (!root) return;

      const loadIfNearBottom = () => {
        const remaining =
          root.scrollHeight - root.scrollTop - root.clientHeight;
        if (remaining <= 180) {
          requestLoadMore();
        }
      };

      root.addEventListener('scroll', loadIfNearBottom, { passive: true });
      loadIfNearBottom();

      return () => root.removeEventListener('scroll', loadIfNearBottom);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          requestLoadMore();
        }
      },
      {
        root,
        rootMargin: '180px 0px',
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, itemCount, loading, loadingMore, onLoadMore]);

  return { scrollRootRef, loadMoreRef };
}
