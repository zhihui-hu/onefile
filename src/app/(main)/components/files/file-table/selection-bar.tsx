'use client';

import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';

import type { FileSelectionBarProps } from './types';

export function FileSelectionBar({
  deleting,
  selectedFiles,
  onClearSelection,
  onOpenBulkDelete,
}: FileSelectionBarProps) {
  if (selectedFiles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-background p-2 shadow-lg">
        <span className="px-2 text-sm text-muted-foreground">
          已选择 {selectedFiles.length} 个文件
        </span>
        <Button size="sm" variant="outline" onClick={onClearSelection}>
          <X data-icon="inline-start" />
          取消
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={onOpenBulkDelete}
        >
          <Trash2 data-icon="inline-start" />
          删除
        </Button>
      </div>
    </div>
  );
}
