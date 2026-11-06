import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { AuthService } from './auth.service';

const loginSchema = z.object({ identifier: z.string().min(1), password: z.string().min(1) });
const switchSchema = z.object({ memberKey: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.auth.login(input.identifier, input.password);
  }

  @Post('demo-switch')
  @HttpCode(200)
  demoSwitch(@Body() body: unknown, @Headers('x-demo-key') demoKey?: string) {
    const input = switchSchema.parse(body);
    return this.auth.demoSwitch(input.memberKey, demoKey);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentClaims() claims: AnyClaims) {
    const user = requireUser(claims);
    return this.auth.me(user.sub);
  }
}