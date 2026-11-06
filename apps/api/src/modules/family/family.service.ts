import { Injectable } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '@fah/domain';
import { settingsSchema } from '@fah/contracts';
import { ApiError } from '../../common/api-error';
import type { UserClaims } from '../../common/auth';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async members(familyId: string, user: UserClaims) {
    if (familyId !== user.familyId) throw new ApiError('FORBIDDEN');
    const members = await this.prisma.user.findMany({ where: { familyId } });
    const relations = await this.prisma.relation.findMany({ where: { familyId } });
    return {
      members: members.map((member) => ({
        memberId: member.userId,
        displayName: member.displayName,
        role: member.role,
        isMinor: member.isMinor,
        guardianId: member.guardianId,
      })),
      relations,
    };
  }

  async feed(
    familyId: string,
    user: UserClaims,
    filters: { memberId?: string; from?: string; to?: string; cursor?: string; limit?: string },
  ) {
    if (familyId !== user.familyId) throw new ApiError('FORBIDDEN');
    const limit = Math.min(Math.max(Number(filters.limit ?? 20), 1), 50);
    const cursor = decodeCursor(filters.cursor);

    const views = await this.prisma.eventView.findMany({
      where: {
        familyId,
        recipientId: user.sub,
        isCurrent: true,
        event: {
          status: 'shared',
          deletedAt: null,
          ...(filters.memberId ? { ownerId: filters.memberId } : {}),
          ...(filters.from || filters.to
            ? {
                occurredAt: {
                  ...(filters.from ? { gte: new Date(filters.from) } : {}),
                  ...(filters.to ? { lte: new Date(filters.to) } : {}),
                },
              }
            : {}),
        },
      },
      include: { event: { include: { owner: true } } },
      orderBy: [{ event: { occurredAt: 'desc' } }, { viewId: 'desc' }],
      take: limit + 1,
    });

    const filtered = cursor
      ? views.filter((view) => {
          const time = view.event.occurredAt.getTime();
          const cursorTime = new Date(cursor.occurredAt).getTime();
          return time < cursorTime || (time === cursorTime && view.viewId < cursor.id);
        })
      : views;

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > page.length;
    const last = page[page.length - 1];

    const items = await Promise.all(
      page.map(async (view) => ({
        viewId: view.viewId,
        eventId: view.eventId,
        occurredAt: view.event.occurredAt.toISOString(),
        owner: {
          memberId: view.event.ownerId,
          displayName: view.event.owner.displayName,
          role: view.event.owner.role,
        },
        title: view.title,
        whatHappened: view.whatHappened,
        whyForYou: view.whyForYou,
        roleNote: view.roleNote,
        card: {
          imageUrl: view.imageKey ? await this.storage.presign(view.imageKey, 300) : null,
          renderMode: view.event.cardRenderMode,
          aiAttribution: true as const,
        },
        aiAttribution: true as const,
      })),
    );

    return {
      items,
      meta: {
        cursor: hasMore && last ? encodeCursor({ occurredAt: last.event.occurredAt.toISOString(), id: last.viewId }) : undefined,
        hasMore,
      },
    };
  }

  async overview(familyId: string, user: UserClaims, days: number) {
    if (familyId !== user.familyId) throw new ApiError('FORBIDDEN');
    const since = new Date(Date.now() - days * 86400000);
    const views = await this.prisma.eventView.findMany({
      where: { familyId, recipientId: user.sub, isCurrent: true, event: { status: 'shared', occurredAt: { gte: since } } },
      include: { event: { include: { owner: true } } },
    });
    const owners = new Map<string, { memberId: string; displayName: string; role: string }>();
    for (const view of views) {
      owners.set(view.event.ownerId, {
        memberId: view.event.ownerId,
        displayName: view.event.owner.displayName,
        role: view.event.owner.role,
      });
    }
    return {
      newEventCount: views.length,
      activeMembers: [...owners.values()],
      changes: [...owners.values()].map((member) => `${member.displayName}最近有 ${views.filter((view) => view.event.ownerId === member.memberId).length} 条生活记录`),
    };
  }

  async timeline(user: UserClaims, cursorRaw?: string, limitRaw?: string) {
    const limit = Math.min(Math.max(Number(limitRaw ?? 20), 1), 50);
    const cursor = decodeCursor(cursorRaw);
    const events = await this.prisma.event.findMany({
      where: { familyId: user.familyId, ownerId: user.sub, deletedAt: null },
      orderBy: [{ occurredAt: 'desc' }, { eventId: 'desc' }],
      take: limit + 1,
    });
    const filtered = cursor
      ? events.filter((event) => {
          const time = event.occurredAt.getTime();
          const cursorTime = new Date(cursor.occurredAt).getTime();
          return time < cursorTime || (time === cursorTime && event.eventId < cursor.id);
        })
      : events;
    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > page.length;
    const last = page[page.length - 1];
    return {
      items: page.map((event) => ({
        eventId: event.eventId,
        occurredAt: event.occurredAt.toISOString(),
        eventType: event.eventType,
        title: event.cardTitle,
        status: event.status,
        imageUrl: event.cardImageKey ? undefined : null,
        confidenceLevel: event.confidenceLevel,
      })),
      meta: {
        cursor: hasMore && last ? encodeCursor({ occurredAt: last.occurredAt.toISOString(), id: last.eventId }) : undefined,
        hasMore,
      },
    };
  }

  async settings(user: UserClaims) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId: user.sub } });
    if (!settings) {
      return { defaultScope: 'members', retentionDays: 30, notifyFrequency: 'daily', quietHours: null };
    }
    return {
      defaultScope: settings.defaultScope,
      retentionDays: settings.retentionDays,
      notifyFrequency: settings.notifyFrequency,
      quietHours: settings.quietHours,
    };
  }

  async updateSettings(user: UserClaims, body: unknown) {
    const input = settingsSchema.parse(body);
    const settings = await this.prisma.userSettings.upsert({
      where: { userId: user.sub },
      create: {
        userId: user.sub,
        defaultScope: input.defaultScope,
        retentionDays: input.retentionDays,
        notifyFrequency: input.notifyFrequency,
        quietHours: input.quietHours ?? undefined,
      },
      update: {
        defaultScope: input.defaultScope,
        retentionDays: input.retentionDays,
        notifyFrequency: input.notifyFrequency,
        quietHours: input.quietHours ?? undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        familyId: user.familyId,
        actorId: user.sub,
        action: 'settings.update',
        targetType: 'UserSettings',
        targetId: user.sub,
        after: { defaultScope: settings.defaultScope, retentionDays: settings.retentionDays },
      },
    });
    return {
      defaultScope: settings.defaultScope,
      retentionDays: settings.retentionDays,
      notifyFrequency: settings.notifyFrequency,
      quietHours: settings.quietHours,
    };
  }
}