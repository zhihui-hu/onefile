import pkg from '../../package.json';

export const siteConfig = {
  title: 'OneFile - 多云对象存储上传与管理平台',
  version: pkg.version,
  githubUrl: 'https://github.com/zhihui-hu/onefile',
  description:
    'OneFile 是一个聚合上传平台，支持 OSS、COS、Cloudflare R2、AWS S3、Oracle Object Storage 等多云存储，提供大文件分片上传、断点续传与跨云文件管理。',
  keywords: [
    'OneFile',
    '文件上传',
    '大文件分片上传',
    '对象存储',
    'OSS',
    'COS',
    'R2',
    'S3',
    'Oracle Object Storage',
    '多云存储',
    '聚合上传',
    '云存储管理',
  ],
  og: {
    title: 'OneFile - 聚合对象存储上传平台',
    description:
      'OneFile 是一个多云文件上传与对象存储管理平台，支持 OSS、COS、Cloudflare R2、AWS S3、Oracle Object Storage 等云存储服务，提供大文件分片上传、断点续传与跨云文件统一管理。',
    image: 'https://onefile.huzhihui.com/pwa-512x512.png',
    url: 'https://onefile.huzhihui.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OneFile - 聚合对象存储上传平台',
    description:
      '多云对象存储聚合上传，支持 OSS、COS、R2、S3，大文件分片上传与断点续传。',
    image: 'https://onefile.huzhihui.com/pwa-512x512.png',
  },
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OneFile',
    url: 'https://onefile.huzhihui.com',
    description:
      'OneFile 是一个聚合上传平台，支持 OSS、COS、Cloudflare R2、AWS S3、Oracle Object Storage 等多云存储，提供大文件分片上传、断点续传与跨云文件管理。',
    publisher: {
      '@type': 'Organization',
      name: 'OneFile',
      logo: {
        '@type': 'ImageObject',
        image: 'https://onefile.huzhihui.com/pwa-512x512.png',
      },
    },
  },
} as const;
