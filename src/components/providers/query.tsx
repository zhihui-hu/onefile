'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 数据缓存时间 (默认 5 分钟)
            staleTime: 5 * 60 * 1000,
            // 数据在内存中的缓存时间 (默认 5 分钟)
            gcTime: 5 * 60 * 1000,
            // 重试次数
            retry: 3,
            // 重试延迟
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
            // 窗口重新获得焦点时是否重新获取数据
            refetchOnWindowFocus: false,
            // 网络重新连接时是否重新获取数据
            refetchOnReconnect: true,
          },
          mutations: {
            // 重试次数
            retry: 1,
            // 重试延迟
            retryDelay: 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )} */}
    </QueryClientProvider>
  );
}
