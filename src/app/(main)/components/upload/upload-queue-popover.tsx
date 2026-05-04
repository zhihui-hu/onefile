'use client';

import { formatBytes } from '@/app/(main)/components/format';
import {
  type UploadStatus,
  type UploadTask,
} from '@/app/(main)/components/upload/upload-types';
import { relativePath } from '@/app/(main)/components/upload/upload-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileArchive,
  ListChecks,
  ListX,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

type UploadTaskStats = {
  active: number;
  completed: number;
  failed: number;
  finished: number;
  paused: number;
  totalProgress: number;
};

const statusMeta: Record<
  UploadStatus,
  {
    label: string;
    variant: React.ComponentProps<typeof Badge>['variant'];
  }
> = {
  queued: { label: '排队中', variant: 'outline' },
  preparing: { label: '准备中', variant: 'outline' },
  uploading: { label: '上传中', variant: 'default' },
  paused: { label: '已暂停', variant: 'secondary' },
  completed: { label: '已完成', variant: 'secondary' },
  failed: { label: '失败', variant: 'destructive' },
  aborted: { label: '已取消', variant: 'destructive' },
};

export function UploadQueuePopover({
  clearFinishedTasks,
  onCancelTask,
  onPauseTask,
  onRemoveTask,
  onResumeTask,
  onOpenChange,
  open,
  stats,
  tasks,
}: {
  clearFinishedTasks: () => void;
  onCancelTask: (task: UploadTask) => void;
  onPauseTask: (task: UploadTask) => void;
  onRemoveTask: (task: UploadTask) => void;
  onResumeTask: (task: UploadTask) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  stats: UploadTaskStats;
  tasks: UploadTask[];
}) {
  if (tasks.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
        >
          <ListChecks data-icon="inline-start" />
          {tasks.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(30rem,calc(100vw-2rem))] p-0"
      >
        <PopoverHeader className="gap-2 p-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <PopoverTitle>上传队列</PopoverTitle>
              <PopoverDescription>
                {stats.active > 0
                  ? `${stats.active} 个上传中`
                  : stats.paused > 0
                    ? `${stats.paused} 个已暂停`
                    : `${stats.completed} 个已完成`}
                {stats.failed > 0 ? `，${stats.failed} 个失败` : ''}
              </PopoverDescription>
            </div>
            {stats.finished > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFinishedTasks}
                className="cursor-pointer"
              >
                <ListX data-icon="inline-start" />
                清理
              </Button>
            )}
          </div>
          <Progress value={stats.totalProgress} />
        </PopoverHeader>
        <Separator />
        <TooltipProvider>
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {tasks.map((task) => (
                <UploadQueueItem
                  key={task.id}
                  task={task}
                  onCancelTask={onCancelTask}
                  onPauseTask={onPauseTask}
                  onRemoveTask={onRemoveTask}
                  onResumeTask={onResumeTask}
                />
              ))}
            </div>
          </ScrollArea>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

function UploadQueueItem({
  onCancelTask,
  onPauseTask,
  onRemoveTask,
  onResumeTask,
  task,
}: {
  onCancelTask: (task: UploadTask) => void;
  onPauseTask: (task: UploadTask) => void;
  onRemoveTask: (task: UploadTask) => void;
  onResumeTask: (task: UploadTask) => void;
  task: UploadTask;
}) {
  const meta = statusMeta[task.status];
  const filePath = relativePath(task.file);

  return (
    <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <FileArchive />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="block max-w-full truncate text-sm font-medium"
          title={filePath}
        >
          {filePath}
        </div>
        <div className="mt-1 grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="shrink-0">{formatBytes(task.file.size)}</span>
          <span className="block min-w-0 truncate" title={task.objectKey}>
            {task.objectKey}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Progress value={task.progress} className="min-w-0 flex-1" />
          <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
            {task.progress}%
          </span>
        </div>

        {task.error && (
          <div className="mt-1.5 break-words text-xs text-destructive">
            {task.error}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        {(task.status === 'uploading' || task.status === 'preparing') && (
          <UploadTaskAction label="暂停上传" onClick={() => onPauseTask(task)}>
            <Pause />
          </UploadTaskAction>
        )}
        {task.status === 'paused' && (
          <UploadTaskAction label="继续上传" onClick={() => onResumeTask(task)}>
            <Play />
          </UploadTaskAction>
        )}
        {(task.status === 'failed' || task.status === 'aborted') && (
          <UploadTaskAction label="重试上传" onClick={() => onResumeTask(task)}>
            <RotateCcw />
          </UploadTaskAction>
        )}
        {task.status !== 'completed' &&
          task.status !== 'failed' &&
          task.status !== 'aborted' &&
          task.status !== 'paused' && (
            <UploadTaskAction
              label="取消上传"
              onClick={() => onCancelTask(task)}
            >
              <X />
            </UploadTaskAction>
          )}
        <UploadTaskAction label="删除任务" onClick={() => onRemoveTask(task)}>
          <Trash2 />
        </UploadTaskAction>
      </div>
    </div>
  );
}

function UploadTaskAction({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClick}
          className="cursor-pointer"
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
