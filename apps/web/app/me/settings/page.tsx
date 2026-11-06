'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { ErrorState, LoadingState } from '../../../components/States';

type Settings = {
  defaultScope: 'members' | 'family';
  retentionDays: 7 | 30 | 90;
  notifyFrequency: 'daily' | 'realtime';
  quietHours: { start: string; end: string } | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  useEffect(() => {
    if (!session) return;
    request<Settings>('/users/me/settings', { token: session.token })
      .then((result) => setForm(result.data))
      .catch((cause: Error) => setError(cause.message));
  }, [session]);

  if (!ready || !session) return <div className="state">正在加载…</div>;
  if (error && !form) return <ErrorState message={error} />;
  if (!form) return <LoadingState count={1} />;

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const result = await request<Settings>('/users/me/settings', { method: 'PATCH', token: session!.token, body: form });
      setForm(result.data);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">隐私与提示</h1>
        <p className="page-sub">这些设置只影响未来的新事件，不会追溯修改已经分享的内容。</p>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      {saved ? <div className="notice">已保存。</div> : null}

      <div className="panel stack">
        <h2>默认分享范围</h2>
        <label className="field">
          <span>新事件默认分享给谁</span>
          <select
            value={form.defaultScope}
            onChange={(event) => setForm({ ...form, defaultScope: (event.target as HTMLSelectElement).value as Settings['defaultScope'] })}
          >
            <option value="members">每次由我选择接收人</option>
            <option value="family">家庭内已授权成员</option>
          </select>
        </label>
        <p className="muted">默认不会预选全体成员；本人确认仍是分享的前提。</p>
      </div>

      <div className="panel stack">
        <h2>原始素材保留期</h2>
        <label className="field">
          <span>到期后清理原始素材，事件卡保留</span>
          <select
            value={form.retentionDays}
            onChange={(event) => setForm({ ...form, retentionDays: Number((event.target as HTMLSelectElement).value) as Settings['retentionDays'] })}
          >
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
            <option value={90}>90 天</option>
          </select>
        </label>
      </div>

      <div className="panel stack">
        <h2>提示频率</h2>
        <label className="field">
          <span>家庭摘要提示</span>
          <select
            value={form.notifyFrequency}
            onChange={(event) => setForm({ ...form, notifyFrequency: (event.target as HTMLSelectElement).value as Settings['notifyFrequency'] })}
          >
            <option value="daily">每天最多一次</option>
            <option value="realtime">有新分享时提示</option>
          </select>
        </label>
        <p className="muted">提示只会出现在 Web 端，不会下发到采集设备。</p>
      </div>

      <div className="panel stack">
        <h2>安静时间</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={form.quietHours !== null}
            onChange={(event) =>
              setForm({ ...form, quietHours: event.target.checked ? { start: '22:00', end: '07:00' } : null })
            }
          />
          开启安静时间
        </label>
        {form.quietHours ? (
          <div className="row">
            <label className="field">
              <span>开始</span>
              <input
                type="time"
                value={form.quietHours.start}
                onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours!, start: (event.target as HTMLInputElement).value } })}
              />
            </label>
            <label className="field">
              <span>结束</span>
              <input
                type="time"
                value={form.quietHours.end}
                onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours!, end: (event.target as HTMLInputElement).value } })}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="row">
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? '保存中…' : '保存设置'}
        </button>
      </div>

      <p className="muted">采集状态可在「设备」页暂停；暂停后设备会用指示灯提示。</p>
    </div>
  );
}