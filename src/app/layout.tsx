import { Providers } from '@/components/providers';
import { siteConfig } from '@/config/site';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import './globals.css';

const font = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const jsonLd = siteConfig.jsonLd
  ? JSON.stringify(siteConfig.jsonLd).replace(/</g, '\\u003c')
  : null;

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  keywords: siteConfig.keywords.toString(),
  openGraph: {
    title: siteConfig.og.title,
    description: siteConfig.og.description,
    url: siteConfig.og.url,
    type: siteConfig.og.type as 'website',
    images: siteConfig.og.image,
  },
  twitter: {
    card: siteConfig.twitter.card as 'summary_large_image',
    title: siteConfig.twitter.title,
    description: siteConfig.twitter.description,
    images: siteConfig.twitter.image,
  },
  // 建议与 og.url 同步，利于生成绝对 URL
  metadataBase: new URL(siteConfig.og.url),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
        <meta name="renderer" content="webkit" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="icon"
          href="/favicon-32x32.png"
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href="/favicon-16x16.png"
          type="image/png"
          sizes="16x16"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <meta
          name="theme-color"
          content="#FFFFFF"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#000000"
          media="(prefers-color-scheme: dark)"
        />
        {jsonLd && (
          <script
            id="onefile-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isIE = /MSIE|Trident/.test(navigator.userAgent);
                var isOldIE = /MSIE [1-9]\\.|MSIE 10\\./.test(navigator.userAgent);
                if (isOldIE) {
                  window.location.href = '/ie.html';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={font.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
