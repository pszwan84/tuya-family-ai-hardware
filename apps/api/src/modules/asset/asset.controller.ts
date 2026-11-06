import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { AssetService } from './asset.service';

@Controller('assets')
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get('content')
  async content(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() response: Response,
  ) {
    const payload = await this.assets.readSigned(key, Number(exp), sig);
    response.setHeader('content-type', payload.contentType);
    response.setHeader('cache-control', 'private, max-age=60');
    response.send(payload.data);
  }

  @Get(':assetId/url')
  @UseGuards(JwtAuthGuard)
  url(@Param('assetId') assetId: string, @CurrentClaims() claims: AnyClaims) {
    const user = requireUser(claims);
    return this.assets.signedUrl(assetId, user.sub, user.familyId);
  }

  @Post(':assetId/reprocess')
  @UseGuards(JwtAuthGuard)
  reprocess(@Param('assetId') assetId: string, @CurrentClaims() claims: AnyClaims) {
    const user = requireUser(claims);
    return this.assets.reprocess(assetId, user.sub, user.familyId);
  }
}