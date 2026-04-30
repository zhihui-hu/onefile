import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import gsap from 'gsap';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

import {
  PROVIDERS,
  type ProviderValue,
  faviconUrl,
  providerMetaFromValue,
} from './providers';

export function ProviderTabs({
  value,
  onValueChange,
}: {
  value: ProviderValue;
  onValueChange: (value: ProviderValue) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const triggerRefs = useRef<
    Partial<Record<ProviderValue, HTMLButtonElement | null>>
  >({});

  useEffect(() => {
    const list = listRef.current;
    const highlight = highlightRef.current;
    const trigger = triggerRefs.current[value];
    if (!list || !highlight || !trigger) return;

    const moveHighlight = (animate: boolean) => {
      trigger.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: animate ? 'smooth' : 'auto',
      });
      const vars = {
        x: trigger.offsetLeft,
        y: trigger.offsetTop,
        width: trigger.offsetWidth,
        height: trigger.offsetHeight,
        ease: 'power3.out',
      };

      if (animate) {
        gsap.to(highlight, { ...vars, duration: 0.28 });
      } else {
        gsap.set(highlight, vars);
      }
    };

    moveHighlight(true);
    const handleResize = () => moveHighlight(false);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      gsap.killTweensOf(highlight);
    };
  }, [value]);

  return (
    <Tabs
      className="min-w-0 max-w-full overflow-hidden"
      value={value}
      onValueChange={(next) => onValueChange(next as ProviderValue)}
    >
      <TabsList
        variant="line"
        ref={listRef}
        className="relative flex !h-auto min-h-12 w-full max-w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-lg  bg-muted/40 p-1"
      >
        <span
          ref={highlightRef}
          className="pointer-events-none absolute left-0 top-0 rounded-md  bg-white dark:bg-primary shadow-sm"
        />
        {PROVIDERS.map((item) => (
          <TabsTrigger
            key={item.value}
            ref={(node) => {
              triggerRefs.current[item.value] = node;
            }}
            value={item.value}
            className={cn(
              'relative z-10 min-h-10 w-36 flex-none justify-start gap-2 bg-transparent px-3 py-2 text-muted-foreground after:hidden data-active:bg-transparent data-active:text-foreground data-active:shadow-none',
              'dark:data-active:bg-transparent dark:data-active:text-foreground',
            )}
          >
            <Image
              alt=""
              width={22}
              height={22}
              className="size-5.5 rounded-md"
              src={faviconUrl(item.domain)}
              unoptimized
            />
            <span className="truncate">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function ProviderSummary({ value }: { value: ProviderValue }) {
  const item = providerMetaFromValue(value);

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2">
      <Image
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-md"
        src={faviconUrl(item.domain)}
        unoptimized
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.label}</div>
        <div className="text-xs text-muted-foreground">仓商不可修改</div>
      </div>
    </div>
  );
}
