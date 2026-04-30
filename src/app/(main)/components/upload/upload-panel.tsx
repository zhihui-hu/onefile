'use client';

import {
  abortUpload,
  completeUpload,
  createUpload,
  createUploadPart,
  getSignedUrl,
} from '@/app/(main)/components/api';
import { formatBytes } from '@/app/(main)/components/format';
import { joinObjectKey } from '@/app/(main)/components/path';
import type {
  StorageBucket,
  UploadCompletePart,
  UploadMode,
} from '@/app/(main)/components/types';
import {
  MULTIPART_THRESHOLD,
  type UploadableFile,
  filesFromDataTransfer,
  filesFromFolderInput,
  partSizeFor,
  putSignedUrl,
  relativePath,
} from '@/app/(main)/components/upload/upload-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  FileArchive,
  FolderUp,
  Pause,
  Play,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type UploadStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

type UploadTask = {
  id: string;
  file: UploadableFile;
  objectKey: string;
  progress: number;
  status: UploadStatus;
  mode?: UploadMode;
  error?: string;
  uploadId?: string;
};

function statusVariant(status: UploadStatus) {
  if (status === 'failed' || status === 'aborted') return 'destructive';
  if (status === 'completed') return 'secondary';
  return 'outline';
}

export function UploadPanel({
  bucket,
  prefix,
  onCompleted,
  className,
}: {
  bucket: StorageBucket | null;
  prefix: string;
  onCompleted: () => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const controllersRef = useRef(new Map<string, AbortController>());
  const uploadIdsRef = useRef(new Map<string, string>());
  const pausedRef = useRef(new Set<string>());
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }, []);

  const uploadSingle = useCallback(
    async (task: UploadTask, uploadId: string, signal: AbortSignal) => {
      const init = await createUpload({
        bucket_id: bucket!.id,
        object_key: task.objectKey,
        original_filename: task.file.name,
        file_size: task.file.size,
        mime_type: task.file.type || 'application/octet-stream',
        upload_mode: 'single',
      });
      const url = getSignedUrl(init);
      const id = init.id || init.upload_id || uploadId;
      if (!url || !id) throw new Error('后端未返回单文件上传 URL。');

      uploadIdsRef.current.set(task.id, id);
      updateTask(task.id, { uploadId: id, status: 'uploading' });
      const etag = await putSignedUrl(
        url,
        task.file,
        init.headers,
        signal,
        (loaded) => {
          updateTask(task.id, {
            progress: Math.round((loaded / Math.max(task.file.size, 1)) * 100),
          });
        },
      );
      await completeUpload(id, { etag, object_key: task.objectKey });
    },
    [bucket, updateTask],
  );

  const uploadMultipart = useCallback(
    async (task: UploadTask, uploadId: string, signal: AbortSignal) => {
      const partSize = partSizeFor(task.file.size);
      const totalParts = Math.ceil(task.file.size / partSize);
      const init = await createUpload({
        bucket_id: bucket!.id,
        object_key: task.objectKey,
        original_filename: task.file.name,
        file_size: task.file.size,
        mime_type: task.file.type || 'application/octet-stream',
        upload_mode: 'multipart',
        part_size: partSize,
        total_parts: totalParts,
      });
      const id = init.id || init.upload_id || uploadId;
      if (!id) throw new Error('后端未返回分片上传 ID。');

      uploadIdsRef.current.set(task.id, id);
      updateTask(task.id, { uploadId: id, status: 'uploading' });

      let completedBytes = 0;
      let nextPart = 1;
      const activeProgress = new Map<number, number>();
      const completedParts: UploadCompletePart[] = [];
      const hardware =
        typeof navigator === 'undefined'
          ? 2
          : navigator.hardwareConcurrency || 2;
      const concurrency = Math.min(
        totalParts,
        Math.max(1, Math.min(6, hardware * 2)),
      );

      const reportProgress = () => {
        const activeBytes = Array.from(activeProgress.values()).reduce(
          (sum, value) => sum + value,
          0,
        );
        updateTask(task.id, {
          progress: Math.min(
            99,
            Math.round(((completedBytes + activeBytes) / task.file.size) * 100),
          ),
        });
      };

      async function worker() {
        while (nextPart <= totalParts && !signal.aborted) {
          const partNumber = nextPart;
          nextPart += 1;
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, task.file.size);
          const blob = task.file.slice(start, end);
          const signed = await createUploadPart(id, {
            part_number: partNumber,
            content_length: blob.size,
          });
          const url = getSignedUrl(signed);
          if (!url) throw new Error(`第 ${partNumber} 片缺少上传 URL。`);

          const etag = await putSignedUrl(
            url,
            blob,
            signed.headers,
            signal,
            (loaded) => {
              activeProgress.set(partNumber, loaded);
              reportProgress();
            },
          );
          activeProgress.delete(partNumber);
          completedBytes += blob.size;
          completedParts.push({ part_number: partNumber, etag });
          reportProgress();
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      await completeUpload(id, {
        object_key: task.objectKey,
        parts: completedParts.sort((a, b) => a.part_number - b.part_number),
      });
    },
    [bucket, updateTask],
  );

  const runTask = useCallback(
    async (task: UploadTask) => {
      const controller = new AbortController();
      controllersRef.current.set(task.id, controller);
      const mode: UploadMode =
        task.file.size >= MULTIPART_THRESHOLD ? 'multipart' : 'single';
      updateTask(task.id, { mode, status: 'preparing' });

      try {
        if (mode === 'single') {
          await uploadSingle(task, task.id, controller.signal);
        } else {
          await uploadMultipart(task, task.id, controller.signal);
        }
        updateTask(task.id, { progress: 100, status: 'completed' });
        onCompleted();
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === 'AbortError';
        const uploadId = uploadIdsRef.current.get(task.id);
        if (uploadId) await abortUpload(uploadId).catch(() => undefined);
        if (pausedRef.current.has(task.id)) {
          updateTask(task.id, {
            status: 'paused',
            error: undefined,
          });
          return;
        }
        updateTask(task.id, {
          status: aborted ? 'aborted' : 'failed',
          error: error instanceof Error ? error.message : '上传失败',
        });
      } finally {
        controllersRef.current.delete(task.id);
        uploadIdsRef.current.delete(task.id);
      }
    },
    [onCompleted, updateTask, uploadMultipart, uploadSingle],
  );

  const enqueueFiles = useCallback(
    (files: UploadableFile[]) => {
      if (!bucket) {
        toast.error('请先选择 bucket。');
        return;
      }

      const nextTasks = files
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          objectKey: joinObjectKey(prefix, relativePath(file)),
          progress: 0,
          status: 'queued' as UploadStatus,
        }))
        .filter((task) => Boolean(task.objectKey));

      if (!nextTasks.length) return;
      setTasks((current) => [...nextTasks, ...current].slice(0, 30));
      nextTasks.forEach((task) => void runTask(task));
    },
    [bucket, prefix, runTask],
  );

  const cancelTask = async (task: UploadTask) => {
    pausedRef.current.delete(task.id);
    controllersRef.current.get(task.id)?.abort();
    const uploadId = uploadIdsRef.current.get(task.id) || task.uploadId;
    if (uploadId) await abortUpload(uploadId).catch(() => undefined);
    updateTask(task.id, { status: 'aborted' });
  };

  const pauseTask = (task: UploadTask) => {
    pausedRef.current.add(task.id);
    controllersRef.current.get(task.id)?.abort();
  };

  const resumeTask = (task: UploadTask) => {
    pausedRef.current.delete(task.id);
    updateTask(task.id, {
      progress: 0,
      status: 'queued',
      error: undefined,
      uploadId: undefined,
    });
    void runTask({
      ...task,
      progress: 0,
      status: 'queued',
      uploadId: undefined,
    });
  };

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      enqueueFiles(Array.from(files) as UploadableFile[]);
    };

    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [enqueueFiles]);

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setDragOver(false);
        enqueueFiles(
          await filesFromDataTransfer(
            event.dataTransfer.items,
            event.dataTransfer.files,
          ),
        );
      }}
      data-drag-over={dragOver}
    >
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={!bucket}
                    className="cursor-pointer"
                  >
                    <Upload data-icon="inline-start" />
                    上传
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                支持拖入文件或文件夹，也可粘贴剪贴板中的文件
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <Upload />
                选择文件
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => folderInputRef.current?.click()}
              >
                <FolderUp />
                选择文件夹
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (event) => {
          if (event.target.files) {
            enqueueFiles(Array.from(event.target.files) as UploadableFile[]);
          }
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (event) => {
          if (event.target.files) {
            enqueueFiles(await filesFromFolderInput(event.target.files));
          }
          event.currentTarget.value = '';
        }}
        {...{ webkitdirectory: '', directory: '' }}
      />

      {tasks.length > 0 && (
        <ScrollArea className="max-h-56">
          <div className="flex flex-col gap-2 pr-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg bg-muted/40 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <FileArchive />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {relativePath(task.file)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(task.file.size)} · {task.objectKey}
                    </div>
                  </div>
                  <Badge variant={statusVariant(task.status)}>
                    {task.status}
                  </Badge>
                  {(task.status === 'uploading' ||
                    task.status === 'preparing') && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => pauseTask(task)}
                      className="cursor-pointer"
                    >
                      <Pause />
                      <span className="sr-only">暂停上传</span>
                    </Button>
                  )}
                  {task.status === 'paused' && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => resumeTask(task)}
                      className="cursor-pointer"
                    >
                      <Play />
                      <span className="sr-only">继续上传</span>
                    </Button>
                  )}
                  {(task.status === 'failed' || task.status === 'aborted') && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => resumeTask(task)}
                      className="cursor-pointer"
                    >
                      <RotateCcw />
                      <span className="sr-only">重试上传</span>
                    </Button>
                  )}
                  {task.status !== 'completed' &&
                    task.status !== 'failed' &&
                    task.status !== 'aborted' &&
                    task.status !== 'paused' && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => void cancelTask(task)}
                        className="cursor-pointer"
                      >
                        <X />
                        <span className="sr-only">取消上传</span>
                      </Button>
                    )}
                </div>
                <Progress value={task.progress} />
                {task.error && (
                  <div className="mt-1 text-xs text-destructive">
                    {task.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
