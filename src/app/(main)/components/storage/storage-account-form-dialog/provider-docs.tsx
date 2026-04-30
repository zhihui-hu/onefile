'use client';

import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpenText, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { PROVIDERS, type ProviderValue, faviconUrl } from './providers';

type ProviderDocItem = {
  title: string;
  description: ReactNode;
  links?: Array<{ label: string; href: string }>;
};

const PROVIDER_DOCS: Record<ProviderValue, ProviderDocItem[]> = {
  r2: [
    {
      title: 'Account ID',
      description:
        '登录 Cloudflare 仪表盘，在 Workers & Pages 或账户设置页面复制 Account ID。',
      links: [
        {
          label: '查找 Account ID',
          href: 'https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/',
        },
      ],
    },
    {
      title: 'Access Key 与 Secret',
      description:
        '进入 R2 的密钥管理页面创建访问密钥，按最小权限授权后复制 Access Key ID 与 Secret Access Key。',
      links: [
        {
          label: 'R2 密钥文档',
          href: 'https://developers.cloudflare.com/r2/api/tokens/',
        },
        {
          label: '创建访问密钥',
          href: 'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/',
        },
      ],
    },
    {
      title: 'Endpoint',
      description:
        '本项目会根据 Account ID 自动生成 https://<ACCOUNT_ID>.r2.cloudflarestorage.com。',
      links: [
        {
          label: 'R2 S3 API',
          href: 'https://developers.cloudflare.com/r2/api/s3/api/',
        },
      ],
    },
  ],
  aws: [
    {
      title: 'Access Key 与 Secret',
      description:
        '在 AWS IAM 控制台进入 Users，选择用户后从 Security credentials 创建 access key。',
      links: [
        {
          label: '管理访问密钥',
          href: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
        },
      ],
    },
    {
      title: 'Region 与 Endpoint',
      description:
        'Region 按 bucket 所在区域填写。标准 AWS S3 通常可以留空 Endpoint；兼容 S3 服务再填写自定义地址。',
    },
  ],
  aliyun: [
    {
      title: 'AccessKey ID 与 Secret',
      description:
        '建议为 RAM 用户创建最小权限策略，再在 AccessKey 管理中创建 AccessKey。',
      links: [
        {
          label: '创建 AccessKey',
          href: 'https://www.alibabacloud.com/help/en/ram/user-guide/create-an-accesskey-pair',
        },
      ],
    },
    {
      title: 'Region',
      description:
        'Region 留空默认 cn-hangzhou，保存时会根据 Region 使用 OSS Endpoint。',
    },
  ],
  tencent: [
    {
      title: 'AppID',
      description:
        '登录腾讯云控制台，在账号信息页查看 AppID。COS 访问对象时会使用 bucket-appid 的命名规则。',
      links: [
        {
          label: 'API 密钥管理',
          href: 'https://www.tencentcloud.com/document/product/598/32675',
        },
      ],
    },
    {
      title: 'SecretId 与 SecretKey',
      description:
        '进入访问管理 CAM 的 API 密钥管理页面，创建并复制 SecretId 与 SecretKey。',
      links: [
        {
          label: 'API 鉴权文档',
          href: 'https://www.tencentcloud.com/document/product/214/1526',
        },
      ],
    },
  ],
  oracle: [
    {
      title: 'Tenancy OCID、Namespace 与 Region',
      description:
        'Tenancy OCID 在租户详情页查看；Namespace 可留空自动获取；Region 填当前 Object Storage 所在区域。',
      links: [
        {
          label: '定位 OCI IDs',
          href: 'https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/contactingsupport_topic-Locating_Oracle_Cloud_Infrastructure_IDs.htm',
        },
      ],
    },
    {
      title: 'User OCID、Private Key 与 Fingerprint',
      description:
        '在用户 API Keys 中添加公钥后，复制 User OCID、Key Fingerprint，并粘贴对应私钥 PEM。',
      links: [
        {
          label: 'API Signing Key',
          href: 'https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm',
        },
        {
          label: 'Request Signatures',
          href: 'https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm',
        },
      ],
    },
  ],
};

function ProviderDocLinks({
  links = [],
}: {
  links?: ProviderDocItem['links'];
}) {
  if (!links.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((link) => (
        <Button
          key={link.href}
          asChild
          type="button"
          variant="outline"
          size="xs"
          className="max-w-full justify-start"
        >
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            title={link.label}
          >
            <span className="truncate">{link.label}</span>
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      ))}
    </div>
  );
}

function ProviderDocPanel({ provider }: { provider: ProviderValue }) {
  const docs = PROVIDER_DOCS[provider];

  return (
    <dl className="flex min-w-0 flex-col gap-3 text-sm">
      {docs.map((doc, index) => (
        <div key={doc.title} className="flex min-w-0 flex-col gap-1">
          <dt className="font-medium">
            {index + 1}. {doc.title}
          </dt>
          <dd className="min-w-0 break-words text-muted-foreground">
            {doc.description}
            <ProviderDocLinks links={doc.links} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProviderDocs({ provider }: { provider: ProviderValue }) {
  return (
    <ResponsiveDialog>
      <ResponsiveDialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="查看存储账号配置文档"
        >
          <BookOpenText data-icon="inline-start" />
          配置文档
        </Button>
      </ResponsiveDialog.Trigger>
      <ResponsiveDialog.Content
        className="flex h-[min(90vh,42rem)] max-h-[min(90vh,42rem)] flex-col overflow-hidden sm:max-w-2xl"
        drawerClassName="h-[88vh] max-h-[88vh]"
      >
        <ResponsiveDialog.Header className="min-w-0 shrink-0 p-0 text-left">
          <ResponsiveDialog.Title>存储账号配置文档</ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            选择云厂商后查看账号标识、访问密钥、Region 和 Endpoint 的获取方式。
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>

        <Tabs
          key={provider}
          defaultValue={provider}
          className="min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-11 w-full shrink-0 pb-2">
            <TabsList className="flex w-max">
              {PROVIDERS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  <Image
                    alt=""
                    width={18}
                    height={18}
                    className="size-4 rounded-sm"
                    src={faviconUrl(item.domain)}
                    unoptimized
                  />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            {PROVIDERS.map((item) => (
              <TabsContent key={item.value} value={item.value} className="mt-0">
                <ProviderDocPanel provider={item.value} />
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
