import type { UserJSON, WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { ensureSchoolCustomPack } from '@/lib/db/curriculum';
import { deleteUser, upsertUser } from '@/lib/db/users';

export const runtime = 'nodejs';

function pickPrimaryEmail(data: UserJSON): string | null {
  if (!data.email_addresses?.length) return null;
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return (primary ?? data.email_addresses[0])?.email_address ?? null;
}

function buildDisplayName(data: UserJSON): string | null {
  const parts = [data.first_name, data.last_name].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length ? parts.join(' ') : null;
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const data = event.data;
      const email = pickPrimaryEmail(data);
      if (!email) {
        throw new Error(`Clerk user ${data.id} has no email address`);
      }
      await upsertUser({
        id: data.id,
        email,
        displayName: buildDisplayName(data),
      });
      if (event.type === 'user.created') {
        await ensureSchoolCustomPack(data.id);
      }
      return;
    }
    case 'user.deleted': {
      if (!event.data.id) return;
      await deleteUser(event.data.id);
      return;
    }
    default:
      return;
  }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return Response.json(
      { error: 'CLERK_WEBHOOK_SIGNING_SECRET not configured' },
      { status: 500 },
    );
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: WebhookEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed', err);
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error('[clerk-webhook] event handler failed', {
      type: event.type,
      err,
    });
    return Response.json({ error: 'Handler error' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
