import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { CheckCircle2, ImageUp, UploadCloud, XCircle } from 'lucide-react';
import type { RefObject } from 'react';

import type { UploadState } from './types';
import { filesFromFileList } from './utils';

type UploadPanelProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  dragging: boolean;
  state: UploadState;
  activeFileLabel: string;
  progress: number;
  pendingCount: number;
  error: string;
  onFiles: (files: File[]) => void;
  onCancel: () => void;
};

export function UploadPanel({
  inputRef,
  dragging,
  state,
  activeFileLabel,
  progress,
  pendingCount,
  error,
  onFiles,
  onCancel,
}: UploadPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>上传图片</CardTitle>
        <CardDescription>
          选择、拖拽或粘贴图片会自动上传，完成后可复制 URL、Markdown 或 BBCode。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className={cn(
            'flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors',
            dragging && 'bg-muted',
          )}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              onFiles(filesFromFileList(event.target.files));
              event.currentTarget.value = '';
            }}
          />
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
            {state === 'uploading' ? <Spinner /> : <ImageUp />}
          </div>
          <div className="flex max-w-full flex-col gap-1">
            <div className="truncate text-sm font-medium">
              {state === 'uploading'
                ? '正在上传'
                : dragging
                  ? '松开即可上传'
                  : '点击选择、拖入或粘贴图片'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {activeFileLabel}
            </div>
          </div>
        </div>

        {state === 'uploading' && (
          <div className="flex flex-col gap-2">
            <Progress value={progress} />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{progress}%</span>
              {pendingCount > 0 && <span>队列剩余 {pendingCount} 张</span>}
            </div>
          </div>
        )}

        {state === 'done' && (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>上传完成</AlertTitle>
            <AlertDescription>
              已添加到下方上传记录，可复制不同引用格式。
            </AlertDescription>
          </Alert>
        )}

        {state === 'error' && error && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>上传失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {state === 'uploading' && (
          <Button variant="outline" onClick={onCancel}>
            <UploadCloud data-icon="inline-start" />
            取消上传
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
