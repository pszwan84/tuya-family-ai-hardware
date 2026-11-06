import type { EventStatus } from './types';

export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['shared', 'ignored', 'deleted'],
  shared: ['revoked', 'deleted'],
  revoked: ['shared', 'deleted'],
  ignored: ['draft', 'deleted'],
  deleted: [],
};

export type TransitionResult =
  | { ok: true; from: EventStatus; to: EventStatus }
  | { ok: false; from: EventStatus; to: EventStatus; allowed: EventStatus[] };

export function canTransition(from: EventStatus, to: EventStatus): TransitionResult {
  const allowed = EVENT_TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return { ok: true, from, to };
  return { ok: false, from, to, allowed };
}

export const SHARE_TRANSITIONS: Record<'pending' | 'confirmed' | 'revoked', Array<'pending' | 'confirmed' | 'revoked'>> = {
  pending: ['confirmed'],
  confirmed: ['revoked'],
  revoked: [],
};

export function canTransitionShare(from: 'pending' | 'confirmed' | 'revoked', to: 'pending' | 'confirmed' | 'revoked'): boolean {
  return SHARE_TRANSITIONS[from].includes(to);
}