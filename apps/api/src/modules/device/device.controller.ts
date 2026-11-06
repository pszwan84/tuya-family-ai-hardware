import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { bindDeviceSchema, heartbeatSchema } from '@fah/contracts';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { DeviceService } from './device.service';

@Controller('devices')
export class DeviceController {
  constructor(private readonly devices: DeviceService) {}

  @Post('bind')
  @UseGuards(JwtAuthGuard)
  bind(@CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    const user = requireUser(claims);
    const input = bindDeviceSchema.parse(body);
    return this.devices.bind(user.sub, user.familyId, input.activationCode);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentClaims() claims: AnyClaims) {
    return this.devices.list(claims);
  }

  @Post(':deviceId/token')
  @HttpCode(200)
  token(
    @Param('deviceId') deviceId: string,
    @Headers('x-timestamp') timestamp?: string,
    @Headers('x-nonce') nonce?: string,
    @Headers('x-signature') signature?: string,
  ) {
    return this.devices.issueToken(deviceId, timestamp, nonce, signature);
  }

  @Post(':deviceId/heartbeat')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  heartbeat(@Param('deviceId') deviceId: string, @CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    heartbeatSchema.parse(body);
    return this.devices.heartbeat(deviceId, claims, body);
  }

  @Get(':deviceId/status')
  @UseGuards(JwtAuthGuard)
  status(@Param('deviceId') deviceId: string, @CurrentClaims() claims: AnyClaims) {
    return this.devices.status(deviceId, claims);
  }

  @Patch(':deviceId')
  @UseGuards(JwtAuthGuard)
  patch(@Param('deviceId') deviceId: string, @CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    return this.devices.patch(deviceId, claims, body);
  }

  @Get(':deviceId/commands')
  @UseGuards(JwtAuthGuard)
  commands(@Param('deviceId') deviceId: string, @CurrentClaims() claims: AnyClaims) {
    return this.devices.commands(deviceId, claims);
  }
}