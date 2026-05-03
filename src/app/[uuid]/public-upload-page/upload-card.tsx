import {
  absoluteDate,
  formatBytes,
  formatDate,
} from '@/app/(main)/components/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Copy, ImageIcon, QrCode } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { QrCodeDialog } from './qr-code-dialog';
import type { ImageDimensions, StoredUpload } from './types';
import {
  FALLBACK_IMAGE_DIMENSIONS,
  IMAGE_BLUR_DATA_URL,
  bbcodeImage,
  markdownImage,
  uploadSubtitle,
} from './utils';

type UploadCardProps = {
  upload: StoredUpload;
  dimensions?: ImageDimensions;
  onDimensionsChange: (id: string, dimensions: ImageDimensions) => void;
  onCopy: (value: string, message?: string) => void;
};

export function UploadCard({
  upload,
  dimensions,
  onDimensionsChange,
  onCopy,
}: UploadCardProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const imageWidth = dimensions?.width ?? FALLBACK_IMAGE_DIMENSIONS.width;
  const imageHeight = dimensions?.height ?? FALLBACK_IMAGE_DIMENSIONS.height;

  const openUpload = () => {
    if (!upload.url) return;
    window.open(upload.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Card key={upload.id} size="sm" className="pt-0">
        <button
          type="button"
          className="grid h-[200px] w-full place-items-center overflow-hidden bg-muted"
          disabled={!upload.url}
          onClick={openUpload}
        >
          {upload.url ? (
            <Image
              alt={upload.name}
              blurDataURL={IMAGE_BLUR_DATA_URL}
              className="h-[200px] w-full object-contain"
              height={imageHeight}
              loading="lazy"
              onLoad={(event) => {
                const image = event.currentTarget;
                if (!image.naturalWidth || !image.naturalHeight) return;
                if (
                  dimensions?.width === image.naturalWidth &&
                  dimensions.height === image.naturalHeight
                ) {
                  return;
                }

                onDimensionsChange(upload.id, {
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              }}
              placeholder="blur"
              src={upload.url}
              unoptimized
              width={imageWidth}
            />
          ) : (
            <ImageIcon />
          )}
          <span className="sr-only">打开图片</span>
        </button>
        <CardHeader>
          <CardTitle className="truncate">{upload.name}</CardTitle>
          <CardDescription className="truncate">
            {uploadSubtitle(upload)}
          </CardDescription>
          <CardAction>
            <Badge variant={upload.compressed ? 'secondary' : 'outline'}>
              {upload.compressed ? 'WebP' : '原图'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span title={absoluteDate(upload.uploadedAt)}>
              {formatDate(upload.uploadedAt)}
            </span>
            {upload.originalSize &&
              upload.size &&
              upload.originalSize !== upload.size && (
                <span>
                  {formatBytes(upload.originalSize)} →{' '}
                  {formatBytes(upload.size)}
                </span>
              )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!upload.url}
              onClick={() => onCopy(upload.url, '已复制完整地址')}
            >
              <Copy data-icon="inline-start" />
              复制地址
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!upload.url}
              onClick={() => onCopy(markdownImage(upload), '已复制 Markdown')}
            >
              <Copy data-icon="inline-start" />
              复制 MD
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!upload.url}
              onClick={() => onCopy(bbcodeImage(upload), '已复制 BBCode')}
            >
              <Copy data-icon="inline-start" />
              复制 BBCode
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!upload.url}
              onClick={() => setQrOpen(true)}
            >
              <QrCode data-icon="inline-start" />
              二维码
            </Button>
          </div>
        </CardContent>
      </Card>
      {upload.url && (
        <QrCodeDialog
          uploadName={upload.name}
          url={upload.url}
          open={qrOpen}
          onOpenChange={setQrOpen}
          onCopy={onCopy}
        />
      )}
    </>
  );
}
