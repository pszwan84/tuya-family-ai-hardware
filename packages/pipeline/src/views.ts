import { buildNarrative, isFactConsistent } from '@fah/domain';
import type { PipelineDeps } from './deps';

export type PreviewView = {
  viewId: string;
  memberId: string;
  role: string;
  title: string;
  whatHappened: string;
  whyForYou: string;
  roleNote: string;
  imageUrl: string | null;
  aiAttribution: true;
};

export async function ensureViews(deps: PipelineDeps, eventId: string, recipientIds: string[]): Promise<PreviewView[]> {
  const { prisma, storage } = deps;
  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) return [];

  const facts = {
    who: event.factsWho,
    action: event.factsAction,
    object: event.factsObject,
    scene: event.factsScene,
    time: event.factsTime,
  };

  const imageUrl = event.cardImageKey ? await storage.presign(event.cardImageKey, 300) : null;
  const results: PreviewView[] = [];

  for (const recipientId of recipientIds) {
    const recipient = await prisma.user.findUnique({ where: { userId: recipientId } });
    if (!recipient || recipient.familyId !== event.familyId) continue;

    const existing = await prisma.eventView.findFirst({
      where: { eventId, recipientId, isCurrent: true },
    });

    if (existing) {
      results.push({
        viewId: existing.viewId,
        memberId: recipientId,
        role: existing.roleSnapshot,
        title: existing.title,
        whatHappened: existing.whatHappened,
        whyForYou: existing.whyForYou,
        roleNote: existing.roleNote,
        imageUrl,
        aiAttribution: true,
      });
      continue;
    }

    let narrative = buildNarrative({
      role: recipient.role,
      facts,
      eventType: event.eventType,
      relation: 'family',
    });
    if (!isFactConsistent(narrative, facts)) {
      narrative = buildNarrative({ role: 'middle', facts, eventType: event.eventType, relation: 'family' });
    }

    const view = await prisma.eventView.create({
      data: {
        familyId: event.familyId,
        eventId,
        recipientId,
        roleSnapshot: recipient.role,
        version: 1,
        isCurrent: true,
        title: narrative.title,
        whatHappened: narrative.whatHappened,
        whyForYou: narrative.whyForYou,
        roleNote: narrative.roleNote,
        imageKey: event.cardImageKey,
        aiAttribution: true,
      },
    });

    results.push({
      viewId: view.viewId,
      memberId: recipientId,
      role: recipient.role,
      title: view.title,
      whatHappened: view.whatHappened,
      whyForYou: view.whyForYou,
      roleNote: view.roleNote,
      imageUrl,
      aiAttribution: true,
    });
  }

  return results;
}