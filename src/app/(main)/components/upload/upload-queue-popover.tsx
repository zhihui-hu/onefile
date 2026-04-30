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
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
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
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 p-2">
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

  return (
    <div className="rounded-lg border bg-card p-2.5 text-card-foreground">
      <div className="flex items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileArchive />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm font-medium">
              {relativePath(task.file)}
            </div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatBytes(task.file.size)} · {task.objectKey}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Progress value={task.progress} className="flex-1" />
        <span className="w-9 text-right text-xs text-muted-foreground">
          {task.progress}%
        </span>
      </div>

      {task.error && (
        <div className="mt-1.5 text-xs text-destructive">{task.error}</div>
      )}

      <div className="mt-2 flex items-center justify-end gap-1">
        {(task.status === 'uploading' || task.status === 'preparing') && (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onPauseTask(task)}
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
            onClick={() => onResumeTask(task)}
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
            onClick={() => onResumeTask(task)}
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
              onClick={() => onCancelTask(task)}
              className="cursor-pointer"
            >
              <X />
              <span className="sr-only">取消上传</span>
            </Button>
          )}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => onRemoveTask(task)}
          className="cursor-pointer"
        >
          <Trash2 />
          <span className="sr-only">删除任务</span>
        </Button>
      </div>
    </div>
  );
}
