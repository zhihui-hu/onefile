import type { StorageAccount } from '@/app/(main)/components/types';
import {
  defaultStorageEndpoint,
  storageRegionOrDefault,
} from '@/lib/storage/endpoints';
import { type UseFormReturn } from 'react-hook-form';
import { z } from 'zod/v4';

import {
  type ProviderValue,
  providerIdToValue,
  providerValueToId,
  providerValues,
} from './providers';

export const accountFormSchema = z
  .object({
    is_editing: z.boolean(),
    name: z.string().trim().min(1, '请输入账号名称。').max(80),
    provider: z.enum(providerValues),
    provider_account_id: z.string().trim().max(160),
    region: z.string().trim().max(120),
    endpoint: z.string().trim().max(240),
    namespace: z.string().trim().max(160),
    compartment_id: z.string().trim().max(240),
    fingerprint: z.string().trim().max(255),
    access_key_id: z.string().trim().min(1, '请输入 Access key。').max(240),
    secret_key: z.string().trim().max(10000),
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

    if (value.provider === 'oracle' && !value.provider_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['provider_account_id'],
        message: '请输入 Oracle Tenancy OCID。',
      });
    }

    if (value.provider === 'oracle' && !value.region) {
      ctx.addIssue({
        code: 'custom',
        path: ['region'],
        message: '请输入 Oracle Region。',
      });
    }

    if (value.provider === 'oracle' && !value.fingerprint) {
      ctx.addIssue({
        code: 'custom',
        path: ['fingerprint'],
        message: '请输入 Oracle Key Fingerprint。',
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
    fingerprint: '',
    access_key_id: '',
    secret_key: '',
  };
}

function extraConfigString(account: StorageAccount, key: string) {
  const value = account.extra_config?.[key];
  return typeof value === 'string' ? value : '';
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
    fingerprint: extraConfigString(account, 'fingerprint'),
    access_key_id: account.access_key_id || '',
    secret_key: '',
  };
}

export function buildStorageAccountPayload(
  values: AccountForm,
  editing: boolean,
) {
  const provider = providerValueToId[values.provider];
  const providerAccountId = values.provider_account_id || null;
  const region = storageRegionOrDefault(provider, values.region);
  const endpoint =
    (defaultStorageEndpoint({
      provider,
      region,
      accountId: providerAccountId,
    }) ??
      values.endpoint) ||
    null;
  const payload: Record<string, unknown> = {
    name: values.name,
    provider_account_id: providerAccountId,
    region,
    endpoint,
    namespace: values.namespace || null,
    compartment_id: values.compartment_id || null,
    access_key_id: values.access_key_id,
  };

  if (provider === 'oci') {
    payload.extra_config = {
      fingerprint: values.fingerprint,
    };
  }

  if (!editing) {
    payload.provider = provider;
  }

  if (values.secret_key) {
    payload.secret_access_key = values.secret_key;
  }

  return payload;
}

export function resetProviderFields(
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
    fingerprint: '',
  });
}
