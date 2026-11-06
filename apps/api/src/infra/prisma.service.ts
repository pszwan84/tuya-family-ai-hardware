import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  assertFamily<T extends { familyId?: string }>(entity: T | null, familyId: string): T {
    if (!entity || entity.familyId !== familyId) {
      throw new Error('family_scope_violation');
    }
    return entity;
  }

  scopedWhere(familyId: string, where: Record<string, unknown> = {}): Record<string, unknown> {
    if (!familyId) throw new Error('family_scope_missing');
    return { ...where, familyId };
  }
}