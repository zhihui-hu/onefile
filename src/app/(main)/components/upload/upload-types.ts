import type { UploadMode } from '@/app/(main)/components/types';
import type { UploadableFile } from '@/app/(main)/components/upload/upload-utils';

export type UploadStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type UploadTask = {
  id: string;
  file: UploadableFile;
  objectKey: string;
  progress: number;
  status: UploadStatus;
  mode?: UploadMode;
  error?: string;
  uploadId?: string;
};

const activeStatuses = new Set<UploadStatus>(['preparing', 'uploading']);
const finishedStatuses = new Set<UploadStatus>([
  'completed',
  'failed',
  'aborted',
]);

export function isActiveTask(task: UploadTask) {
  return activeStatuses.has(task.status);
}

export function isFinishedTask(task: UploadTask) {
  return finishedStatuses.has(task.status);
}
