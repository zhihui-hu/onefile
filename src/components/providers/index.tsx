import BuildInfo from '@/components/build-info';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

import { QueryProvider } from './query';
import { ThemeProvider } from './theme';

export function Providers({ children }: React.PropsWithChildren) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <BuildInfo />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </QueryProvider>
  );
}
