import { Injectable } from '@nestjs/common';
import { canTransition } from '@fah/domain';
import { patchEventSchema } from '@fah/contracts';
import { ApiError } from '../../common/api-error';
import type { UserClaims } from '../../common/auth';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async cardUrl(imageKey: string | null): Promise<string | null> {
    if (!imageKey) return null;
    return this.storage.presign(imageKey, 300);
  }

  async listDrafts(user: UserClaims, ownerId: string, sort: 'recommend' | 'time') {
    if (ownerId !== user.sub) throw new ApiError('FORBIDDEN');

    const events = await this.prisma.event.findMany({
      where: { familyId: user.familyId, ownerId: user.sub, status: 'draft', deletedAt: null },
      orderBy: [{ occurredAt: 'desc' }],
    });

    const members = await this.prisma.user.findMany({ where: { familyId: user.familyId, userId: { not: user.sub } } });

    const items = await Promise.all(
      events.map(async (event) => ({
        eventId: event.eventId,
        occurredAt: event.occurredAt.toISOString(),
        eventType: event.eventType,
        title: event.cardTitle || event.description.slice(0, 30),
        confidence: event.confidence,
        confidenceLevel: event.confidenceLevel,
        riskLevel: event.riskLevel,
        recommendReason:
          event.shareTotal >= 2.5
            ? '最近发生的新鲜小事，家人容易理解，也与你关心的人相关。'
            : '这是一条近期生活记录，可以由你决定是否分享。',
        card: {
          cardId: event.cardId ?? `card_${event.eventId}`,
          version: event.cardVersion,
          renderMode: event.cardRenderMode,
          imageUrl: await this.cardUrl(event.cardImageKey),
          title: event.cardTitle,
          whatHappened: event.cardWhatHappened,
          aiAttribution: true as const,
          generation: { status: event.generationStatus === 'degraded' ? ('degraded' as const) : ('ok' as const) },
        },
        recipientPresets: members.map((member) => ({
          memberId: member.userId,
          displayName: member.displayName,
          role: member.role,
        })),
        requiresRiskAck: event.riskLevel === 'high',
      })),
    );

    if (sort === 'time') items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    else
      items.sort((a, b) => {
        const riskOrder = { none: 0, sensitive: 1, high: 2 } as const;
        const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        if (riskDiff !== 0) return riskDiff;
        if (a.confidenceLevel !== b.confidenceLevel) return a.confidenceLevel === 'high' ? -1 : 1;
        return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
      });

    return { items };
  }

  private cardOf(event: { cardId: string | null; eventId: string; cardVersion: number; cardRenderMode: string; cardImageKey: string | null; cardTitle: string; cardWhatHappened: string; generationStatus: string }, imageUrl: string | null) {
    return {
      cardId: event.cardId ?? `card_${event.eventId}`,
      version: event.cardVersion,
      renderMode: event.cardRenderMode,
      imageUrl,
      title: event.cardTitle,
      whatHappened: event.cardWhatHappened,
      aiAttribution: true as const,
      generation: { status: event.generationStatus === 'degraded' ? ('degraded' as const) : ('ok' as const) },
    };
  }

  async detail(eventId: string, user: UserClaims) {
    const event = await this.prisma.event.findFirst({
      where: { eventId, familyId: user.familyId, deletedAt: null },
      include: { views: true, shares: { orderBy: { createdAt: 'desc' } } },
    });
    if (!event) throw new ApiError('NOT_FOUND');

    const isOwner = event.ownerId === user.sub;
    const ownView = event.views.find((view) => view.recipientId === user.sub && view.isCurrent);
    if (!isOwner) {
      if (event.status !== 'shared' || !ownView) throw new ApiError('NOT_FOUND');
    }

    const imageUrl = await this.cardUrl(event.cardImageKey);
    const sessionAssets = event.sessionId
      ? await this.prisma.asset.findMany({ where: { captureSessionId: event.sessionId } })
      : [];
    const latestShare = event.shares.find((share) => share.status === 'confirmed') ?? null;

    return {
      event: {
        eventId: event.eventId,
        occurredAt: event.occurredAt.toISOString(),
        eventType: event.eventType,
        facts: {
          who: event.factsWho,
          action: event.factsAction,
          object: event.factsObject,
          scene: event.factsScene,
          time: event.factsTime,
        },
        description: event.description,
        confidence: event.confidence,
        confidenceLevel: event.confidenceLevel,
        risk: { level: event.riskLevel, items: Array.isArray(event.riskItems) ? (event.riskItems as string[]) : [] },
        status: event.status,
        aiAttribution: true as const,
        sourceAssetCount: sessionAssets.length,
        sourceAssetsCleaned: sessionAssets.some((asset) => asset.deletedAt !== null),
      },
      card: this.cardOf(event, imageUrl),
      views: event.views
        .filter((view) => (isOwner ? view.isCurrent : view.recipientId === user.sub && view.isCurrent))
        .map((view) => ({
          viewId: view.viewId,
          recipientId: view.recipientId,
          roleSnapshot: view.roleSnapshot,
          version: view.version,
          title: view.title,
          whatHappened: view.whatHappened,
          whyForYou: view.whyForYou,
          roleNote: view.roleNote,
          imageUrl,
          aiAttribution: true as const,
        })),
      share: latestShare
        ? {
            shareId: latestShare.shareId,
            scope: latestShare.scope,
            recipients: Array.isArray(latestShare.recipientIds) ? (latestShare.recipientIds as string[]) : [],
            status: latestShare.status,
            confirmedAt: latestShare.confirmedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async patch(eventId: string, user: UserClaims, body: unknown) {
    const input = patchEventSchema.parse(body);
    const event = await this.prisma.event.findFirst({ where: { eventId, familyId: user.familyId, deletedAt: null } });
    if (!event) throw new ApiError('NOT_FOUND');
    if (event.ownerId !== user.sub) throw new ApiError('FORBIDDEN');

    const target = input.action === 'ignore' ? 'ignored' : input.action === 'restore' ? 'draft' : event.status;
    if (target !== event.status) {
      const transition = canTransition(event.status, target as never);
      if (!transition.ok) throw new ApiError('INVALID_STATE_TRANSITION', undefined, undefined, { data: { allowed: transition.allowed } });
    }

    const updated = await this.prisma.event.update({
      where: { eventId },
      data: {
        status: target as never,
        cardTitle: input.patch?.title ?? event.cardTitle,
        description: input.patch?.description ?? event.description,
        correctionVersion: input.action === 'correct' ? { increment: 1 } : event.correctionVersion,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        familyId: user.familyId,
        actorId: user.sub,
        action: `event.${input.action}`,
        targetType: 'Event',
        targetId: eventId,
        before: { status: event.status },
        after: { status: updated.status },
      },
    });

    return { status: updated.status, version: updated.correctionVersion };
  }

  async remove(eventId: string, user: UserClaims) {
    const event = await this.prisma.event.findFirst({ where: { eventId, familyId: user.familyId, deletedAt: null } });
    if (!event) throw new ApiError('NOT_FOUND');
    if (event.ownerId !== user.sub) throw new ApiError('FORBIDDEN');

    await this.prisma.$transaction([
      this.prisma.share.updateMany({
        where: { eventId, status: 'confirmed' },
        data: { status: 'revoked', revokedAt: new Date(), operatorId: user.sub },
      }),
      this.prisma.event.update({
        where: { eventId },
        data: { status: 'deleted', visibility: 'owner_only', deletedAt: new Date() },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        familyId: user.familyId,
        actorId: user.sub,
        action: 'event.delete',
        targetType: 'Event',
        targetId: eventId,
      },
    });

    return { deleted: true };
  }
}