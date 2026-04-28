import { ok, withApiHandler } from '@/lib/api/response';
import { clearSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  return withApiHandler(async () => {
    await clearSession();
    return ok({ logged_out: true });
  });
}
