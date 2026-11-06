import { Injectable } from '@nestjs/common';
import { defaultRuntimeConfig, mergeRuntimeConfig, type RuntimeConfig } from '@fah/config';

@Injectable()
export class ConfigService {
  private runtime: RuntimeConfig = mergeRuntimeConfig({
    confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD ?? defaultRuntimeConfig.confidenceThreshold),
    dedupeWindowSec: Number(process.env.DEDUPE_WINDOW_SEC ?? defaultRuntimeConfig.dedupeWindowSec),
    clusterWindowSec: Number(process.env.CLUSTER_WINDOW_SEC ?? defaultRuntimeConfig.clusterWindowSec),
    retentionDays: (Number(process.env.RETENTION_DAYS ?? 30) as 7 | 30 | 90),
    notifyAggregateWindowMin: Number(process.env.NOTIFY_WINDOW_MIN ?? 10),
    notifyDailyLimit: Number(process.env.NOTIFY_DAILY_LIMIT ?? 1),
    aiMode: (process.env.AI_MODE === 'live' ? 'live' : 'mock'),
    cardMode: (process.env.CARD_MODE === 'live' ? 'live' : 'template'),
    assetIngressMode: (process.env.ASSET_INGRESS_MODE === 'cloud_relay' ? 'cloud_relay' : 'direct'),
  });

  get port(): number {
    return Number(process.env.PORT ?? 3001);
  }

  get demoMode(): boolean {
    return process.env.DEMO_MODE !== 'false';
  }

  get demoSwitchKey(): string {
    return process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET ?? 'fah-demo-secret-change-me';
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN ?? '2h';
  }

  get deviceTokenTtlSec(): number {
    return Number(process.env.DEVICE_TOKEN_TTL_SEC ?? 900);
  }

  get deviceClockSkewSec(): number {
    return Number(process.env.DEVICE_CLOCK_SKEW_SEC ?? 300);
  }

  get assetClockSkewSec(): number {
    return Number(process.env.ASSET_CLOCK_SKEW_SEC ?? 600);
  }

  get deviceOfflineSec(): number {
    return Number(process.env.DEVICE_OFFLINE_SEC ?? 90);
  }

  get storageSecret(): string {
    return process.env.STORAGE_SECRET ?? this.jwtSecret;
  }

  get publicBaseUrl(): string {
    return process.env.PUBLIC_BASE_URL ?? `http://localhost:${this.port}/api/v1`;
  }

  get ai() {
    return {
      mode: this.runtime.aiMode,
      vlmBaseUrl: process.env.AI_VLM_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      vlmApiKey: process.env.AI_VLM_API_KEY ?? '',
      vlmModel: process.env.AI_VLM_MODEL ?? 'qwen-vl-max',
      cardMode: this.runtime.cardMode,
      imageBaseUrl: process.env.AI_IMAGE_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1',
      imageApiKey: process.env.AI_IMAGE_API_KEY ?? '',
    };
  }

  getRuntime(): RuntimeConfig {
    return this.runtime;
  }

  updateRuntime(partial: Partial<RuntimeConfig>): RuntimeConfig {
    this.runtime = mergeRuntimeConfig({ ...this.runtime, ...partial });
    return this.runtime;
  }
}