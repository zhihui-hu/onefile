'use client';

import { siteConfig } from '@/config/site';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

export default function Footer() {
  const [hostname, setHostname] = useState<string>();
  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);
  return (
    <footer className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <div className="truncate">
        2018 - {format(new Date(), 'yyyy')} © {hostname}. All rights reserved.
      </div>
      <div className="truncate">
        {siteConfig.title} v{siteConfig.version}
      </div>
    </footer>
  );
}
