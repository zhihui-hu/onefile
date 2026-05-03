import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ImageIcon } from 'lucide-react';

import type { ImageDimensions, StoredUpload } from './types';
import { UploadCard } from './upload-card';

type UploadHistoryProps = {
  uploads: StoredUpload[];
  imageDimensions: Record<string, ImageDimensions>;
  onDimensionsChange: (id: string, dimensions: ImageDimensions) => void;
  onCopy: (value: string, message?: string) => void;
};

export function UploadHistory({
  uploads,
  imageDimensions,
  onDimensionsChange,
  onCopy,
}: UploadHistoryProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-medium">上传记录</h2>
      </div>

      {uploads.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyTitle>还没有上传记录</EmptyTitle>
            <EmptyDescription>
              图片上传完成后会在这里显示完整地址。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),20rem))] gap-4">
          {uploads.map((upload) => (
            <UploadCard
              key={upload.id}
              upload={upload}
              dimensions={imageDimensions[upload.id]}
              onDimensionsChange={onDimensionsChange}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
