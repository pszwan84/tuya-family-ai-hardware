export type Actor = {
  userId: string;
  familyId: string;
  role: 'grandparent' | 'middle' | 'child';
  isMinor: boolean;
};

export type EventOwnership = {
  familyId: string;
  ownerId: string;
  status: 'draft' | 'shared' | 'revoked' | 'ignored' | 'deleted';
  visibility: 'owner_only' | 'shared';
  deletedAt?: Date | null;
};

export type Recipient = {
  userId: string;
  familyId: string;
  role: 'grandparent' | 'middle' | 'child';
  isMinor: boolean;
};

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

const deny = (reason: string): GuardResult => ({ allowed: false, reason });

export function canViewEvent(actor: Actor, event: EventOwnership, isRecipient: boolean): GuardResult {
  if (event.familyId !== actor.familyId) return deny('cross_family');
  if (event.deletedAt) return deny('deleted');
  if (event.ownerId === actor.userId) return { allowed: true };
  if (event.status !== 'shared') return deny('not_shared');
  if (event.visibility !== 'shared') return deny('owner_only');
  if (!isRecipient) return deny('not_recipient');
  return { allowed: true };
}

export function canViewAsset(actor: Actor, ownerId: string, familyId: string, deletedAt?: Date | null): GuardResult {
  if (familyId !== actor.familyId) return deny('cross_family');
  if (actor.userId !== ownerId) return deny('not_owner');
  if (deletedAt) return deny('deleted');
  return { allowed: true };
}

export function canShare(actor: Actor, event: EventOwnership, recipients: Recipient[]): GuardResult {
  if (event.familyId !== actor.familyId) return deny('cross_family');
  if (event.ownerId !== actor.userId) return deny('not_owner');
  if (event.status === 'deleted') return deny('deleted');
  if (event.status === 'shared') return deny('already_shared');
  if (recipients.length === 0) return deny('no_recipient');
  for (const recipient of recipients) {
    if (recipient.familyId !== actor.familyId) return deny('recipient_cross_family');
    if (recipient.userId === actor.userId) return deny('recipient_is_owner');
    if (recipient.isMinor && actor.role !== 'middle') return deny('minor_requires_guardian');
  }
  return { allowed: true };
}

export function canRevoke(actor: Actor, event: EventOwnership): GuardResult {
  if (event.familyId !== actor.familyId) return deny('cross_family');
  if (event.ownerId !== actor.userId) return deny('not_owner');
  if (event.status !== 'shared') return deny('not_shared');
  return { allowed: true };
}

export function canManageMember(actor: Actor, target: Recipient): GuardResult {
  if (actor.familyId !== target.familyId) return deny('cross_family');
  if (actor.role !== 'middle') return deny('not_guardian');
  if (actor.userId === target.userId) return deny('self_manage');
  return { allowed: true };
}

export const VISIBLE_RULES = [
  'family_match',
  'not_deleted',
  'owner_bypass',
  'shared_status',
  'recipient_match',
  'minor_guardian',
  'role_not_permission',
] as const;