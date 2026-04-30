'use client';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { LockKeyhole, LogIn } from 'lucide-react';

export function AuthGate() {
  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
      <Empty className="max-w-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockKeyhole />
          </EmptyMedia>
          <EmptyTitle>需要 GitHub 授权</EmptyTitle>
          <EmptyDescription>
            OneFile 使用 GitHub 登录来保存你的存储账号、bucket 和上传会话。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <a href="/api/auth/github/start">
              <LogIn data-icon="inline-start" />
              使用 GitHub 登录
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
