'use client';

import {
  abortUpload,
  completeUpload,
  createUpload,
  directUpload,
  proxyUploadPart,
} from '@/app/(main)/components/api';
import { joinObjectKey } from '@/app/(main)/components/path';
import type {
  StorageBucket,
  UploadCompletePart,
  UploadMode,
} from '@/app/(main)/components/types';
import { UploadQueuePopover } from '@/app/(main)/components/upload/upload-queue-popover';
import {
  type UploadStatus,
  type UploadTask,
  isActiveTask,
  isFinishedTask,
} from '@/app/(main)/components/upload/upload-types';
import {
  MULTIPART_THRESHOLD,
  type UploadableFile,
  filesFromDataTransfer,
  filesFromFolderInput,
  partSizeFor,
  putSignedUrl,
  relativePath,
} from '@/app/(main)/components/upload/upload-utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FolderUp, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

function throwIfUploadAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException('Upload aborted', 'AbortError');
  }
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
  const [queueOpen, setQueueOpen] = useState(false);

  const taskStats = useMemo(() => {
    const active = tasks.filter(isActiveTask).length;
    const completed = tasks.filter(
      (task) => task.status === 'completed',
    ).length;
    const failed = tasks.filter((task) => task.status === 'failed').length;
    const paused = tasks.filter((task) => task.status === 'paused').length;
    const finished = tasks.filter(isFinishedTask).length;
    const totalProgress = tasks.length
      ? Math.round(
          tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length,
        )
      : 0;

    return { active, completed, failed, finished, paused, totalProgress };
  }, [tasks]);

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }, []);

  const uploadSingle = useCallback(
    async (task: UploadTask, uploadId: string, signal: AbortSignal) => {
      uploadIdsRef.current.set(task.id, uploadId);
      updateTask(task.id, { uploadId, status: 'uploading' });
      const uploaded = await directUpload(
        {
          bucket_id: bucket!.id,
          file: task.file,
          object_key: task.objectKey,
          original_filename: task.file.name,
        },
        signal,
        (loaded, total) => {
          updateTask(task.id, {
            progress: Math.min(
              99,
              Math.round((loaded / Math.max(total, task.file.size, 1)) * 100),
            ),
          });
        },
      );
      throwIfUploadAborted(signal);
      const id = uploaded.id || uploaded.upload_id || uploadId;
      uploadIdsRef.current.set(task.id, id);
      updateTask(task.id, { uploadId: id });
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
          const result = await proxyUploadPart(
            id,
            partNumber,
            blob,
            signal,
            (loaded) => {
              activeProgress.set(partNumber, loaded);
              reportProgress();
            },
          );
          const etag = result.etag;
          activeProgress.delete(partNumber);
          completedBytes += blob.size;
          completedParts.push({ part_number: partNumber, etag });
          reportProgress();
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      throwIfUploadAborted(signal);
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
      setQueueOpen(true);
      nextTasks.forEach((task) => void runTask(task));
    },
    [bucket, prefix, runTask],
  );

  const cancelTask = useCallback(
    (task: UploadTask) => {
      pausedRef.current.delete(task.id);
      controllersRef.current.get(task.id)?.abort();
      const uploadId = uploadIdsRef.current.get(task.id) || task.uploadId;
      updateTask(task.id, { status: 'aborted' });
      if (uploadId) void abortUpload(uploadId).catch(() => undefined);
    },
    [updateTask],
  );

  const removeTask = useCallback((task: UploadTask) => {
    pausedRef.current.delete(task.id);
    controllersRef.current.get(task.id)?.abort();
    controllersRef.current.delete(task.id);

    const uploadId = uploadIdsRef.current.get(task.id) || task.uploadId;
    uploadIdsRef.current.delete(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));

    if (uploadId && task.status !== 'completed') {
      void abortUpload(uploadId).catch(() => undefined);
    }
  }, []);

  const clearFinishedTasks = useCallback(() => {
    for (const task of tasks) {
      if (isFinishedTask(task)) {
        pausedRef.current.delete(task.id);
        uploadIdsRef.current.delete(task.id);
      }
    }

    setTasks((current) => current.filter((task) => !isFinishedTask(task)));
  }, [tasks]);

  const pauseTask = useCallback((task: UploadTask) => {
    pausedRef.current.add(task.id);
    controllersRef.current.get(task.id)?.abort();
  }, []);

  const resumeTask = useCallback(
    (task: UploadTask) => {
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
    },
    [runTask, updateTask],
  );

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
                    className={cn(
                      'cursor-pointer',
                      dragOver && 'ring-3 ring-ring/50',
                    )}
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

        <UploadQueuePopover
          clearFinishedTasks={clearFinishedTasks}
          onCancelTask={(task) => void cancelTask(task)}
          onOpenChange={setQueueOpen}
          onPauseTask={pauseTask}
          onRemoveTask={(task) => void removeTask(task)}
          onResumeTask={resumeTask}
          open={queueOpen}
          stats={taskStats}
          tasks={tasks}
        />
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
    </div>
  );
}
