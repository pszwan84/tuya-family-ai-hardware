'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';

type TimelineItem = {
  eventId: string;
  occurredAt: string;
  eventType: string;
  title: string;
  status: 'draft' | 'shared' | 'revoked' | 'ignored';
  confidenceLevel: 'high' | 'low';
};

type TimelineResponse = {
  items: TimelineItem[];
  meta?: { cursor?: string; hasMore: boolean };
};

const STATUS_LABEL: Record<string, string> = {
  draft: '待分享',
  shared: '已分享',
  revoked: '已撤回',
  ignored: '已忽略',
};

function groupByDay(items: TimelineItem[]): Array<{ label: string; items: TimelineItem[] }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const date = new Date(item.occurredAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diff = Math.round((today - day) / 86400000);
    const label = diff <= 0 ? '今天' : diff === 1 ? '昨天' : diff <= 7 ? '近七天' : '更早';
    const bucket = buckets.get(label) ?? [];
    bucket.push(item);
    buckets.set(label, bucket);
  }
  return ['今天', '昨天', '近七天', '更早']
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }));
}

export default function TimelinePage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [pages, setPages] = useState<TimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  const query = useQuery({
    queryKey: ['timeline', session?.user.userId, cursor],
    enabled: Boolean(session),
    queryFn: () => request<TimelineResponse>(`/users/me/timeline${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { token: session!.token }),
  });

  useEffect(() => {
    if (!query.data) return;
    setPages((current) => (cursor ? [...current, ...query.data!.data.items] : query.data!.data.items));
    setHasMore(Boolean(query.data.data.meta?.hasMore));
  }, [query.data, cursor]);

  if (!ready || !session) return <div className="state">正在加载…</div>;

  function loadMore() {
    const next = query.data?.data.meta?.cursor;
    if (next) setCursor(next);
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">我的时间线</h1>
        <p className="page-sub">属于你的完整记录。分享状态变化不会让事件消失。</p>
      </div>

      {query.isLoading && pages.length === 0 ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && pages.length === 0 ? <EmptyState title="还没有记录" hint="设备采集后的素材与事件会沉淀在这里。" /> : null}

      <div className="stack">
        {groupByDay(pages).map((group) => (
          <section key={group.label} className="stack">
            <h2 className="page-title" style={{ fontSize: 18 }}>
              {group.label}
            </h2>
            {group.items.map((item) => (
              <div key={item.eventId} className="panel row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="card-title">{item.title || '未命名事件'}</div>
                  <div className="muted">
                    {new Date(item.occurredAt).toLocaleString('zh-CN')} · {item.eventType}
                  </div>
                </div>
                <div className="row">
                  <span className="badge badge-soft">{STATUS_LABEL[item.status] ?? item.status}</span>
                  {item.confidenceLevel === 'low' ? <span className="badge">低置信度</span> : null}
                  <a className="btn" href={`/me/events/${item.eventId}`}>
                    查看
                  </a>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {hasMore ? (
        <button className="btn" disabled={query.isFetching} onClick={loadMore}>
          {query.isFetching ? '加载中…' : '加载更多'}
        </button>
      ) : null}
    </div>
  );
}