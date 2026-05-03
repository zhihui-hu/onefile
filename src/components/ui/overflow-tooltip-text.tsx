'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type OverflowTooltipTextProps = Omit<
  React.ComponentProps<'span'>,
  'children'
> & {
  children: React.ReactNode;
  contentClassName?: string;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  tooltip?: React.ReactNode;
};

export function OverflowTooltipText({
  children,
  className,
  contentClassName,
  onFocus,
  onPointerEnter,
  side = 'top',
  tooltip,
  ...props
}: OverflowTooltipTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);

  const checkOverflow = useCallback(() => {
    const node = textRef.current;
    if (!node) return;

    const nextOverflowed = node.scrollWidth > node.clientWidth + 1;
    setOverflowed((current) =>
      current === nextOverflowed ? current : nextOverflowed,
    );
  }, []);

  useEffect(() => {
    const node = textRef.current;
    checkOverflow();

    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(node);

    return () => observer.disconnect();
  }, [checkOverflow, children]);

  const trigger = (
    <span
      ref={textRef}
      className={cn('block min-w-0 truncate', className)}
      onFocus={(event) => {
        checkOverflow();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        checkOverflow();
        onPointerEnter?.(event);
      }}
      {...props}
    >
      {children}
    </span>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={overflowed ? undefined : false}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        {overflowed && (
          <TooltipContent side={side} className={contentClassName}>
            {tooltip ?? children}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
