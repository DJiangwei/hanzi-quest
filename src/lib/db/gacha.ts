// The legacy coin-gacha engine (pull / pullInTx / PullResult) was deleted in
// the 2026-07-05 cleanup — cards flow exclusively through the play-to-earn
// grants in src/lib/db/grants.ts (PR #52 economy). This module survives only
// as the historical re-export point for the pure gacha error classes.
//
// New client-side callers should import directly from
// '@/lib/errors/gacha-errors' to avoid pulling the db client (postgres /
// fs / net) into the browser bundle.
import { AlreadyClaimedError, InsufficientCoinsError } from '@/lib/errors/gacha-errors';
export { AlreadyClaimedError, InsufficientCoinsError };
