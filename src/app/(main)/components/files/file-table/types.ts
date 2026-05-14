import type { FileItem, StorageBucket } from '@/app/(main)/components/types';
import type { RowSelectionState } from '@tanstack/react-table';

export type FileTableActions = {
  bucket: StorageBucket | null;
  deleting: boolean;
  onCopyLink: (url: string | null) => void;
  onOpenFolder: (item: FileItem) => void;
  onOpenItem: (item: FileItem, publicUrl: string | null) => void;
  onRequestDelete: (item: FileItem) => void;
};

export type FileDeleteDialogProps = {
  deleting: boolean;
  onDeleteFiles: (items: FileItem[]) => void;
};

export type FileSelectionBarProps = {
  deleting: boolean;
  selectedFiles: FileItem[];
  onClearSelection: () => void;
  onOpenBulkDelete: () => void;
};

export type SetRowSelection = (selection: RowSelectionState) => void;
