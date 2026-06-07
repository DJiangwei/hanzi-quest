/**
 * Pure error classes for the home/furniture placement system.
 * Client-safe: NO @/db import.
 */

export class FurnitureNotOwnedError extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super(`Child does not own furniture: "${slug}"`);
    this.name = 'FurnitureNotOwnedError';
    this.slug = slug;
  }
}

export class CellOccupiedError extends Error {
  readonly room: string;
  readonly x: number;
  readonly y: number;
  constructor(room: string, x: number, y: number) {
    super(`Cell (${x}, ${y}) in room "${room}" is already occupied`);
    this.name = 'CellOccupiedError';
    this.room = room;
    this.x = x;
    this.y = y;
  }
}

export class InvalidPlacementError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Invalid furniture placement: ${reason}`);
    this.name = 'InvalidPlacementError';
    this.reason = reason;
  }
}
