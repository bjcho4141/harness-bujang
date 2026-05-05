import { redirect } from 'next/navigation';
import { verifySuperAdmin } from '@/lib/utils/admin';
import { HarnessClient } from './harness-client';
import type { Metadata } from 'next';

// Harness-Bujang chat-room admin page.
//
// Assumptions:
//   - Next.js 16 App Router
//   - A `verifySuperAdmin()` helper exists at `@/lib/utils/admin` and returns
//     `{ isSuperAdmin: boolean, supabase?: SupabaseClient }` based on the
//     authenticated user being in `SUPER_ADMIN_EMAILS` (or your own scheme).
//   - The `harness_messages` table exists (see migrations).
//
// Adjust the import / redirect target to match your project's admin layout.

export const metadata: Metadata = { title: '하네스 톡방' };

export default async function HarnessPage() {
  const { isSuperAdmin } = await verifySuperAdmin();

  if (!isSuperAdmin) {
    redirect('/admin');
  }

  return <HarnessClient />;
}
