import { Injectable } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cleanupExpiredAssets } from '@fah/pipeline';
import { ApiError } from '../../common/api-error';
import { hashPassword } from '../auth/auth.service';
import { PipelineFactory } from '../../infra/pipeline.factory';
import { PipelineRunner } from '../../infra/pipeline.runner';
import { PrismaService } from '../../infra/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: PipelineRunner,
    private readonly pipeline: PipelineFactory,
  ) {}

  private assertDemoKey(key: string | undefined) {
    const expected = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';
    if ((process.env.DEMO_MODE ?? 'true') === 'false' || key !== expected) throw new ApiError('FORBIDDEN');
  }

  async seed(key: string | undefined) {
    this.assertDemoKey(key);

    const existingFamily = await this.prisma.family.findFirst({ where: { name: '家事演示家庭' } });
    const family =
      existingFamily ??
      (await this.prisma.family.create({
        data: { name: '家事演示家庭', retentionDays: 30, defaultShareScope: 'members' },
      }));

    const passwordHash = hashPassword('demo1234');
    const usersSeed = [
      { loginIdentifier: 'gp01', displayName: '奶奶', role: 'grandparent' as const, isMinor: false, guardianId: null },
      { loginIdentifier: 'mid01', displayName: '妈妈', role: 'middle' as const, isMinor: false, guardianId: null },
      { loginIdentifier: 'kid01', displayName: '小满', role: 'child' as const, isMinor: true, guardianId: null },
    ];

    const users = [];
    for (const seedUser of usersSeed) {
      const user = await this.prisma.user.upsert({
        where: { loginIdentifier: seedUser.loginIdentifier },
        create: {
          familyId: family.familyId,
          displayName: seedUser.displayName,
          role: seedUser.role,
          isMinor: seedUser.isMinor,
          loginIdentifier: seedUser.loginIdentifier,
          passwordHash,
        },
        update: { familyId: family.familyId, displayName: seedUser.displayName, role: seedUser.role, isMinor: seedUser.isMinor },
      });
      users.push(user);
    }

    const [gp, mid, kid] = users;
    await this.prisma.user.update({ where: { userId: kid.userId }, data: { guardianId: mid.userId } });

    const relations = [
      { subjectUserId: gp.userId, objectUserId: mid.userId, type: 'child', isGuardianship: false },
      { subjectUserId: mid.userId, objectUserId: gp.userId, type: 'parent', isGuardianship: false },
      { subjectUserId: kid.userId, objectUserId: mid.userId, type: 'parent', isGuardianship: true },
      { subjectUserId: mid.userId, objectUserId: kid.userId, type: 'child', isGuardianship: true },
      { subjectUserId: gp.userId, objectUserId: kid.userId, type: 'grandchild', isGuardianship: false },
    ];
    for (const relation of relations) {
      await this.prisma.relation.upsert({
        where: {
          subjectUserId_objectUserId_type: {
            subjectUserId: relation.subjectUserId,
            objectUserId: relation.objectUserId,
            type: relation.type,
          },
        },
        create: { familyId: family.familyId, canViewShared: true, ...relation },
        update: { canViewShared: true, isGuardianship: relation.isGuardianship },
      });
    }

    const devices = [
      { ownerId: gp.userId, deviceKey: 'key_gp_01', activationCode: 'ACT-GP01', tuyaDeviceId: 'tuya_gp_01' },
      { ownerId: mid.userId, deviceKey: 'key_mid_01', activationCode: 'ACT-MID01', tuyaDeviceId: 'tuya_mid_01' },
    ];
    const seededDevices = [];
    for (const device of devices) {
      const created = await this.prisma.device.upsert({
        where: { activationCode: device.activationCode },
        create: {
          familyId: family.familyId,
          ownerId: device.ownerId,
          tuyaDeviceId: device.tuyaDeviceId,
          deviceKey: device.deviceKey,
          activationCode: device.activationCode,
          capability: {},
          policy: { minIntervalSec: 60, dailyLimit: 20 },
          collectState: 'enabled',
        },
        update: { familyId: family.familyId, ownerId: device.ownerId, deviceKey: device.deviceKey },
      });
      seededDevices.push(created);
    }

    return {
      familyId: family.familyId,
      members: users.map((user) => ({ userId: user.userId, loginIdentifier: user.loginIdentifier, role: user.role })),
      devices: seededDevices.map((device) => ({ deviceId: device.deviceId, ownerId: device.ownerId, deviceKey: device.deviceKey })),
    };
  }

  async reset(key: string | undefined) {
    this.assertDemoKey(key);
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({}),
      this.prisma.auditLog.deleteMany({}),
      this.prisma.share.deleteMany({}),
      this.prisma.eventView.deleteMany({}),
      this.prisma.event.deleteMany({}),
      this.prisma.asset.deleteMany({}),
      this.prisma.captureSession.deleteMany({}),
      this.prisma.deviceCommand.deleteMany({}),
      this.prisma.device.deleteMany({}),
      this.prisma.relation.deleteMany({}),
      this.prisma.userSettings.deleteMany({}),
      this.prisma.user.deleteMany({}),
      this.prisma.family.deleteMany({}),
    ]);

    const storageDir = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'data', 'storage'));
    await rm(storageDir, { recursive: true, force: true });

    return { reset: true, storageDir };
  }

  async processAsset(key: string | undefined, assetId: string) {
    this.assertDemoKey(key);
    const result = await this.runner.runNow(assetId);
    return { assetId, result };
  }

  async cleanup(key: string | undefined) {
    this.assertDemoKey(key);
    return cleanupExpiredAssets(this.pipeline.create());
  }

  async metrics(key: string | undefined) {
    this.assertDemoKey(key);
    const [assets, events, shares, online, dead] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.event.count(),
      this.prisma.share.count({ where: { status: 'confirmed' } }),
      this.prisma.device.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 90000) } } }),
      this.prisma.event.count({ where: { generationStatus: 'degraded' } }),
    ]);
    return [
      `# HELP fah_upload_total Accepted assets`,
      `# TYPE fah_upload_total counter`,
      `fah_upload_total ${assets}`,
      `fah_events_total ${events}`,
      `fah_share_confirmed_total ${shares}`,
      `fah_device_online ${online}`,
      `fah_job_degraded_total ${dead}`,
    ].join('\n');
  }

  async audit(key: string | undefined, from?: string, to?: string, action?: string) {
    this.assertDemoKey(key);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      items: logs.map((log) => ({
        auditId: log.auditId,
        actorId: log.actorId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        createdAt: log.createdAt.toISOString(),
        after: log.after,
      })),
    };
  }
}