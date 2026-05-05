# `@harness-bujang/template`

The "drop-in" assets a project copies into its own repo to enable the
real-time harness chat-room UI.

> ⚠️ This package is **opinionated**. It assumes:
>
> - **Next.js 16** App Router for the admin UI
> - **Supabase** (Postgres + Auth) as the backing store
> - A `users` table with a `role` column (or your own admin-check predicate)
> - A `verifySuperAdmin()` helper at `@/lib/utils/admin` that returns
>   `{ isSuperAdmin: boolean, supabase?: SupabaseClient }`
>
> If your stack differs, treat this as a reference implementation and port
> the UI / routes to your framework. The agent definitions and chat-message
> protocol are stack-independent.

---

## Files

```
template/
├── migrations/
│   ├── 00010_harness_messages.sql       Table + RLS (admin-only SELECT/INSERT)
│   └── 00025_harness_insert_admin_only.sql   Hardens the INSERT policy
└── app/
    ├── admin/harness/
    │   ├── page.tsx                     Server component, super-admin gate
    │   └── harness-client.tsx           KakaoTalk-style chat UI (rooms, polling, infinite scroll)
    └── api/harness/
        ├── logs/route.ts                GET (paginated reads) + POST (insert from bot or session)
        └── reply/route.ts               POST a message from the principal browser session
```

---

## Install

1. **Run the migrations** in your Supabase project (or vanilla Postgres):

   ```bash
   supabase db push    # if using the Supabase CLI
   # or psql -f migrations/00010_harness_messages.sql ...
   ```

2. **Copy the `app/` files** into your Next.js project, preserving the route
   structure under `src/app/admin/harness/` and `src/app/api/harness/`.

3. **Implement `verifySuperAdmin()`** at `@/lib/utils/admin`:

   ```ts
   // src/lib/utils/admin.ts
   import { createClient } from '@/lib/supabase/server';

   const SUPER_ADMINS = (process.env.SUPER_ADMIN_EMAILS ?? '').split(',');

   export async function verifySuperAdmin() {
     const supabase = await createClient();
     const { data: { user } } = await supabase.auth.getUser();
     const isSuperAdmin = !!user?.email && SUPER_ADMINS.includes(user.email);
     return { isSuperAdmin, supabase };
   }
   ```

4. **Set environment variables**:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...        # used server-side to bypass RLS
   SUPER_ADMIN_EMAILS=you@example.com   # comma-separated
   HARNESS_WRITE_SECRET=<random>        # optional: for bots / scripts to POST
   ```

5. **Visit** `https://<your-domain>/admin/harness` while signed in as a
   super-admin. You should see the chat room with rooms for `대표 보고`,
   `consultant`, `dev-team`, etc.

---

## Customizing roles & rooms

Edit `harness-client.tsx` — `ROLES` and `ROOMS` constants near the top of the
file. Add or remove teams to match your harness configuration. The
`from` / `to` values used by Main Claude (Director persona) when calling
`/api/harness/logs` POST must match the role IDs here.

---

## Posting messages from agents (Main Claude)

Two paths:

**a) From the browser, as the principal** — the chat input box `POST`s to
`/api/harness/reply`, and the server forces `from='대표님'`.

**b) From Main Claude / scripts** — `POST /api/harness/logs` with header
`x-harness-secret: $HARNESS_WRITE_SECRET` and body:

```json
{
  "from": "director",
  "to": "dev-team",
  "type": "command",
  "message": "[NOTE] Implement feature X.\n\n## Scope\n- ..."
}
```

Important: messages from the secret path may **not** spoof `from='대표님'`.

---

## License

MIT — see the root `LICENSE`.
