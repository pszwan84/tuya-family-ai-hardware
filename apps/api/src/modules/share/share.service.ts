import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { canShare, canTransition, isQuietHour } from '@fah/domain';
import { ensureViews } from '@fah/pipeline';
import { sharePreviewRequestSchema, shareRequestSchema } from '@fah/contracts';
import { ApiError } from '../../common/api-error';
import type { UserClaims } from '../../common/auth';
import { ConfigService } from '../../infra/config.service';
import { PipelineFactory } from '../../infra/pipeline.factory';
import { PrismaService } from '../../infra/prisma.service';

@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineFactory,
    private readonly config: ConfigService,
  ) {}

  private async eventOwned(eventId: string, user: UserClaims) {
    const event = await this.prisma.event.findFirst({ where: { eventId, familyId: user.familyId, deletedAt: null } });
    if (!event) throw new ApiError('NOT_FOUND');
    if (event.ownerId !== user.sub) throw new ApiError('FORBIDDEN');
    return event;
  }

  private riskToken(eventId: string, userId: string): string {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const signature = createHmac('sha256', this.config.storageSecret).update(`${eventId}:${userId}:${exp}`).digest('hex');
    return `${exp}.${signature}`;
  }

  private verifyRiskToken(token: string | undefined, eventId: string, userId: string): boolean {
    if (!token) return false;
    const [expRaw, signature] = token.split('.');
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = Buffer.from(createHmac('sha256', this.config.storageSecret).update(`${eventId}:${userId}:${exp}`).digest('hex'));
    const provided = Buffer.from(signature ?? '');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  private async assertRecipients(event: { familyId: string; ownerId: string }, recipientIds: string[]) {
    const recipients = await this.prisma.user.findMany({
      where: { familyId: event.familyId, userId: { in: recipientIds } },
    });
    if (recipients.length !== recipientIds.length) throw new ApiError('INVALID_RECIPIENT');
    return recipients;
  }

  async preview(eventId: string, user: UserClaims, body: unknown) {
    const input = sharePreviewRequestSchema.parse(body);
    const event = await this.eventOwned(eventId, user);
    const recipients = await this.assertRecipients(event, input.recipientIds);
    const views = await ensureViews(this.pipeline.create(), eventId, input.recipientIds);
    const requiresAck = event.riskLevel === 'high';
    return {
      previews: views.map((view) => ({
        memberId: view.memberId,
        role: recipients.find((recipient) => recipient.userId === view.memberId)?.role ?? view.role,
        title: view.title,
        whatHappened: view.whatHappened,
        whyForYou: view.whyForYou,
        roleNote: view.roleNote,
        imageUrl: view.imageUrl,
        aiAttribution: true,
      })),
      risk: {
        level: event.riskLevel,
        items: Array.isArray(event.riskItems) ? (event.riskItems as string[]) : [],
        requiresAck,
        riskAckToken: requiresAck ? this.riskToken(eventId, user.sub) : undefined,
      },
    };
  }

  private async notify(event: { familyId: string; eventId: string; cardTitle: string; ownerId: string }, recipientIds: string[]) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.getRuntime().notifyAggregateWindowMin * 60000);
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dailyLimit = this.config.getRuntime().notifyDailyLimit;
    const owner = await this.prisma.user.findUnique({ where: { userId: event.ownerId } });
    const recipientSettings = await this.prisma.userSettings.findMany({ where: { userId: { in: recipientIds } } });

    for (const recipientId of recipientIds) {
      const settings = recipientSettings.find((item) => item.userId === recipientId);
      const quietHours = settings?.quietHours as { start: string; end: string } | null | undefined;
      if (isQuietHour(quietHours ?? null, now)) continue;
      const limit = settings?.notifyFrequency === 'realtime' ? Math.max(dailyLimit, 10) : dailyLimit;

      const todayCount = await this.prisma.notification.count({
        where: { familyId: event.familyId, recipientId, createdAt: { gte: dayStart } },
      });
      if (todayCount >= limit) continue;

      const existing = await this.prisma.notification.findFirst({
        where: { familyId: event.familyId, recipientId, type: 'family_digest', windowStart: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        await this.prisma.notification.update({
          where: { notificationId: existing.notificationId },
          data: { count: { increment: 1 } },
        });
      } else {
        await this.prisma.notification.create({
          data: {
            familyId: event.familyId,
            recipientId,
            type: 'family_digest',
            count: 1,
            windowStart: now,
            payload: {
              href: '/family/feed',
              ownerName: owner?.displayName ?? '家人',
              title: event.cardTitle,
              eventId: event.eventId,
            },
          },
        });
      }
    }
  }

  async share(eventId: string, user: UserClaims, body: unknown, idempotencyKey?: string) {
    const input = shareRequestSchema.parse(body);
    const event = await this.eventOwned(eventId, user);
    const recipients = await this.assertRecipients(event, input.recipientIds);
    const guard = canShare(
      {
        userId: user.sub,
        familyId: user.familyId,
        role: user.role,
        isMinor: user.isMinor,
      },
      {
        familyId: event.familyId,
        ownerId: event.ownerId,
        status: event.status,
        visibility: event.visibility as 'owner_only' | 'shared',
      },
      recipients.map((recipient) => ({
        userId: recipient.userId,
        familyId: recipient.familyId,
        role: recipient.role,
        isMinor: recipient.isMinor,
      })),
    );
    if (!guard.allowed) throw new ApiError(guard.reason === 'no_recipient' ? 'NO_RECIPIENT' : 'FORBIDDEN');

    const transition = canTransition(event.status, 'shared');
    if (!transition.ok) throw new ApiError('INVALID_STATE_TRANSITION');

    if (event.riskLevel === 'high' && !this.verifyRiskToken(input.riskAckToken, eventId, user.sub)) {
      throw new ApiError('RISK_ACK_REQUIRED');
    }

    const sortedRecipients = [...input.recipientIds].sort();
    const shareKey = idempotencyKey ?? `${eventId}|${sortedRecipients.join(',')}|${input.scope}`;
    const existingShare = await this.prisma.share.findFirst({
      where: { familyId: user.familyId, idempotencyKey: shareKey, status: { not: 'revoked' } },
    });
    const views = await ensureViews(this.pipeline.create(), eventId, sortedRecipients);

    if (existingShare) {
      return {
        shareId: existingShare.shareId,
        status: 'shared' as const,
        effectiveAt: (existingShare.confirmedAt ?? new Date()).toISOString(),
        views: views.map((view) => ({ memberId: view.memberId, viewId: view.viewId, role: view.role })),
      };
    }

    const share = await this.prisma.$transaction(async (tx) => {
      const created = await tx.share.create({
        data: {
          familyId: event.familyId,
          eventId,
          ownerId: event.ownerId,
          scope: input.scope,
          recipientIds: sortedRecipients,
          status: 'confirmed',
          idempotencyKey: shareKey,
          confirmedAt: new Date(),
          operatorId: user.sub,
        },
      });
      await tx.event.update({
        where: { eventId },
        data: { status: 'shared', visibility: 'shared' },
      });
      await tx.auditLog.create({
        data: {
          familyId: event.familyId,
          actorId: user.sub,
          action: 'event.share',
          targetType: 'Event',
          targetId: eventId,
          after: { shareId: created.shareId, recipients: sortedRecipients, scope: input.scope },
        },
      });
      return created;
    });

    await this.notify(
      { familyId: event.familyId, eventId, cardTitle: event.cardTitle, ownerId: event.ownerId },
      sortedRecipients,
    );

    return {
      shareId: share.shareId,
      status: 'shared' as const,
      effectiveAt: (share.confirmedAt ?? new Date()).toISOString(),
      views: views.map((view) => ({ memberId: view.memberId, viewId: view.viewId, role: view.role })),
    };
  }

  async revoke(eventId: string, user: UserClaims, shareId?: string) {
    const event = await this.eventOwned(eventId, user);
    const shares = await this.prisma.share.findMany({
      where: { eventId, familyId: event.familyId, status: 'confirmed', ...(shareId ? { shareId } : {}) },
    });
    if (shares.length === 0) {
      return { shareIds: [], status: 'revoked' as const, revokedAt: new Date().toISOString() };
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.share.updateMany({
        where: { shareId: { in: shares.map((share) => share.shareId) } },
        data: { status: 'revoked', revokedAt: now, operatorId: user.sub },
      }),
      this.prisma.event.update({ where: { eventId }, data: { status: 'revoked', visibility: 'owner_only' } }),
      this.prisma.auditLog.create({
        data: {
          familyId: event.familyId,
          actorId: user.sub,
          action: 'event.revoke',
          targetType: 'Event',
          targetId: eventId,
          before: { status: event.status },
          after: { status: 'revoked', shareIds: shares.map((share) => share.shareId) },
        },
      }),
    ]);

    return { shareIds: shares.map((share) => share.shareId), status: 'revoked' as const, revokedAt: now.toISOString() };
  }
}