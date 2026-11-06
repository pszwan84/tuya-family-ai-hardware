import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentClaims, JwtAuthGuard, requireUser, type AnyClaims } from '../../common/auth';
import { EventService } from './event.service';

@Controller('events')
export class EventController {
  constructor(private readonly events: EventService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentClaims() claims: AnyClaims,
    @Query('ownerId') ownerId: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const user = requireUser(claims);
    void status;
    return this.events.listDrafts(user, ownerId ?? user.sub, sort === 'time' ? 'time' : 'recommend');
  }

  @Get(':eventId')
  @UseGuards(JwtAuthGuard)
  detail(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims) {
    return this.events.detail(eventId, requireUser(claims));
  }

  @Patch(':eventId')
  @UseGuards(JwtAuthGuard)
  patch(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims, @Body() body: unknown) {
    return this.events.patch(eventId, requireUser(claims), body);
  }

  @Delete(':eventId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('eventId') eventId: string, @CurrentClaims() claims: AnyClaims) {
    return this.events.remove(eventId, requireUser(claims));
  }
}