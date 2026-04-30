'use client';

import { getCurrentUser, logout } from '@/app/(main)/components/api';
import { ApiKeyDialog } from '@/app/(main)/components/storage/api-key-dialog';
import { SqlBackupDialog } from '@/app/(main)/components/storage/sql-backup-dialog';
import { StorageAccountDialog } from '@/app/(main)/components/storage/storage-account-dialog';
import { ThemeToggleButton } from '@/components/theme/theme-toggle-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { IMAGE_BLUR_DATA_URL } from '@/lib/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenText,
  Database,
  DatabaseBackup,
  KeyRound,
  LogIn,
  LogOut,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

function initials(name?: string | null) {
  const source = name?.trim() || 'OF';
  return source.slice(0, 2).toUpperCase();
}

export function OneFileHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const meQuery = useQuery({
    queryKey: ['onefile', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onefile'] });
      toast.success('已退出登录');
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : '退出失败'),
  });

  const user = meQuery.data;
  const displayName = user?.display_name || user?.username || 'OneFile';

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center cursor-pointer gap-2"
        >
          <Image
            src="/pwa-192x192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-md"
            placeholder="blur"
            blurDataURL={IMAGE_BLUR_DATA_URL}
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton />

          <Button variant="ghost" size="sm" asChild>
            <Link href="/api-docs" target="_blank" rel="noreferrer">
              <BookOpenText data-icon="inline-start" />
              API 文档
            </Link>
          </Button>

          {meQuery.isLoading ? (
            <Skeleton className="size-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="用户菜单">
                  <Avatar size="default">
                    {user.avatar_url && (
                      <Image
                        src={user.avatar_url}
                        alt={displayName}
                        fill
                        sizes="32px"
                        className="rounded-full object-cover"
                        placeholder="blur"
                        blurDataURL={IMAGE_BLUR_DATA_URL}
                        unoptimized
                      />
                    )}
                    <AvatarFallback>{initials(displayName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="truncate">{displayName}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email || user.role || 'GitHub user'}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setAccountsOpen(true)}>
                    <Database />
                    账号管理
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setApiKeysOpen(true)}>
                    <KeyRound />
                    API KEY
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem onSelect={() => setBackupOpen(true)}>
                      <DatabaseBackup />
                      导入导出
                    </DropdownMenuItem>
                  )}
                  {/* <DropdownMenuItem asChild>
                    <Link href="/api-docs" target="_blank" rel="noreferrer">
                      <BookOpenText />
                      API 文档
                    </Link>
                  </DropdownMenuItem> */}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={logoutMutation.isPending}
                  onSelect={() => logoutMutation.mutate()}
                >
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/auth/github/start">
                <LogIn data-icon="inline-start" />
                登录
              </a>
            </Button>
          )}
        </div>
      </div>

      <StorageAccountDialog
        open={accountsOpen}
        onOpenChange={setAccountsOpen}
      />
      <ApiKeyDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
      <SqlBackupDialog open={backupOpen} onOpenChange={setBackupOpen} />
    </header>
  );
}
