# 汉字探险 · Hanzi Quest

A Mario-style web game for kids reviewing the Chinese characters from their weekly school class. See [`PLAN.md`](./PLAN.md) for the full design spec.

## Getting Started

```bash
pnpm install
vercel link        # link to the hanzi-quest Vercel project
vercel env pull .env.local   # pulls Clerk + Neon credentials
pnpm db:migrate    # apply Drizzle migrations to the linked Neon dev branch
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server (Turbopack) |
| `pnpm typecheck` | `tsc --noEmit` — must stay clean |
| `pnpm lint` | ESLint over the whole tree |
| `pnpm test` | Run Vitest unit suite |
| `pnpm test:e2e` | Run Playwright E2E suite |
| `pnpm db:generate` | Re-derive a Drizzle migration from `src/db/schema/*` |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:studio` | Open drizzle-studio for the linked DB |

## Clerk webhook setup (one-time)

Clerk fires `user.created` / `user.updated` / `user.deleted` events to keep our `users` table in sync. The Vercel Marketplace integration provisions Clerk's auth keys but **not** the webhook signing secret — you have to wire that yourself.

1. **Add a webhook endpoint in the Clerk dashboard** (Configure → Webhooks → Add Endpoint):
   - URL: `https://hanzi-quest-eight.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
2. **Copy the signing secret** (starts with `whsec_`).
3. **Add it to every Vercel environment**:
   ```bash
   vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
   vercel env add CLERK_WEBHOOK_SIGNING_SECRET preview
   vercel env add CLERK_WEBHOOK_SIGNING_SECRET development
   ```
4. **Pull it locally** for the dev server: `vercel env pull .env.local`.
5. **Verify** by signing up a fresh test user — there should be a row in `users` and a corresponding `school-custom` row in `curriculum_packs`.

For local end-to-end testing without a public URL, use the Clerk CLI's `clerk webhooks listen` (forwards events to `http://localhost:3000/api/webhooks/clerk`).
