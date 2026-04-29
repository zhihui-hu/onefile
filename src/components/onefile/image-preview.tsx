'use client';

import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { IMAGE_BLUR_DATA_URL } from '@/lib/image';
import { cn } from '@/lib/utils';
import { FileImage, XIcon } from 'lucide-react';
import Image from 'next/image';
import { type ReactNode, useEffect, useRef, useState } from 'react';

type ImagePreviewProps = {
  src: string;
  alt: string;
  title?: string;
  fallback?: ReactNode;
  className?: string;
};

export function ImagePreview({
  src,
  alt,
  title = alt,
  fallback,
  className,
}: ImagePreviewProps) {
  const thumbnailRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [shouldLoadThumbnail, setShouldLoadThumbnail] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setThumbnailFailed(false);
    setPreviewFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src || shouldLoadThumbnail) return;

    const node = thumbnailRef.current;
    if (!node) return;

    if (!('IntersectionObserver' in window)) {
      setShouldLoadThumbnail(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadThumbnail(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoadThumbnail, src]);

  const fallbackIcon = fallback ?? <FileImage />;

  return (
    <span ref={thumbnailRef} className="inline-flex size-7 shrink-0">
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialog.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`预览图片：${title}`}
            className={cn(
              'size-7 overflow-hidden border bg-muted p-0 text-muted-foreground hover:bg-muted',
              className,
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {src && shouldLoadThumbnail && !thumbnailFailed ? (
              <Image
                src={src}
                alt=""
                width={40}
                height={40}
                sizes="40px"
                className="size-full object-cover"
                loading="lazy"
                placeholder="blur"
                blurDataURL={IMAGE_BLUR_DATA_URL}
                unoptimized
                onError={() => setThumbnailFailed(true)}
              />
            ) : (
              fallbackIcon
            )}
          </Button>
        </ResponsiveDialog.Trigger>
        <ResponsiveDialog.Content
          showCloseButton={false}
          className="h-[100dvh] w-[100vw] max-w-[100vw] grid-rows-[1fr] gap-0 overflow-hidden rounded-none p-0 sm:max-w-[100vw]"
          drawerClassName="h-[100dvh] max-h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-none [&>div:first-child]:hidden"
        >
          <ResponsiveDialog.Header className="sr-only">
            <ResponsiveDialog.Title>{title}</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>
              图片全屏预览
            </ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <div className="relative -m-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background md:m-0">
            {previewFailed ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground [&_svg]:size-10">
                {fallbackIcon}
                <span>图片加载失败</span>
              </div>
            ) : (
              <Image
                src={src}
                alt={alt}
                fill
                sizes="100vw"
                className="object-contain"
                placeholder="blur"
                blurDataURL={IMAGE_BLUR_DATA_URL}
                unoptimized
                onError={() => setPreviewFailed(true)}
              />
            )}
            <ResponsiveDialog.Close asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-3 right-3"
              >
                <XIcon />
                <span className="sr-only">关闭图片预览</span>
              </Button>
            </ResponsiveDialog.Close>
          </div>
        </ResponsiveDialog.Content>
      </ResponsiveDialog>
    </span>
  );
}
