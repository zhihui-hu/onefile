'use client';

import type { FileItem } from '@/app/(main)/components/types';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Trash2 } from 'lucide-react';

import type { FileDeleteDialogProps, SetRowSelection } from './types';

export function SingleFileDeleteDialog({
  deleteTarget,
  deleting,
  onOpenChange,
  onDeleteFiles,
}: FileDeleteDialogProps & {
  deleteTarget: FileItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog open={Boolean(deleteTarget)} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="sm:max-w-md"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="p-0 text-left">
          <ResponsiveDialog.Title>删除对象</ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            将直接从当前 bucket 删除 {deleteTarget?.path}。
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Footer className="p-3">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              if (!deleteTarget) return;
              onDeleteFiles([deleteTarget]);
              onOpenChange(false);
            }}
          >
            <Trash2 data-icon="inline-start" />
            删除
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}

export function BulkFileDeleteDialog({
  open,
  deleting,
  selectedFiles,
  onOpenChange,
  onDeleteFiles,
  setRowSelection,
}: FileDeleteDialogProps & {
  open: boolean;
  selectedFiles: FileItem[];
  onOpenChange: (open: boolean) => void;
  setRowSelection: SetRowSelection;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="sm:max-w-md"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="p-0 text-left">
          <ResponsiveDialog.Title>批量删除文件</ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            将直接从当前 bucket 删除已选择的 {selectedFiles.length} 个文件。
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Footer className="p-3">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting || selectedFiles.length === 0}
            onClick={() => {
              const files = selectedFiles;
              if (!files.length) return;
              onDeleteFiles(files);
              onOpenChange(false);
              setRowSelection({});
            }}
          >
            <Trash2 data-icon="inline-start" />
            删除 {selectedFiles.length} 个文件
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
