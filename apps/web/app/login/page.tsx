'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '../../lib/api';
import { roleLabel, saveSession, type Session } from '../../lib/session';

const ACCOUNTS = [
  { key: 'mid01', name: '妈妈', role: 'middle', note: '中间一代 · 可以分享与协助配置' },
  { key: 'gp01', name: '奶奶', role: 'grandparent', note: '祖辈 · 查看家人分享的内容' },
  { key: 'kid01', name: '小满', role: 'child', note: '子女 / 孙辈 · 未成年人' },
];

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(memberKey: string) {
    setBusy(memberKey);
    setError(null);
    try {
      const result = await request<Omit<Session, 'token'> & { token: string }>('/auth/demo-switch', {
        method: 'POST',
        headers: { 'x-demo-key': process.env.NEXT_PUBLIC_DEMO_KEY ?? 'demo-switch-key' },
        body: { memberKey },
      });
      saveSession(result.data);
      router.replace('/me/drafts');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">家事</h1>
        <p className="page-sub">把家人的日常，整理成彼此看得懂的小事件。选择一个演示身份进入。</p>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}

      <div className="grid">
        {ACCOUNTS.map((account) => (
          <article key={account.key} className="card">
            <div className="card-body">
              <div className="card-title">{account.name}</div>
              <div className="badges">
                <span className="badge">{roleLabel[account.role]}</span>
              </div>
              <p className="card-text">{account.note}</p>
              <button className="btn btn-primary" disabled={busy !== null} onClick={() => enter(account.key)}>
                {busy === account.key ? '进入中…' : '以此身份进入'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="muted">演示环境仅使用虚构家庭数据；生产环境需关闭演示切换。</p>
    </div>
  );
}