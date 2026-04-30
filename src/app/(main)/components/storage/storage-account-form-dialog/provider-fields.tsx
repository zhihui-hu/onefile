import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type UseFormReturn } from 'react-hook-form';

import type { ProviderValue } from './providers';
import type { AccountForm } from './schema';

export function RequiredMark({ children = '必填' }: { children?: string }) {
  return (
    <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
      {children}
    </span>
  );
}

export function ProviderSpecificFields({
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
            <FieldDescription>
              留空默认 ap-guangzhou，Endpoint 会根据 Region 自动生成。
            </FieldDescription>
            <FieldError errors={[form.formState.errors.region]} />
          </Field>
        </div>
      </FieldGroup>
    );
  }

  if (provider === 'oracle') {
    return (
      <FieldGroup>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.provider_account_id)}
        >
          <FieldLabel htmlFor="account-provider-id">
            Tenancy OCID <RequiredMark />
          </FieldLabel>
          <Input
            id="account-provider-id"
            aria-invalid={Boolean(form.formState.errors.provider_account_id)}
            placeholder="ocid1.tenancy.oc1..xxxxxxxx"
            {...form.register('provider_account_id')}
          />
          <FieldDescription>
            用于 OCI API 签名，也会作为默认 compartment 查询 bucket。
          </FieldDescription>
          <FieldError errors={[form.formState.errors.provider_account_id]} />
        </Field>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.namespace)}
          >
            <FieldLabel htmlFor="account-namespace">
              Namespace（可选）
            </FieldLabel>
            <Input
              id="account-namespace"
              aria-invalid={Boolean(form.formState.errors.namespace)}
              placeholder="Object Storage Namespace"
              {...form.register('namespace')}
            />
            <FieldDescription>
              留空时会通过 OCI Object Storage API 自动获取。
            </FieldDescription>
            <FieldError errors={[form.formState.errors.namespace]} />
          </Field>
          <Field
            className="min-w-0"
            data-invalid={Boolean(form.formState.errors.region)}
          >
            <FieldLabel htmlFor="account-region">
              Region <RequiredMark />
            </FieldLabel>
            <Input
              id="account-region"
              aria-invalid={Boolean(form.formState.errors.region)}
              placeholder="us-phoenix-1"
              {...form.register('region')}
            />
            <FieldError errors={[form.formState.errors.region]} />
          </Field>
        </div>
        <Field
          className="min-w-0"
          data-invalid={Boolean(form.formState.errors.fingerprint)}
        >
          <FieldLabel htmlFor="account-fingerprint">
            Key Fingerprint <RequiredMark />
          </FieldLabel>
          <Input
            id="account-fingerprint"
            aria-invalid={Boolean(form.formState.errors.fingerprint)}
            placeholder="20:3b:97:..."
            {...form.register('fingerprint')}
          />
          <FieldError errors={[form.formState.errors.fingerprint]} />
        </Field>
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
