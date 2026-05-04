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
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type VersionCheckResult = {
  checkedAt: string;
  currentVersion: string;
  latestVersion: string;
  latestVersionLabel: string;
  publishedAt: string | null;
  source: 'release' | 'package';
  updateAvailable: boolean;
  url: string;
};

export default function Footer() {
  const [hostname, setHostname] = useState<string>();
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(
    null,
  );

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkLatestVersion() {
      try {
        const response = await fetch('/api/version/latest', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          data?: VersionCheckResult;
        };
        if (payload.data) setVersionCheck(payload.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    void checkLatestVersion();

    return () => controller.abort();
  }, []);

  const updateAvailable = Boolean(versionCheck?.updateAvailable);
  const versionText = `${siteConfig.title} v${siteConfig.version}`;

  return (
    <>
      <footer className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
        <div className="truncate">
          2018 - {format(new Date(), 'yyyy')} © {hostname}. All rights reserved.
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="xs" asChild>
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer"
              title="GitHub"
            >
              GitHub
              <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
          <button
            type="button"
            disabled={!updateAvailable}
            onClick={() => setVersionDialogOpen(true)}
            className={cn(
              'min-w-0 truncate text-left disabled:cursor-default',
              updateAvailable &&
                'text-warning underline-offset-4 hover:underline',
            )}
            title={
              updateAvailable
                ? `发现新版本 ${versionCheck?.latestVersionLabel}`
                : versionText
            }
          >
            {versionText}
          </button>
        </div>
      </footer>

      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发现新版本</DialogTitle>
            <DialogDescription>
              GitHub 上已有更新版本，建议更新后获得最新修复和功能。
            </DialogDescription>
          </DialogHeader>

          {versionCheck && (
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">当前版本</span>
                <span>v{versionCheck.currentVersion}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">最新版本</span>
                <span className="text-warning">
                  {versionCheck.latestVersionLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">检查来源</span>
                <span>
                  {versionCheck.source === 'release'
                    ? 'GitHub Release'
                    : 'GitHub package.json'}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
            >
              稍后再说
            </Button>
            <Button asChild>
              <a
                href={versionCheck?.url ?? siteConfig.githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                <RefreshCw data-icon="inline-start" />
                前往更新
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
