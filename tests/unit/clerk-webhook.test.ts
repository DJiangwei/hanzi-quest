import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
vi.mock('svix', () => ({
  Webhook: class {
    constructor(..._args: unknown[]) {
      void _args;
    }
    verify(...args: unknown[]) {
      void args;
      return verifyMock();
    }
  },
}));

const upsertUserMock = vi.fn();
const deleteUserMock = vi.fn();
vi.mock('@/lib/db/users', () => ({
  upsertUser: (input: unknown) => upsertUserMock(input),
  deleteUser: (id: string) => deleteUserMock(id),
}));

const ensureSchoolCustomPackMock = vi.fn();
vi.mock('@/lib/db/curriculum', () => ({
  ensureSchoolCustomPack: (id: string) => ensureSchoolCustomPackMock(id),
}));

import { POST } from '@/app/api/webhooks/clerk/route';

const ORIGINAL_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

function buildRequest(
  body: unknown,
  headers: Record<string, string> = {
    'svix-id': 'msg_1',
    'svix-timestamp': '1700000000',
    'svix-signature': 'v1,sig',
  },
): Request {
  return new Request('https://example.test/api/webhooks/clerk', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_test';
  verifyMock.mockReset();
  upsertUserMock.mockReset();
  deleteUserMock.mockReset();
  ensureSchoolCustomPackMock.mockReset();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  } else {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = ORIGINAL_SECRET;
  }
});

describe('Clerk webhook POST handler', () => {
  it('returns 500 when signing secret is missing', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(500);
  });

  it('returns 400 when svix headers are missing', async () => {
    const res = await POST(buildRequest({}, { 'content-type': 'application/json' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when signature verification fails', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await POST(buildRequest({ type: 'user.created', data: {} }));
    expect(res.status).toBe(401);
  });

  it('user.created → upserts user and ensures school-custom pack', async () => {
    verifyMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_abc',
        first_name: 'Anna',
        last_name: 'Jiang',
        primary_email_address_id: 'email_1',
        email_addresses: [
          { id: 'email_1', email_address: 'anna@example.com' },
        ],
      },
    });
    const res = await POST(buildRequest({ /* mocked verify */ }));
    expect(res.status).toBe(200);
    expect(upsertUserMock).toHaveBeenCalledWith({
      id: 'user_abc',
      email: 'anna@example.com',
      displayName: 'Anna Jiang',
    });
    expect(ensureSchoolCustomPackMock).toHaveBeenCalledWith('user_abc');
  });

  it('user.updated → upserts user but does NOT re-create curriculum pack', async () => {
    verifyMock.mockReturnValue({
      type: 'user.updated',
      data: {
        id: 'user_abc',
        first_name: null,
        last_name: null,
        primary_email_address_id: 'email_1',
        email_addresses: [
          { id: 'email_1', email_address: 'anna@example.com' },
        ],
      },
    });
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(200);
    expect(upsertUserMock).toHaveBeenCalledWith({
      id: 'user_abc',
      email: 'anna@example.com',
      displayName: null,
    });
    expect(ensureSchoolCustomPackMock).not.toHaveBeenCalled();
  });

  it('user.deleted → calls deleteUser', async () => {
    verifyMock.mockReturnValue({
      type: 'user.deleted',
      data: { id: 'user_abc', deleted: true },
    });
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(200);
    expect(deleteUserMock).toHaveBeenCalledWith('user_abc');
    expect(upsertUserMock).not.toHaveBeenCalled();
  });

  it('user.created with no email → 500 handler error', async () => {
    verifyMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_abc',
        first_name: 'Anna',
        last_name: null,
        primary_email_address_id: null,
        email_addresses: [],
      },
    });
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(500);
    expect(upsertUserMock).not.toHaveBeenCalled();
  });
});
