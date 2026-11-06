import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { FamilyService } from './family.service';

@Controller('families/:familyId')
@UseGuards(JwtAuthGuard)
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  @Get('members')
  members(@Param('familyId') familyId: string, @CurrentClaims() claims: AnyClaims) {
    return this.family.members(familyId, requireUser(claims));
  }

  @Get('events')
  events(
    @Param('familyId') familyId: string,
    @CurrentClaims() claims: AnyClaims,
    @Query('memberId') memberId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.family.feed(familyId, requireUser(claims), { memberId, from, to, cursor, limit });
  }

  @Get('overview')
  overview(@Param('familyId') familyId: string, @CurrentClaims() claims: AnyClaims, @Query('days') days?: string) {
    return this.family.overview(familyId, requireUser(claims), Number(days ?? 7));
  }
}

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly family: FamilyService) {}

  @Get('timeline')
  timeline(@CurrentClaims() claims: AnyClaims, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.family.timeline(requireUser(claims), cursor, limit);
  }

  @Get('settings')
  settings(@CurrentClaims() claims: AnyClaims) {
    return this.family.settings(requireUser(claims));
  }

  @Patch('settings')
  updateSettings(@CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    return this.family.updateSettings(requireUser(claims), body);
  }
}