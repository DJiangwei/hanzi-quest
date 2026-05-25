import bcrypt from 'bcryptjs';

export const MAX_FAILED_ATTEMPTS = 5;
export const COOLDOWN_MS = 5 * 60 * 1000;
const BCRYPT_COST = 10;

export class InvalidPinFormatError extends Error {}

function assertPinShape(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new InvalidPinFormatError('PIN must be exactly 4 digits');
  }
}

export async function hashPin(pin: string): Promise<string> {
  assertPinShape(pin);
  return bcrypt.hash(pin, BCRYPT_COST);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  return bcrypt.compare(pin, hash);
}

export function isLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return lockedUntil.getTime() > Date.now();
}
