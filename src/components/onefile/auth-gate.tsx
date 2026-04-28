'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { LockKeyhole, LogIn } from 'lucide-react';
import { useState } from 'react';

export function AuthGate() {
  const [open, setOpen] = useState(true);

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>连接 GitHub</DialogTitle>
            <DialogDescription>
              登录后即可配置对象存储账号，浏览 bucket，并通过 presigned URL
              上传文件。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild>
              <a href="/api/auth/github/start">
                <LogIn data-icon="inline-start" />
                继续授权
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
