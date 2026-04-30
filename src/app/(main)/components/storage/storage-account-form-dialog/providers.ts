import type { ProviderId } from '@/app/(main)/components/types';

export const PROVIDERS = [
  { value: 'r2', label: 'Cloudflare R2', domain: 'cloudflare.com' },
  { value: 'aws', label: 'AWS S3', domain: 'aws.amazon.com' },
  { value: 'aliyun', label: '阿里云 OSS', domain: 'alibabacloud.com' },
  { value: 'tencent', label: '腾讯云 COS', domain: 'cloud.tencent.com' },
  { value: 'oracle', label: '甲骨文 OS', domain: 'oracle.com' },
] as const;

export type ProviderValue = (typeof PROVIDERS)[number]['value'];

export const providerValueToId: Record<ProviderValue, ProviderId> = {
  r2: 'r2',
  aws: 's3',
  aliyun: 'aliyun_oss',
  tencent: 'tencent_cos',
  oracle: 'oci',
};

export const providerIdToValue: Partial<Record<ProviderId, ProviderValue>> = {
  r2: 'r2',
  s3: 'aws',
  aliyun_oss: 'aliyun',
  tencent_cos: 'tencent',
  oci: 'oracle',
};

const providerDomainById: Record<ProviderId, string> = {
  s3: 'aws.amazon.com',
  r2: 'cloudflare.com',
  b2: 'backblaze.com',
  oci: 'oracle.com',
  aliyun_oss: 'alibabacloud.com',
  tencent_cos: 'cloud.tencent.com',
};

export const providerValues = PROVIDERS.map((provider) => provider.value) as [
  ProviderValue,
  ...ProviderValue[],
];

export function faviconUrl(domain: string, size = 64) {
  const d = domain.replace(/^https?:\/\//, '');
  const iconSize = Math.max(size, 64);
  return `https://www.google.com/s2/favicons?sz=${iconSize}&domain=${encodeURIComponent(d)}`;
}

export function providerIconUrl(provider: ProviderId, size = 28) {
  return faviconUrl(providerDomainById[provider], size);
}

export function providerMetaFromValue(value: ProviderValue) {
  return PROVIDERS.find((provider) => provider.value === value) || PROVIDERS[0];
}
