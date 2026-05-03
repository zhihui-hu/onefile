export type UploadState = 'idle' | 'uploading' | 'done' | 'error';
export type UploadOutcome = 'success' | 'error' | 'aborted';

export type ImageDimensions = {
  width: number;
  height: number;
};

export type StoredUpload = {
  id: string;
  name: string;
  bucketName?: string | null;
  objectKey?: string | null;
  mimeType?: string | null;
  size?: number | null;
  originalSize?: number | null;
  compressed?: boolean | null;
  url: string;
  uploadedAt: string;
};
