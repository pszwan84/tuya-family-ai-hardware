import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('demo/seed')
  @HttpCode(200)
  seed(@Headers('x-demo-key') key?: string) {
    return this.admin.seed(key);
  }

  @Post('demo/reset')
  @HttpCode(200)
  reset(@Headers('x-demo-key') key?: string) {
    return this.admin.reset(key);
  }

  @Post('demo/process/:assetId')
  @HttpCode(200)
  process(@Param('assetId') assetId: string, @Headers('x-demo-key') key?: string) {
    return this.admin.processAsset(key, assetId);
  }

  @Post('demo/cleanup')
  @HttpCode(200)
  cleanup(@Headers('x-demo-key') key?: string) {
    return this.admin.cleanup(key);
  }

  @Get('metrics')
  async metrics(@Headers('x-demo-key') key: string | undefined, @Res() response: Response) {
    const text = await this.admin.metrics(key);
    response.setHeader('content-type', 'text/plain; version=0.0.4');
    response.send(text);
  }

  @Get('audit')
  audit(
    @Headers('x-demo-key') key: string | undefined,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
  ) {
    return this.admin.audit(key, from, to, action);
  }
}