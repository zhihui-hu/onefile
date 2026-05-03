import { withApiHandler } from '@/lib/api/response';
import { getPublicUploadApiKeyContext } from '@/lib/auth/api-key-upload-strategy';
import { handleDirectUpload } from '@/lib/uploads/direct-upload';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  return withApiHandler(async () => {
    const { uuid } = await params;
    const { user, strategy } = await getPublicUploadApiKeyContext(
      request,
      uuid,
    );

    return handleDirectUpload(request, {
      userId: user.id,
      strategy: {
        bucketId: strategy.storageBucketId,
        compressImages: strategy.compressImages,
        publicUploadUuid: strategy.publicUploadUuid,
      },
    });
  });
}
