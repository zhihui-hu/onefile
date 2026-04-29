'use client';

import type { ProviderId, StorageAccount } from '@/components/onefile/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IMAGE_BLUR_DATA_URL } from '@/lib/image';
import { cn } from '@/lib/utils';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import gsap from 'gsap';
import { CircleAlert, Save } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod/v4';

export const PROVIDERS = [
  { value: 'r2', label: 'Cloudflare R2', domain: 'cloudflare.com' },
  { value: 'aws', label: 'AWS S3', domain: 'aws.amazon.com' },
  { value: 'aliyun', label: '阿里云 OSS', domain: 'alibabacloud.com' },
  { value: 'tencent', label: '腾讯云 COS', domain: 'cloud.tencent.com' },
  { value: 'oracle', label: '甲骨文 OS', domain: 'oracle.com' },
] as const;

export function faviconUrl(domain: string, size = 64) {
  const d = domain.replace(/^https?:\/\//, '');
  const iconSize = Math.max(size, 64);
  return `https://www.google.com/s2/favicons?sz=${iconSize}&domain=${encodeURIComponent(d)}`;
}

type ProviderValue = (typeof PROVIDERS)[number]['value'];

const providerValueToId: Record<ProviderValue, ProviderId> = {
  r2: 'r2',
  aws: 's3',
  aliyun: 'aliyun_oss',
  tencent: 'tencent_cos',
  oracle: 'oci',
};

const providerIdToValue: Partial<Record<ProviderId, ProviderValue>> = {
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

const providerValues = PROVIDERS.map((provider) => provider.value) as [
  ProviderValue,
  ...ProviderValue[],
];

export function providerIconUrl(provider: ProviderId, size = 28) {
  return faviconUrl(providerDomainById[provider], size);
}

function providerMetaFromValue(value: ProviderValue) {
  return PROVIDERS.find((provider) => provider.value === value) || PROVIDERS[0];
}

const accountFormSchema = z
  .object({
    is_editing: z.boolean(),
    name: z.string().trim().min(1, '请输入账号名称。').max(80),
    provider: z.enum(providerValues),
    provider_account_id: z.string().trim().max(160),
    region: z.string().trim().max(120),
    endpoint: z.string().trim().max(240),
    namespace: z.string().trim().max(160),
    compartment_id: z.string().trim().max(240),
    access_key_id: z.string().trim().min(1, '请输入 Access key。').max(240),
    secret_key: z.string().trim().max(2000),
  })
  .superRefine((value, ctx) => {
    if (!value.is_editing && !value.secret_key) {
      ctx.addIssue({
        code: 'custom',
        path: ['secret_key'],
        message: '新增账号时请输入 Secret key。',
      });
    }

    if (value.provider === 'r2' && !value.provider_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['provider_account_id'],
        message: '请输入 Cloudflare Account ID。',
      });
    }

    if (value.provider === 'tencent' && !value.provider_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['provider_account_id'],
        message: '请输入腾讯云 AppID。',
      });
    }
  });

export type AccountForm = z.infer<typeof accountFormSchema>;

export function emptyAccountForm(provider: ProviderValue = 'r2'): AccountForm {
  return {
    is_editing: false,
    name: '',
    provider,
    provider_account_id: '',
    region: '',
    endpoint: '',
    namespace: '',
    compartment_id: '',
    access_key_id: '',
    secret_key: '',
  };
}

export function accountFormFromStorageAccount(
  account: StorageAccount,
): AccountForm {
  return {
    is_editing: true,
    name: account.name,
    provider: providerIdToValue[account.provider] ?? 'aws',
    provider_account_id: account.provider_account_id || '',
    region: account.region || '',
    endpoint: account.endpoint || '',
    namespace: account.namespace || '',
    compartment_id: account.compartment_id || '',
    access_key_id: account.access_key_id || '',
    secret_key: '',
  };
}

export function buildStorageAccountPayload(
  values: AccountForm,
  editing: boolean,
) {
  const providerAccountId = values.provider_account_id || null;
  const endpoint =
    values.provider === 'r2' && providerAccountId
      ? `https://${providerAccountId}.r2.cloudflarestorage.com`
      : values.provider === 'aliyun'
        ? null
        : values.endpoint || null;
  const payload: Record<string, unknown> = {
    name: values.name,
    provider_account_id: providerAccountId,
    region: values.region || null,
    endpoint,
    namespace: values.namespace || null,
    compartment_id: values.compartment_id || null,
    access_key_id: values.access_key_id,
  };

  if (!editing) {
    payload.provider = providerValueToId[values.provider];
  }

  if (values.secret_key) {
    payload.secret_access_key = values.secret_key;
  }

  return payload;
}

function resetProviderFields(
  form: UseFormReturn<AccountForm>,
  provider: ProviderValue,
) {
  form.reset({
    ...form.getValues(),
    provider,
    provider_account_id: '',
    region: '',
    endpoint: '',
    namespace: '',
    compartment_id: '',
  });
}

function RequiredMark({ children = '必填' }: { children?: string }) {
  return (
    <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
      {children}
    </span>
  );
}

function ProviderSpecificFields({
  form,
  provider,
}: {
  form: UseFormReturn<AccountForm>;
  provider: ProviderValue;
}) {
  if (provider === 'r2') {
    return (
      <FieldGroup>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.provider_account_id)}
        >
          <FieldLabel htmlFor="account-provider-id">
            Account ID <RequiredMark />
          </FieldLabel>
          <Input
            id="account-provider-id"
            aria-invalid={Boolean(form.formState.errors.provider_account_id)}
            placeholder="Cloudflare account id"
            {...form.register('provider_account_id')}
          />
          <FieldDescription>
            Endpoint 会自动生成为
            https://&lt;account-id&gt;.r2.cloudflarestorage.com。
          </FieldDescription>
          <FieldError errors={[form.formState.errors.provider_account_id]} />
        </Field>
      </FieldGroup>
    );
  }

  if (provider === 'tencent') {
    return (
      <FieldGroup>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.provider_account_id)}
          >
            <FieldLabel htmlFor="account-provider-id">
              AppID <RequiredMark />
            </FieldLabel>
            <Input
              id="account-provider-id"
              aria-invalid={Boolean(form.formState.errors.provider_account_id)}
              placeholder="1250000000"
              {...form.register('provider_account_id')}
            />
            <FieldDescription>
              访问对象时会按腾讯云规则拼成 &lt;bucket&gt;-&lt;appid&gt;。
            </FieldDescription>
            <FieldError errors={[form.formState.errors.provider_account_id]} />
          </Field>
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.region)}
          >
            <FieldLabel htmlFor="account-region">Region</FieldLabel>
            <Input
              id="account-region"
              aria-invalid={Boolean(form.formState.errors.region)}
              placeholder="ap-guangzhou"
              {...form.register('region')}
            />
            <FieldDescription>留空默认 ap-guangzhou。</FieldDescription>
            <FieldError errors={[form.formState.errors.region]} />
          </Field>
        </div>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.endpoint)}
        >
          <FieldLabel htmlFor="account-endpoint">Endpoint</FieldLabel>
          <Input
            id="account-endpoint"
            aria-invalid={Boolean(form.formState.errors.endpoint)}
            placeholder="https://..."
            {...form.register('endpoint')}
          />
          <FieldError errors={[form.formState.errors.endpoint]} />
        </Field>
      </FieldGroup>
    );
  }

  if (provider === 'oracle') {
    return (
      <FieldGroup>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.namespace)}
          >
            <FieldLabel htmlFor="account-namespace">Namespace</FieldLabel>
            <Input
              id="account-namespace"
              aria-invalid={Boolean(form.formState.errors.namespace)}
              {...form.register('namespace')}
            />
            <FieldError errors={[form.formState.errors.namespace]} />
          </Field>
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.compartment_id)}
          >
            <FieldLabel htmlFor="account-compartment">Compartment</FieldLabel>
            <Input
              id="account-compartment"
              aria-invalid={Boolean(form.formState.errors.compartment_id)}
              {...form.register('compartment_id')}
            />
            <FieldError errors={[form.formState.errors.compartment_id]} />
          </Field>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.region)}
          >
            <FieldLabel htmlFor="account-region">Region</FieldLabel>
            <Input
              id="account-region"
              aria-invalid={Boolean(form.formState.errors.region)}
              placeholder="us-ashburn-1"
              {...form.register('region')}
            />
            <FieldError errors={[form.formState.errors.region]} />
          </Field>
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.endpoint)}
          >
            <FieldLabel htmlFor="account-endpoint">Endpoint</FieldLabel>
            <Input
              id="account-endpoint"
              aria-invalid={Boolean(form.formState.errors.endpoint)}
              placeholder="https://..."
              {...form.register('endpoint')}
            />
            <FieldError errors={[form.formState.errors.endpoint]} />
          </Field>
        </div>
      </FieldGroup>
    );
  }

  if (provider === 'aliyun') {
    return (
      <FieldGroup>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.region)}
        >
          <FieldLabel htmlFor="account-region">Region</FieldLabel>
          <Input
            id="account-region"
            aria-invalid={Boolean(form.formState.errors.region)}
            placeholder="cn-hangzhou"
            {...form.register('region')}
          />
          <FieldDescription>
            留空默认 cn-hangzhou，Endpoint 会根据 Region 自动生成。
          </FieldDescription>
          <FieldError errors={[form.formState.errors.region]} />
        </Field>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.region)}
        >
          <FieldLabel htmlFor="account-region">Region</FieldLabel>
          <Input
            id="account-region"
            aria-invalid={Boolean(form.formState.errors.region)}
            placeholder="us-east-1"
            {...form.register('region')}
          />
          <FieldError errors={[form.formState.errors.region]} />
        </Field>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.endpoint)}
        >
          <FieldLabel htmlFor="account-endpoint">Endpoint</FieldLabel>
          <Input
            id="account-endpoint"
            aria-invalid={Boolean(form.formState.errors.endpoint)}
            placeholder="https://..."
            {...form.register('endpoint')}
          />
          <FieldError errors={[form.formState.errors.endpoint]} />
        </Field>
      </div>
    </FieldGroup>
  );
}

function ProviderTabs({
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
              placeholder="blur"
              blurDataURL={IMAGE_BLUR_DATA_URL}
              unoptimized
            />
            <span className="truncate">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function ProviderSummary({ value }: { value: ProviderValue }) {
  const item = providerMetaFromValue(value);

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2">
      <Image
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-md"
        src={faviconUrl(item.domain)}
        placeholder="blur"
        blurDataURL={IMAGE_BLUR_DATA_URL}
        unoptimized
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.label}</div>
        <div className="text-xs text-muted-foreground">仓商不可修改</div>
      </div>
    </div>
  );
}

export function StorageAccountFormDialog({
  open,
  onOpenChange,
  account,
  pending,
  errorMessage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: StorageAccount | null;
  pending: boolean;
  errorMessage?: string | null;
  onSubmit: (values: AccountForm) => void;
}) {
  const editing = Boolean(account);
  const form = useForm<AccountForm>({
    resolver: standardSchemaResolver(accountFormSchema),
    defaultValues: account
      ? accountFormFromStorageAccount(account)
      : emptyAccountForm(),
  });
  const provider = useWatch({
    control: form.control,
    name: 'provider',
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      account ? accountFormFromStorageAccount(account) : emptyAccountForm(),
    );
  }, [account, form, open]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="overflow-hidden sm:max-w-xl"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="min-w-0 p-0 text-left">
          <ResponsiveDialog.Title>
            {editing ? '编辑存储账号' : '添加存储账号'}
          </ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            {editing
              ? '只更新当前账号的名称和凭证，仓商不可修改。'
              : '选择账号类型后填写对应凭证，保存后可以同步 bucket。'}
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>

        {errorMessage && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>保存失败</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form
          className="flex min-h-0 min-w-0 max-w-full flex-col gap-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {editing ? (
            <ProviderSummary value={provider} />
          ) : (
            <ProviderTabs
              value={provider}
              onValueChange={(value) => resetProviderFields(form, value)}
            />
          )}

          <FieldGroup>
            <Field
              className="min-w-0"
              data-invalid={Boolean(form.formState.errors.name)}
            >
              <FieldLabel htmlFor="account-name">
                名称 <RequiredMark />
              </FieldLabel>
              <Input
                id="account-name"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
          </FieldGroup>

          <ProviderSpecificFields form={form} provider={provider} />

          <FieldGroup>
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Field
                className="min-w-0"
                data-invalid={Boolean(form.formState.errors.access_key_id)}
              >
                <FieldLabel htmlFor="account-access-key">
                  Access key <RequiredMark />
                </FieldLabel>
                <Input
                  id="account-access-key"
                  aria-invalid={Boolean(form.formState.errors.access_key_id)}
                  {...form.register('access_key_id')}
                />
                <FieldError errors={[form.formState.errors.access_key_id]} />
              </Field>

              <Field
                className="min-w-0"
                data-invalid={Boolean(form.formState.errors.secret_key)}
              >
                <FieldLabel htmlFor="account-secret-key">
                  Secret key {!editing && <RequiredMark />}
                </FieldLabel>
                <Input
                  id="account-secret-key"
                  type="password"
                  aria-invalid={Boolean(form.formState.errors.secret_key)}
                  {...form.register('secret_key')}
                />
                {editing && (
                  <FieldDescription>留空表示不更新密钥。</FieldDescription>
                )}
                <FieldError errors={[form.formState.errors.secret_key]} />
              </Field>
            </div>
          </FieldGroup>

          <Separator />

          <ResponsiveDialog.Footer className="p-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {editing ? '保存修改' : '创建账号'}
            </Button>
          </ResponsiveDialog.Footer>
        </form>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
