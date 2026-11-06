'use client';

import Link from 'next/link';
import { useSession } from '../lib/session';

export default function LandingPage() {
  const { session } = useSession();

  return (
    <div className="stack" style={{ gap: 28 }}>
      <section
        className="panel"
        style={{
          background: 'linear-gradient(140deg, #f8efe2 0%, #f3e2cf 55%, #e9d8c3 100%)',
          padding: '48px 28px',
          textAlign: 'center',
        }}
      >
        <p className="muted" style={{ letterSpacing: '0.32em', marginBottom: 10 }}>
          NIAN NIAN · KINRING
        </p>
        <h1 style={{ fontSize: 42, margin: '0 0 6px', letterSpacing: '0.04em' }}>念念 · KinRing</h1>
        <p style={{ fontSize: 20, margin: '0 0 18px', color: '#6b5b4b' }}>各自生活，彼此看见</p>
        <p className="card-text" style={{ maxWidth: 560, margin: '0 auto 26px' }}>
          AI 将三代人的日常，绘成家人看得懂的故事。相机挂在身上，只负责记录；
          故事留在家里，由你决定分享给谁。
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href={session ? '/me/drafts' : '/login'}>
            {session ? `回到 ${session.user.displayName} 的家` : '进入演示'}
          </Link>
          <Link className="btn" href="/family/feed">
            看看家人的近况
          </Link>
        </div>
      </section>

      <div className="grid">
        <article className="card">
          <div className="card-body">
            <span className="badge">听见日常</span>
            <div className="card-title">主动采集，不打扰</div>
            <p className="card-text">挂件相机按节奏记录生活片段，采集时指示灯可见，随时可以暂停。</p>
          </div>
        </article>
        <article className="card">
          <div className="card-body">
            <span className="badge">画成故事</span>
            <div className="card-title">只讲事实，不编故事</div>
            <p className="card-text">AI 把画面整理成人物、行为、对象、场景、时间五要素，再转写成适合不同家人的话。</p>
          </div>
        </article>
        <article className="card">
          <div className="card-body">
            <span className="badge">连成记忆</span>
            <div className="card-title">分享由本人确认</div>
            <p className="card-text">原始素材仅本人可见。高风险内容默认不推荐，分享前需要二次确认。</p>
          </div>
        </article>
      </div>

      <section className="panel stack">
        <h2>明天现场怎么用</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: 20 }}>
          <li>打开本页作为 3 分钟路演开场，讲“你多久没和父母打电话”。</li>
          <li>登录妈妈身份，展示待分享事件与 AI 整理的五要素。</li>
          <li>切换接收人预览奶奶版与孩子版，确认后切到奶奶身份，2 秒内看到。</li>
          <li>撤回分享，展示家庭视图消失、个人时间线保留。</li>
          <li>设备页暂停采集，强调“设备只采集、不显示家人内容”。</li>
        </ol>
      </section>
    </div>
  );
}