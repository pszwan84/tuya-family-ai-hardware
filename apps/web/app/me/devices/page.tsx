'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';

type Device = {
  deviceId: string;
  online: boolean;
  lastSeenAt: string | null;
  collectState: 'enabled' | 'paused';
  queueDepth: number;
  freeMB: number;
  firmware: { fwVersion: string | null; protoVersion: string | null };
  pendingOnOnline: boolean;
};

export default function DevicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, ready } = useSession();

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  const query = useQuery({
    queryKey: ['devices', session?.user.userId],
    enabled: Boolean(session),
    refetchInterval: 5000,
    queryFn: () => request<{ items: Device[] }>('/devices', { token: session!.token }),
  });

  async function toggle(device: Device) {
    const next = device.collectState === 'enabled' ? 'paused' : 'enabled';
    await request(`/devices/${device.deviceId}`, {
      method: 'PATCH',
      token: session!.token,
      body: { collectState: next },
    });
    await queryClient.invalidateQueries({ queryKey: ['devices'] });
  }

  async function sendCommand(device: Device, type: 'capture_now' | 'resync') {
    await request(`/devices/${device.deviceId}/commands`, {
      method: 'POST',
      token: session!.token,
      body: { type },
    });
    await queryClient.invalidateQueries({ queryKey: ['devices'] });
  }

  if (!ready || !session) return <div className="state">正在加载…</div>;

  const devices = query.data?.data.items ?? [];

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">我的采集设备</h1>
        <p className="page-sub">设备只负责采集与上传。它不会接收家庭内容，也不显示家人回应。</p>
      </div>

      {query.isLoading ? <LoadingState count={1} /> : null}
      {query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && devices.length === 0 ? <EmptyState title="还没有绑定设备" hint="在涂鸦 App 完成配网后，用激活码绑定到家庭。" /> : null}

      {devices.map((device) => (
        <div key={device.deviceId} className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{device.deviceId}</strong>
            <span className={`badge ${device.online ? '' : 'badge-soft'}`}>{device.online ? '在线' : '离线'}</span>
          </div>
          <dl className="facts">
            <div>
              <dt>采集状态</dt>
              <dd>{device.collectState === 'enabled' ? '采集中' : '已暂停'}</dd>
            </div>
            <div>
              <dt>待上传</dt>
              <dd>{device.queueDepth} 条</dd>
            </div>
            <div>
              <dt>存储余量</dt>
              <dd>{device.freeMB} MB</dd>
            </div>
            <div>
              <dt>固件</dt>
              <dd>{device.firmware.fwVersion ?? '未上报'}</dd>
            </div>
          </dl>
          {!device.online ? <div className="notice">设备当前离线。指令会在设备上线后生效。</div> : null}
          {device.pendingOnOnline ? <div className="notice">有一项设置等待设备上线后生效。</div> : null}
          <div className="row">
            <button className="btn btn-primary" onClick={() => void sendCommand(device, 'capture_now')}>
              拍一张
            </button>
            <button className="btn" onClick={() => void sendCommand(device, 'resync')}>
              立即补传
            </button>
            <button className="btn" onClick={() => void toggle(device)}>
              {device.collectState === 'enabled' ? '暂停采集' : '恢复采集'}
            </button>
          </div>
          <span className="muted">暂停后，设备重启仍保持暂停；指令最多 10 秒生效。</span>
        </div>
      ))}
    </div>
  );
}