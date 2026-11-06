import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { heartbeatSchema, patchDeviceSchema, type Heartbeat } from '@fah/contracts';
import { ApiError } from '../../common/api-error';
import type { AnyClaims, DeviceClaims } from '../../common/auth';
import { ConfigService } from '../../infra/config.service';
import { PrismaService } from '../../infra/prisma.service';
import { TuyaService } from '../../infra/tuya.service';

const usedNonces = new Map<string, number>();

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tuya: TuyaService,
  ) {}

  async issueToken(
    deviceId: string,
    timestamp: string | undefined,
    nonce: string | undefined,
    signature: string | undefined,
  ) {
    if (!timestamp || !nonce || !signature) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');
    const timestampSec = Number(timestamp);
    if (!Number.isFinite(timestampSec) || Math.abs(Date.now() / 1000 - timestampSec) > this.config.deviceClockSkewSec) {
      throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');
    }

    const nonceKey = `${deviceId}:${nonce}`;
    const now = Date.now();
    for (const [key, expiresAt] of usedNonces) {
      if (expiresAt < now) usedNonces.delete(key);
    }
    if (usedNonces.has(nonceKey)) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');

    const device = await this.prisma.device.findUnique({ where: { deviceId } });
    if (!device) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');

    const payload = `POST/api/v1/devices/${deviceId}/token${timestamp}${nonce}`;
    const expected = createHmac('sha256', device.deviceKey).update(payload).digest('hex');
    const provided = signature.toLowerCase();
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');
    }

    usedNonces.set(nonceKey, now + this.config.deviceClockSkewSec * 1000);
    const claims: DeviceClaims = {
      sub: deviceId,
      type: 'device',
      familyId: device.familyId,
      ownerId: device.ownerId,
    };
    return {
      accessToken: this.jwt.sign(claims, { expiresIn: this.config.deviceTokenTtlSec }),
      expiresInSec: this.config.deviceTokenTtlSec,
      familyId: device.familyId,
    };
  }

  private async deviceOf(deviceId: string, claims: AnyClaims) {
    const device = await this.prisma.device.findUnique({ where: { deviceId } });
    if (!device || device.familyId !== claims.familyId) throw new ApiError('NOT_FOUND');
    if (claims.type === 'device' && claims.sub !== deviceId) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');
    if (claims.type === 'user' && device.ownerId !== claims.sub) throw new ApiError('FORBIDDEN');
    return device;
  }

  async heartbeat(deviceId: string, claims: AnyClaims, body: unknown) {
    const device = await this.deviceOf(deviceId, claims);
    const input: Heartbeat = heartbeatSchema.parse(body);
    const online = true;
    await this.prisma.device.update({
      where: { deviceId: device.deviceId },
      data: {
        lastSeenAt: new Date(),
        fwVersion: input.fwVersion,
        protoVersion: input.protoVersion ?? device.protoVersion,
        collectState: input.collectState,
        queueDepth: input.queueDepth,
        freeMB: input.freeMB,
        privacyLed: input.privacyLed,
        reportedVersion: input.reportedVersion,
      },
    });

    const pending = await this.prisma.deviceCommand.findMany({
      where: { deviceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    if (pending.length > 0) {
      await this.prisma.deviceCommand.updateMany({
        where: { commandId: { in: pending.map((command) => command.commandId) } },
        data: { status: 'sent' },
      });
    }

    void online;
    return {
      desiredCollectState: device.collectState,
      desiredVersion: device.desiredVersion,
      serverTime: new Date().toISOString(),
      resendCommands: pending.map((command) => ({
        id: command.commandId,
        type: command.type as 'capture_now' | 'set_switch' | 'set_policy',
        payload: command.payload as Record<string, unknown>,
        version: command.version,
      })),
    };
  }

  async list(claims: AnyClaims) {
    const user = claims.type === 'user' ? claims : null;
    if (!user) throw new ApiError('FORBIDDEN');
    const devices = await this.prisma.device.findMany({
      where: { familyId: user.familyId, ownerId: user.sub },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: devices.map((device) => {
        const onlineByHeartbeat = device.lastSeenAt
          ? Date.now() - device.lastSeenAt.getTime() <= this.config.deviceOfflineSec * 1000
          : false;
        return {
          deviceId: device.deviceId,
          online: onlineByHeartbeat,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          collectState: device.collectState,
          queueDepth: device.queueDepth,
          freeMB: device.freeMB,
          firmware: { fwVersion: device.fwVersion, protoVersion: device.protoVersion },
          pendingOnOnline: device.desiredVersion > device.reportedVersion,
        };
      }),
    };
  }

  async status(deviceId: string, claims: AnyClaims) {
    const device = await this.deviceOf(deviceId, claims);
    const tuyaState = await this.tuya.queryDeviceState();
    const lastSeenAt = device.lastSeenAt;
    const onlineByHeartbeat = lastSeenAt ? Date.now() - lastSeenAt.getTime() <= this.config.deviceOfflineSec * 1000 : false;
    const online = tuyaState ? onlineByHeartbeat && tuyaState.online : onlineByHeartbeat;
    return {
      deviceId: device.deviceId,
      online,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
      collectState: device.collectState,
      queueDepth: device.queueDepth,
      freeMB: device.freeMB,
      lastUpload: null,
      firmware: { fwVersion: device.fwVersion, protoVersion: device.protoVersion },
      pendingOnOnline: device.desiredVersion > device.reportedVersion,
    };
  }

  async patch(deviceId: string, claims: AnyClaims, body: unknown) {
    const device = await this.deviceOf(deviceId, claims);
    const input = patchDeviceSchema.parse(body);
    const nextCollectState = input.collectState ?? device.collectState;
    const nextPolicy = input.policy ?? device.policy;
    const updated = await this.prisma.device.update({
      where: { deviceId: device.deviceId },
      data: {
        collectState: nextCollectState,
        policy: nextPolicy as object,
        desiredVersion: { increment: 1 },
      },
    });

    const online = updated.lastSeenAt
      ? Date.now() - updated.lastSeenAt.getTime() <= this.config.deviceOfflineSec * 1000
      : false;

    if (!online) {
      await this.prisma.deviceCommand.create({
        data: {
          familyId: updated.familyId,
          deviceId: updated.deviceId,
          type: input.collectState ? 'set_switch' : 'set_policy',
          payload: (input.collectState ? { collectState: input.collectState } : input.policy) as object,
          version: updated.desiredVersion,
          status: 'pending',
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        familyId: updated.familyId,
        actorId: claims.type === 'user' ? claims.sub : updated.ownerId,
        action: 'device.update',
        targetType: 'Device',
        targetId: updated.deviceId,
        after: { collectState: updated.collectState, policy: updated.policy as object },
      },
    });

    return {
      effective: online ? 'applied' : 'pending_on_online',
      version: updated.desiredVersion,
    };
  }

  async bind(userId: string, familyId: string, activationCode: string) {
    const device = await this.prisma.device.findUnique({ where: { activationCode } });
    if (!device) throw new ApiError('NOT_FOUND');
    if (device.familyId && device.familyId !== familyId) throw new ApiError('FORBIDDEN');
    const updated = await this.prisma.device.update({
      where: { deviceId: device.deviceId },
      data: { familyId, ownerId: userId, activationCode: null },
    });
    return { deviceId: updated.deviceId };
  }

  async commands(deviceId: string, claims: AnyClaims) {
    await this.deviceOf(deviceId, claims);
    const commands = await this.prisma.deviceCommand.findMany({
      where: { deviceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    return {
      commands: commands.map((command) => ({
        id: command.commandId,
        type: command.type as 'capture_now' | 'set_switch' | 'set_policy',
        payload: command.payload as Record<string, unknown>,
        version: command.version,
      })),
    };
  }

  async createActivationCode(familyId: string, ownerId: string, tuyaDeviceId: string) {
    const code = `ACT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const device = await this.prisma.device.create({
      data: {
        familyId: '',
        ownerId,
        tuyaDeviceId,
        deviceKey: randomUUID().replaceAll('-', ''),
        activationCode: code,
        capability: {},
        policy: {},
      },
    });
    await this.prisma.device.update({ where: { deviceId: device.deviceId }, data: { familyId } });
    return { deviceId: device.deviceId, activationCode: code };
  }
}