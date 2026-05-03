'use client';

import {
  isProviderId,
  storageBucketDisplayName,
} from '@/app/(main)/components/format';
import { providerIconUrl } from '@/app/(main)/components/storage/storage-account-form-dialog';
import type { StorageBucket } from '@/app/(main)/components/types';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { OverflowTooltipText } from '@/components/ui/overflow-tooltip-text';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import type { Dispatch, SetStateAction } from 'react';

import type { KeyForm } from './utils';

function BucketSelect({
  buckets,
  value,
  onChange,
}: {
  buckets: StorageBucket[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || '__default__'}
      onValueChange={(nextValue) =>
        onChange(nextValue === '__default__' ? '' : nextValue)
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="默认负载均衡" />
      </SelectTrigger>
      <SelectContent className="w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width) max-w-(--radix-select-trigger-width)">
        <SelectGroup>
          <SelectItem value="__default__">默认负载均衡</SelectItem>
          {buckets.map((bucket) => {
            const label = storageBucketDisplayName(bucket);
            const provider = bucket.provider;

            return (
              <SelectItem key={bucket.id} value={String(bucket.id)}>
                <span className="flex min-w-0 items-center gap-1.5">
                  {isProviderId(provider) ? (
                    <Image
                      alt=""
                      width={16}
                      height={16}
                      className="size-4 shrink-0 rounded-sm"
                      src={providerIconUrl(provider, 16)}
                      unoptimized
                    />
                  ) : null}
                  <OverflowTooltipText
                    className="max-w-full"
                    contentClassName="break-all"
                    tooltip={label}
                  >
                    {label}
                  </OverflowTooltipText>
                </span>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function ApiKeyFormFields({
  buckets,
  form,
  setForm,
}: {
  buckets: StorageBucket[];
  form: KeyForm;
  setForm: Dispatch<SetStateAction<KeyForm>>;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="key-name">名称</FieldLabel>
        <Input
          id="key-name"
          value={form.name}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, name: event.target.value }))
          }
          required
        />
      </Field>
      <Field>
        <FieldLabel>Bucket 策略</FieldLabel>
        <BucketSelect
          buckets={buckets}
          value={form.bucket_id}
          onChange={(bucketId) =>
            setForm((prev) => ({ ...prev, bucket_id: bucketId }))
          }
        />
        <FieldDescription>留空时使用默认负载均衡策略。</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="key-compress">压缩图片</FieldLabel>
          <FieldDescription>
            开启后，公开上传和 API 上传的图片会转为 WebP 格式以减少文件大小。
          </FieldDescription>
        </div>
        <Switch
          id="key-compress"
          checked={form.compress_images}
          onCheckedChange={(checked) =>
            setForm((prev) => ({ ...prev, compress_images: checked }))
          }
        />
      </Field>
    </FieldGroup>
  );
}
