'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { EventCard } from '../../../components/EventCard';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';

type DraftItem = {
  eventId: string;
  occurredAt: string;
  title: string;
  confidenceLevel: 'high' | 'low';
  riskLevel: 'none' | 'sensitive' | 'high';
  recommendReason: string;
  requiresRiskAck: boolean;
  card: {
    title: string;
    whatHappened: string;
    imageUrl: string | null;
    renderMode: 'ai' | 'template' | 'text';
  };
};

export default function DraftsPage() {
  const router = useRouter();
  const { session, ready } = useSession();

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  const query = useQuery({
    queryKey: ['drafts', session?.user.userId],
    enabled: Boolean(session),
    queryFn: () =>
      request<{ items: DraftItem[] }>(`/events?ownerId=${session!.user.userId}&status=draft&sort=recommend`, {
        token: session!.token,
      }),
  });

  if (!ready || !session) return <div className="state">正在加载…</div>;

  const items = query.data?.data.items ?? [];
  const normal = items.filter((item) => item.riskLevel !== 'high');
  const risky = items.filter((item) => item.riskLevel === 'high');

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">我的待分享</h1>
        <p className="page-sub">AI 从今天的素材里挑出的事件。是否分享，由你决定。</p>
      </div>

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && items.length === 0 ? (
        <EmptyState title="暂无待分享事件" hint="设备采集到新的日常后，会先整理成候选事件出现在这里。" />
      ) : null}

      {normal.length > 0 ? (
        <div className="grid">
          {normal.map((item) => (
            <EventCard
              key={item.eventId}
              href={`/me/events/${item.eventId}`}
              title={item.card.title || item.title}
              whatHappened={item.card.whatHappened}
              imageUrl={item.card.imageUrl}
              confidenceLevel={item.confidenceLevel}
              riskLevel={item.riskLevel}
              renderMode={item.card.renderMode}
              footer={
                <>
                  <p className="muted">推荐理由：{item.recommendReason}</p>
                  <Link className="btn btn-primary" href={`/me/events/${item.eventId}`}>
                    查看并分享
                  </Link>
                </>
              }
            />
          ))}
        </div>
      ) : null}

      {risky.length > 0 ? (
        <>
          <h2 className="page-title" style={{ fontSize: 20 }}>
            需要确认的内容
          </h2>
          <p className="page-sub">这些事件包含敏感信息，不会进入普通推荐，分享前需要二次确认。</p>
          <div className="grid">
            {risky.map((item) => (
              <EventCard
                key={item.eventId}
                href={`/me/events/${item.eventId}`}
                title={item.card.title || item.title}
                whatHappened={item.card.whatHappened}
                imageUrl={item.card.imageUrl}
                confidenceLevel={item.confidenceLevel}
                riskLevel={item.riskLevel}
                renderMode={item.card.renderMode}
                footer={
                  <Link className="btn" href={`/me/events/${item.eventId}`}>
                    了解详情
                  </Link>
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}