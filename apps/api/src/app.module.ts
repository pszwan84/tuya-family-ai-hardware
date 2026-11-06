import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from './infra/config.service';
import { PipelineFactory } from './infra/pipeline.factory';
import { PipelineRunner } from './infra/pipeline.runner';
import { PrismaService } from './infra/prisma.service';
import { QueueService } from './infra/queue.service';
import { StorageService } from './infra/storage.service';
import { TuyaService } from './infra/tuya.service';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { DeviceIngressController } from './modules/device-ingress/device-ingress.controller';
import { DeviceIngressService } from './modules/device-ingress/device-ingress.service';
import { DeviceController } from './modules/device/device.controller';
import { DeviceService } from './modules/device/device.service';
import { AssetController } from './modules/asset/asset.controller';
import { AssetService } from './modules/asset/asset.service';
import { EventController } from './modules/event/event.controller';
import { EventService } from './modules/event/event.service';
import { ShareController } from './modules/share/share.controller';
import { ShareService } from './modules/share/share.service';
import { FamilyController, MeController } from './modules/family/family.controller';
import { FamilyService } from './modules/family/family.service';
import { NotifyController } from './modules/notify/notify.controller';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'fah-demo-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '2h') as never },
    }),
  ],
  controllers: [
    AuthController,
    DeviceController,
    DeviceIngressController,
    AssetController,
    EventController,
    ShareController,
    FamilyController,
    MeController,
    NotifyController,
    AdminController,
  ],
  providers: [
    ConfigService,
    PrismaService,
    StorageService,
    QueueService,
    TuyaService,
    PipelineFactory,
    PipelineRunner,
    AuthService,
    DeviceService,
    DeviceIngressService,
    AssetService,
    EventService,
    ShareService,
    FamilyService,
    AdminService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}