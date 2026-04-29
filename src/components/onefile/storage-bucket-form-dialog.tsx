'use client';

import type { StorageBucket } from '@/components/onefile/types';
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
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';

const bucketFormSchema = z.object({
  public_base_url: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;

      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, '请输入合法的 HTTP/HTTPS URL。'),
});

export type BucketForm = z.infer<typeof bucketFormSchema>;

function bucketFormFromStorageBucket(bucket: StorageBucket | null): BucketForm {
  return {
    public_base_url: bucket?.public_base_url || '',
  };
}

export function buildStorageBucketPayload(values: BucketForm) {
  return {
    public_base_url: values.public_base_url || null,
  };
}

export function StorageBucketFormDialog({
  open,
  onOpenChange,
  bucket,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: StorageBucket | null;
  pending: boolean;
  onSubmit: (values: BucketForm) => void;
}) {
  const form = useForm<BucketForm>({
    resolver: standardSchemaResolver(bucketFormSchema),
    defaultValues: bucketFormFromStorageBucket(bucket),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(bucketFormFromStorageBucket(bucket));
  }, [bucket, form, open]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialog.Content
        className="overflow-hidden sm:max-w-md"
        drawerClassName="max-h-[92vh]"
      >
        <ResponsiveDialog.Header className="min-w-0 p-0 text-left">
          <ResponsiveDialog.Title>编辑 bucket</ResponsiveDialog.Title>
          <ResponsiveDialog.Description>
            {bucket?.name
              ? `配置 ${bucket.name} 的公开访问 URL。`
              : '配置公开访问 URL。'}
          </ResponsiveDialog.Description>
        </ResponsiveDialog.Header>

        <form
          className="flex min-h-0 min-w-0 max-w-full flex-col gap-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FieldGroup>
            <Field
              className="min-w-0"
              data-invalid={Boolean(form.formState.errors.public_base_url)}
            >
              <FieldLabel htmlFor="bucket-public-url">Public URL</FieldLabel>
              <Input
                id="bucket-public-url"
                type="url"
                aria-invalid={Boolean(form.formState.errors.public_base_url)}
                placeholder="https://cdn.example.com"
                {...form.register('public_base_url')}
              />
              <FieldDescription>留空表示不配置公开访问地址。</FieldDescription>
              <FieldError errors={[form.formState.errors.public_base_url]} />
            </Field>
          </FieldGroup>

          <Separator />

          <ResponsiveDialog.Footer className="p-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              保存
            </Button>
          </ResponsiveDialog.Footer>
        </form>
      </ResponsiveDialog.Content>
    </ResponsiveDialog>
  );
}
