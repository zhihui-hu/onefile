import { CallbackAuth } from '@/components/onefile/callback-auth';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <CallbackAuth />
    </Suspense>
  );
}
