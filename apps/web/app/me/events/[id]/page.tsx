'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '../../../../lib/api';
import { roleLabel, useSession } from '../../../../lib/session';
import { EventCard } from '../../../../components/EventCard';
import { ErrorState, LoadingState } from '../../../../components/States';
import { ShareSheet } from '../../../../components/ShareSheet';

type Detail = {
  event: {
    eventId: string;
    occurredAt: string;
    eventType: string;
    facts: { who: string; action: string; object: string; scene: string; time: string };
    description: string;
    confidence: number;
    confidenceLevel: 'high' | 'low';
    risk: { level: 'none' | 'sensitive' | 'high'; items: string[] };
    status: 'draft' | 'shared' | 'revoked' | 'ignored' | 'deleted';
    aiAttribution: true;
    sourceAssetCount: number;
    sourceAssetsCleaned: boolean;
  };
  card: {
    title: string;
    whatHappened: string;
    imageUrl: string | null;
    renderMode: 'ai' | 'template' | 'text';
    version: number;
  };
  share: { shareId: string; recipients: string[]; status: string } | null;
};

type Members = { members: Array<{ memberId: string; displayName: string; role: string }> };

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, ready } = useSession();

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  const detail = useQuery({
    queryKey: ['event', params.id],
    enabled: Boolean(session && params.id),
    queryFn: () => request<Detail>(`/events/${params.id}`, { token: session!.token }),
  });

  const members = useQuery({
    queryKey: ['members', session?.family.familyId],
    enabled: Boolean(session),
    queryFn: () => request<Members>(`/families/${session!.family.familyId}/members`, { token: session!.token }),
  });

  if (!ready || !session) return <div className="state">正在加载…</div>;
  if (detail.isLoading) return <LoadingState count={1} />;
  if (detail.isError) return <ErrorState message={(detail.error as Error).message} onRetry={() => void detail.refetch()} />;

  const data = detail.data!.data;
  const recipients = (members.data?.data.members ?? []).filter((member) => member.memberId !== session.user.userId);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">事件详情</h1>
        <p className="page-sub">
          {new Date(data.event.occurredAt).toLocaleString('zh-CN')} · {data.event.eventType}
        </p>
      </div>

      <EventCard
        title={data.card.title}
        whatHappened={data.card.whatHappened}
        imageUrl={data.card.imageUrl}
        confidenceLevel={data.event.confidenceLevel}
        riskLevel={data.event.risk.level}
        renderMode={data.card.renderMode}
      />

      <div className="panel stack">
        <h2>AI 从画面里整理出的事实</h2>
        <dl className="facts">
          <div>
            <dt>人物</dt>
            <dd>{data.event.facts.who}</dd>
          </div>
          <div>
            <dt>行为</dt>
            <dd>{data.event.facts.action}</dd>
          </div>
          <div>
            <dt>对象</dt>
            <dd>{data.event.facts.object}</dd>
          </div>
          <div>
            <dt>场景</dt>
            <dd>{data.event.facts.scene}</dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>{data.event.facts.time}</dd>
          </div>
        </dl>
        <p className="muted">{data.event.description}</p>
        <p className="muted">
          置信度：{Math.round(data.event.confidence * 100)}%（{data.event.confidenceLevel === 'high' ? '高' : '低'}）。
          来源素材 {data.event.sourceAssetCount} 份，原始素材仅本人可见
          {data.event.sourceAssetsCleaned ? '，部分素材已按保留策略清理' : ''}。
        </p>
        {data.event.risk.items.length > 0 ? (
          <div className="notice">风险提示：{data.event.risk.items.join('；')}</div>
        ) : null}
        <div className="badges">
          <span className="badge">AI 整理</span>
          {data.event.status === 'shared' ? <span className="badge badge-soft">已分享</span> : null}
          {data.event.status === 'revoked' ? <span className="badge badge-soft">已撤回</span> : null}
        </div>
      </div>

      {data.event.status !== 'deleted' ? (
        <ShareSheet
          eventId={data.event.eventId}
          token={session.token}
          recipients={recipients.map((member) => ({
            memberId: member.memberId,
            displayName: member.displayName,
            role: member.role,
          }))}
          shareStatus={data.event.status}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ['event', params.id] });
            void queryClient.invalidateQueries({ queryKey: ['drafts'] });
            void queryClient.invalidateQueries({ queryKey: ['family-feed'] });
            router.refresh();
          }}
        />
      ) : null}

      <p className="muted">
        当前身份：{session.user.displayName} · {roleLabel[session.role] ?? session.role}
      </p>
    </div>
  );
}