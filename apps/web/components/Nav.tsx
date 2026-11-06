'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { request } from '../lib/api';
import { roleLabel, useSession, type Session } from '../lib/session';

const SWITCH_TARGETS = [
  { displayName: '奶奶', memberKey: 'gp01' },
  { displayName: '妈妈', memberKey: 'mid01' },
  { displayName: '小满', memberKey: 'kid01' },
];

export function Nav() {
  const { session, ready, setSession } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function switchTo(displayName: string) {
    const target = SWITCH_TARGETS.find((item) => item.displayName === displayName);
    if (!target) return;
    setSwitching(true);
    try {
      const result = await request<Session>('/auth/demo-switch', {
        method: 'POST',
        headers: { 'x-demo-key': process.env.NEXT_PUBLIC_DEMO_KEY ?? 'demo-switch-key' },
        body: { memberKey: target.memberKey },
      });
      setSession(result.data);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href={session ? '/me/drafts' : '/login'}>
          家事
        </Link>
        {session ? (
          <>
            <nav className="nav-links">
              <Link href="/me/drafts">我的待分享</Link>
              <Link href="/me/timeline">我的时间线</Link>
              <Link href="/family/feed">家人</Link>
              <Link href="/me/devices">设备</Link>
              <Link href="/me/settings">设置</Link>
            </nav>
            <div className="nav-spacer" />
            <span className="who">
              {session.user.displayName} · {roleLabel[session.role] ?? session.role}
            </span>
            <select
              aria-label="切换演示身份"
              disabled={switching}
              value={session.user.displayName}
              onChange={(event) => void switchTo(event.target.value)}
              className="chip"
            >
              {SWITCH_TARGETS.map((target) => (
                <option key={target.memberKey} value={target.displayName}>
                  {target.displayName}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSession(null);
                router.replace('/login');
              }}
            >
              退出
            </button>
          </>
        ) : (
          <span className="muted">{ready ? '未登录' : '加载中…'}</span>
        )}
      </div>
    </header>
  );
}