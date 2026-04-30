'use client';

import {
  OneFileApiError,
  completeGithubCallback,
} from '@/app/(main)/components/api';
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
import { Spinner } from '@/components/ui/spinner';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type CallbackState = 'loading' | 'success' | 'error';

export function CallbackAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('正在完成 GitHub 授权');

  const params = useMemo(
    () => ({
      code: searchParams.get('code'),
      state: searchParams.get('state'),
      error: searchParams.get('error'),
      errorDescription: searchParams.get('error_description'),
    }),
    [searchParams],
  );

  useEffect(() => {
    let active = true;

    async function finish() {
      if (params.error) {
        setState('error');
        setMessage(params.errorDescription || params.error);
        return;
      }

      if (!params.code || !params.state) {
        setState('error');
        setMessage('GitHub callback 缺少 code 或 state。');
        return;
      }

      try {
        await completeGithubCallback(params.code, params.state);
        if (!active) return;
        setState('success');
        setMessage('授权完成，正在返回文件管理器。');
        await queryClient.invalidateQueries({ queryKey: ['onefile', 'me'] });
        window.setTimeout(() => router.replace('/'), 600);
      } catch (error) {
        if (!active) return;
        setState('error');
        setMessage(
          error instanceof OneFileApiError
            ? error.message
            : '授权回调处理失败，请重新登录。',
        );
      }
    }

    void finish();
    return () => {
      active = false;
    };
  }, [params, queryClient, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {state === 'loading' ? (
              <Spinner />
            ) : state === 'success' ? (
              <CheckCircle2 />
            ) : (
              <AlertCircle />
            )}
          </EmptyMedia>
          <EmptyTitle>
            {state === 'loading'
              ? '正在完成授权'
              : state === 'success'
                ? '授权成功'
                : '授权失败'}
          </EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        {state === 'error' && (
          <EmptyContent>
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>无法登录</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button asChild>
                <a href="/api/auth/github/start">
                  <LogIn data-icon="inline-start" />
                  重新授权
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">返回首页</Link>
              </Button>
            </div>
          </EmptyContent>
        )}
      </Empty>
    </main>
  );
}
