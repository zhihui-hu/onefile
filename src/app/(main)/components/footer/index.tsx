'use client';

import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
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
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="xs" asChild>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noreferrer"
            title="GitHub"
          >
            GitHub
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
        <div className="truncate">
          {siteConfig.title} v{siteConfig.version}
        </div>
      </div>
    </footer>
  );
}
