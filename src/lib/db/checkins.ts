import type { ActivityDay } from './activity';

export const WEEKLY_CHECKIN_THRESHOLD = 5;

/** Distinct check-in days = days with a daily-login bonus. */
export function countCheckInDays(activity: readonly ActivityDay[]): number {
  return activity.reduce((n, d) => (d.dailyLoginBonus ? n + 1 : n), 0);
}
