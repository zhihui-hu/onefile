'use client';

import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Copy, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type QrCodeDialogProps = {
  title: string;
  description: string;
  url: string;
  open: boolean;
  copyMessage?: string;
  showOpenButton?: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (value: string, message: string) => void;
};

export function QrCodeDialog({
  title,
  description,
  url,
  open,
  copyMessage = '已复制完整地址',
  showOpenButton = false,
  onOpenChange,
  onCopy,
}: QrCodeDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="sm:max-w-sm"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="p-0 text-left">
          <ResponsiveDialog.Title>{title}</ResponsiveDialog.Title>
          <ResponsiveDialog.Description className="break-all">
            {description || url}
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg border bg-background p-3">
            {url && (
              <QRCodeSVG
                value={url}
                size={220}
                marginSize={1}
                className="size-56 max-w-full"
              />
            )}
          </div>
          <div className="max-w-full break-all rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {url}
          </div>
        </div>
        <ResponsiveDialog.Footer className="p-2">
          <Button
            variant="outline"
            disabled={!url}
            onClick={() => onCopy(url, copyMessage)}
          >
            <Copy data-icon="inline-start" />
            复制地址
          </Button>
          {showOpenButton && (
            <Button
              disabled={!url}
              onClick={() => {
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <ExternalLink data-icon="inline-start" />
              打开链接
            </Button>
          )}
        </ResponsiveDialog.Footer>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
