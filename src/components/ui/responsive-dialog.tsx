'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/use-media-query';
import { XIcon } from 'lucide-react';
import * as React from 'react';

type ResponsiveDialogContextValue = {
  isMobile: boolean;
};

const ResponsiveDialogContext =
  React.createContext<ResponsiveDialogContextValue | null>(null);

const useResponsiveContext = () => {
  const context = React.useContext(ResponsiveDialogContext);
  if (!context) {
    throw new Error(
      'Responsive dialog components must be used within <ResponsiveDialogRoot>',
    );
  }
  return context;
};

type ResponsiveDialogRootProps = React.ComponentProps<typeof Dialog> & {
  /**
   * 媒体查询断点，默认 768px 以下视为移动端
   */
  breakpoint?: string;
};

function ResponsiveDialogRoot({
  children,
  breakpoint = '(max-width: 768px)',
  ...props
}: ResponsiveDialogRootProps) {
  const isMobile = useMediaQuery(breakpoint);

  const value = React.useMemo<ResponsiveDialogContextValue>(
    () => ({ isMobile }),
    [isMobile],
  );

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={value}>
        <Drawer open={props.open} onOpenChange={props.onOpenChange}>
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={value}>
      <Dialog {...props}>{children}</Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerTrigger {...props} />;
  }
  return <DialogTrigger {...props} />;
}

type ResponsiveDialogContentProps = React.ComponentProps<
  typeof DialogContent
> & {
  drawerClassName?: string;
};

function ResponsiveDialogContent({
  className,
  drawerClassName,
  showCloseButton,
  children,
  ...props
}: ResponsiveDialogContentProps) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return (
      <DrawerContent className={drawerClassName} {...props}>
        <div className="flex flex-1 flex-col overflow-hidden px-4 py-4">
          {children}
        </div>
        {showCloseButton !== false && (
          <DrawerClose asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2 z-10"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        )}
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      className={className}
      showCloseButton={showCloseButton}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader(
  props: React.ComponentProps<typeof DialogHeader>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerHeader {...props} />;
  }
  return <DialogHeader {...props} />;
}

function ResponsiveDialogTitle(
  props: React.ComponentProps<typeof DialogTitle>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerTitle {...props} />;
  }
  return <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(
  props: React.ComponentProps<typeof DialogDescription>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerDescription {...props} />;
  }
  return <DialogDescription {...props} />;
}

function ResponsiveDialogFooter(
  props: React.ComponentProps<typeof DialogFooter>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerFooter {...props} />;
  }
  return <DialogFooter {...props} />;
}

function ResponsiveDialogClose(
  props: React.ComponentProps<typeof DialogClose>,
) {
  const { isMobile } = useResponsiveContext();
  if (isMobile) {
    return <DrawerClose {...props} />;
  }
  return <DialogClose {...props} />;
}

export const ResponsiveDialog = Object.assign(ResponsiveDialogRoot, {
  Trigger: ResponsiveDialogTrigger,
  Content: ResponsiveDialogContent,
  Header: ResponsiveDialogHeader,
  Title: ResponsiveDialogTitle,
  Description: ResponsiveDialogDescription,
  Footer: ResponsiveDialogFooter,
  Close: ResponsiveDialogClose,
});
