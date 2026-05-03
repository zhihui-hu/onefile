'use client';

import { publicUpload } from '@/app/(main)/components/api';
import { formatBytes } from '@/app/(main)/components/format';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type {
  ImageDimensions,
  StoredUpload,
  UploadOutcome,
  UploadState,
} from './types';
import { UploadHistory } from './upload-history';
import { UploadPanel } from './upload-panel';
import {
  HISTORY_LIMIT,
  filesFromClipboard,
  filesFromDataTransfer,
  hasFileTransfer,
  readUploadHistory,
  storedUploadFromResult,
  writeUploadHistory,
} from './utils';

export function PublicUploadPage({ uuid }: { uuid: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<File[]>([]);
  const processingRef = useRef(false);
  const dragDepthRef = useRef(0);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<StoredUpload[]>([]);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, ImageDimensions>
  >({});

  useEffect(() => {
    setUploads(readUploadHistory(uuid));
  }, [uuid]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const activeFileLabel = useMemo(() => {
    if (!activeFile) return '选择、拖拽或粘贴图片后会自动上传';
    return `${activeFile.name} · ${activeFile.type || 'image'} · ${formatBytes(
      activeFile.size,
    )}`;
  }, [activeFile]);

  const saveUpload = useCallback(
    (upload: StoredUpload) => {
      setUploads((current) => {
        const next = [
          upload,
          ...current.filter((item) => item.id !== upload.id),
        ].slice(0, HISTORY_LIMIT);
        writeUploadHistory(uuid, next);
        return next;
      });
    },
    [uuid],
  );

  const copyText = async (value: string, message = '已复制') => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const uploadOne = useCallback(
    async (nextFile: File): Promise<UploadOutcome> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveFile(nextFile);
      setState('uploading');
      setError('');
      setProgress(0);

      try {
        const data = await publicUpload(
          uuid,
          nextFile,
          controller.signal,
          (loaded, total) => {
            setProgress(Math.round((loaded / total) * 100));
          },
        );
        const uploadRecord = storedUploadFromResult(data, nextFile);
        saveUpload(uploadRecord);
        setProgress(100);
        return 'success';
      } catch (uploadError) {
        if (
          uploadError instanceof DOMException &&
          uploadError.name === 'AbortError'
        ) {
          return 'aborted';
        }
        setError(
          uploadError instanceof Error ? uploadError.message : '上传失败',
        );
        setState('error');
        return 'error';
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [saveUpload, uuid],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;

    processingRef.current = true;
    let successCount = 0;
    let errorCount = 0;

    try {
      while (queueRef.current.length > 0) {
        const nextFile = queueRef.current.shift();
        setPendingCount(queueRef.current.length);

        if (!nextFile) continue;

        const outcome = await uploadOne(nextFile);
        if (outcome === 'success') successCount += 1;
        if (outcome === 'error') errorCount += 1;
        if (outcome === 'aborted') break;
      }

      setActiveFile(null);
      setPendingCount(queueRef.current.length);

      if (successCount > 0) {
        setState('done');
        toast.success(
          successCount === 1 ? '上传完成' : `已上传 ${successCount} 张图片`,
        );
      } else if (errorCount === 0) {
        setState('idle');
      }
    } finally {
      processingRef.current = false;
    }
  }, [uploadOne]);

  const enqueueFiles = useCallback(
    (nextFiles: File[]) => {
      if (nextFiles.length === 0) return;

      const imageFiles = nextFiles.filter((nextFile) =>
        nextFile.type.startsWith('image/'),
      );

      if (imageFiles.length === 0) {
        setError('请选择图片文件。');
        setState('error');
        return;
      }

      const skippedCount = nextFiles.length - imageFiles.length;
      if (skippedCount > 0) {
        toast.error(`已跳过 ${skippedCount} 个非图片文件`);
      }

      queueRef.current.push(...imageFiles);
      setPendingCount(queueRef.current.length);
      setError('');
      void processQueue();
    },
    [processQueue],
  );

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = filesFromClipboard(event.clipboardData);
      if (files.length === 0) return;

      event.preventDefault();
      enqueueFiles(files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [enqueueFiles]);

  const cancelUploads = () => {
    queueRef.current = [];
    setPendingCount(0);
    abortRef.current?.abort();
  };

  const updateImageDimensions = (id: string, dimensions: ImageDimensions) => {
    setImageDimensions((current) => {
      const currentDimensions = current[id];
      if (
        currentDimensions?.width === dimensions.width &&
        currentDimensions.height === dimensions.height
      ) {
        return current;
      }

      return {
        ...current,
        [id]: dimensions,
      };
    });
  };

  return (
    <main
      className={cn(
        'h-dvh overflow-y-auto bg-background overscroll-contain transition-colors',
        dragging && 'bg-muted/40',
      )}
      onDragEnter={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragging(false);
        enqueueFiles(filesFromDataTransfer(event.dataTransfer));
      }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:py-10">
        <UploadPanel
          inputRef={inputRef}
          dragging={dragging}
          state={state}
          activeFileLabel={activeFileLabel}
          progress={progress}
          pendingCount={pendingCount}
          error={error}
          onFiles={enqueueFiles}
          onCancel={cancelUploads}
        />
        <UploadHistory
          uploads={uploads}
          imageDimensions={imageDimensions}
          onDimensionsChange={updateImageDimensions}
          onCopy={copyText}
        />
      </div>
    </main>
  );
}
