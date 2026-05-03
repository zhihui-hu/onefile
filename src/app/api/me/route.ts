import { ok, withApiHandler } from '@/lib/api/response';
import { getCurrentUser, publicUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(
    async () => {
      const user = await getCurrentUser();
      return ok({ user: user ? publicUser(user) : null });
    },
    { label: 'api/me' },
  );
}
