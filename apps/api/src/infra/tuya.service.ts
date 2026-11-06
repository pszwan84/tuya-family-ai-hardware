import { Injectable } from '@nestjs/common';

export type TuyaDeviceState = { online: boolean; lastSeenAt: string | null } | null;

@Injectable()
export class TuyaService {
  async queryDeviceState(): Promise<TuyaDeviceState> {
    if (!process.env.TUYA_CLIENT_ID || !process.env.TUYA_CLIENT_SECRET) return null;
    return null;
  }

  async sendCommand(): Promise<'applied' | 'pending_on_online'> {
    return 'pending_on_online';
  }
}