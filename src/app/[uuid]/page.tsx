import { PublicUploadPage } from './public-upload-page';

export default async function Page({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  return <PublicUploadPage uuid={uuid} />;
}
