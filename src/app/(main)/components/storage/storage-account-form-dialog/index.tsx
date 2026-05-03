'use client';

import type { StorageAccount } from '@/app/(main)/components/types';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { CircleAlert, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ProviderDocs } from './provider-docs';
import { ProviderSpecificFields, RequiredMark } from './provider-fields';
import { ProviderSummary, ProviderTabs } from './provider-tabs';
import {
  type AccountForm,
  accountFormFromStorageAccount,
  accountFormSchema,
  emptyAccountForm,
  resetProviderFields,
} from './schema';

export { providerIconUrl } from './providers';
export { buildStorageAccountPayload, type AccountForm } from './schema';

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
  const isOracle = provider === 'oracle';

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
            <AlertDescription className="break-words">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <form
          className="flex min-h-0 min-w-0 max-w-full flex-col gap-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {editing ? (
            <ProviderSummary value={provider} />
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="text-sm font-medium">存储厂商</div>
                <ProviderDocs provider={provider} />
              </div>
              <ProviderTabs
                value={provider}
                onValueChange={(value) => resetProviderFields(form, value)}
              />
            </div>
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

          {isOracle ? (
            <FieldGroup>
              <Field
                className="min-w-0"
                data-invalid={Boolean(form.formState.errors.access_key_id)}
              >
                <FieldLabel htmlFor="account-access-key">
                  User OCID <RequiredMark />
                </FieldLabel>
                <Input
                  id="account-access-key"
                  aria-invalid={Boolean(form.formState.errors.access_key_id)}
                  placeholder="ocid1.user.oc1..xxxxxxxx"
                  {...form.register('access_key_id')}
                />
                <FieldError errors={[form.formState.errors.access_key_id]} />
              </Field>

              <Field
                className="min-w-0"
                data-invalid={Boolean(form.formState.errors.secret_key)}
              >
                <FieldLabel htmlFor="account-secret-key">
                  Private Key (PEM) {!editing && <RequiredMark />}
                </FieldLabel>
                <Textarea
                  id="account-secret-key"
                  className="h-28"
                  aria-invalid={Boolean(form.formState.errors.secret_key)}
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  {...form.register('secret_key')}
                />
                {editing && (
                  <FieldDescription>留空表示不更新私钥。</FieldDescription>
                )}
                <FieldError errors={[form.formState.errors.secret_key]} />
              </Field>
            </FieldGroup>
          ) : (
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
          )}

          {/* <Separator /> */}

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
