import { CallbackAuth } from '@/app/(main)/components/auth/callback-auth';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <CallbackAuth />
    </Suspense>
  );
}
