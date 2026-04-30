import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return '-';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;

  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}

export function absoluteDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function providerLabel(provider?: string | null) {
  const labels: Record<string, string> = {
    s3: 'AWS S3',
    r2: 'Cloudflare R2',
    b2: 'Backblaze B2',
    oci: 'OCI Object Storage',
    aliyun_oss: '阿里云 OSS',
    tencent_cos: '腾讯云 COS',
  };

  return provider ? labels[provider] || provider : 'Object Storage';
}
