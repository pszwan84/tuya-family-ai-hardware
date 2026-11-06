import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentClaims, JwtAuthGuard, requireDevice, type AnyClaims } from '../../common/auth';
import { DeviceIngressService } from './device-ingress.service';

@Controller('devices')
export class DeviceIngressController {
  constructor(private readonly ingress: DeviceIngressService) {}

  @Post(':deviceId/assets')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @Param('deviceId') deviceId: string,
    @CurrentClaims() claims: AnyClaims,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { metadata?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const device = requireDevice(claims);
    void idempotencyKey;
    return this.ingress.accept(deviceId, device, file?.buffer, body?.metadata);
  }
}