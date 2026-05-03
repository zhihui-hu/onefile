import { HttpError, withApiHandler } from '@/lib/api/response';
import { getApiKeyUploadStrategy } from '@/lib/auth/api-key-upload-strategy';
import { getAuthContext } from '@/lib/auth/api-keys';
import {
  formBoolean,
  formText,
  handleDirectUpload,
} from '@/lib/uploads/direct-upload';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);

    if (auth.source === 'api_key') {
      if (!auth.key) {
        throw new HttpError(401, 'UNAUTHORIZED', 'API key is required');
      }

      const strategy = getApiKeyUploadStrategy(auth.key.id);
      if (!strategy) {
        throw new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
      }

      return handleDirectUpload(request, {
        userId: auth.user.id,
        strategy: {
          bucketId: strategy.storageBucketId,
          compressImages: strategy.compressImages,
          publicUploadUuid: strategy.publicUploadUuid,
        },
      });
    }

    return handleDirectUpload(request, {
      userId: auth.user.id,
      strategy: (formData) => ({
        bucketId: formText(formData, 'bucket_id'),
        compressImages: formBoolean(formData, 'compress'),
      }),
    });
  });
}
