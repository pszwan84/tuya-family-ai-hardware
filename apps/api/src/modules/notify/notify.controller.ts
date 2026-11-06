import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { PrismaService } from '../../infra/prisma.service';

@Controller('notifications')
export class NotifyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentClaims() claims: AnyClaims) {
    const user = requireUser(claims);
    const notifications = await this.prisma.notification.findMany({
      where: { familyId: user.familyId, recipientId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      items: notifications.map((notification) => {
        const payload = (notification.payload ?? {}) as Record<string, string>;
        return {
          id: notification.notificationId,
          type: 'family_digest' as const,
          count: notification.count,
          entry: {
            familyId: notification.familyId,
            memberId: payload.ownerName ?? '',
            href: payload.href ?? '/family/feed',
          },
        };
      }),
    };
  }
}