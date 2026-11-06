import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { ShareService } from './share.service';

@Controller('events/:eventId/share')
export class ShareController {
  constructor(private readonly shares: ShareService) {}

  @Post('preview')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  preview(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    return this.shares.preview(eventId, requireUser(claims), body);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  share(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    return this.shares.share(eventId, requireUser(claims), body);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  revoke(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims, @Body() body: { shareId?: string }) {
    return this.shares.revoke(eventId, requireUser(claims), body?.shareId);
  }
}