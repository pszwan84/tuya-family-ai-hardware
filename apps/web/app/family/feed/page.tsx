'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../../lib/api';
import { roleLabel, useSession } from '../../../lib/session';
import { EventCard } from '../../../components/EventCard';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';

type FamilyEvent = {
  viewId: string;
  eventId: string;
  occurredAt: string;
  owner: { memberId: string; displayName: string; role: string };
  title: string;
  whatHappened: string;
  whyForYou: string;
  roleNote: string;
  card: { imageUrl: string | null; renderMode: 'ai' | 'template' | 'text'; aiAttribution: true };
};

export default function FamilyFeedPage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [memberId, setMemberId] = useState<string>('');

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  const members = useQuery({
    queryKey: ['members', session?.family.familyId],
    enabled: Boolean(session),
    queryFn: () => request<{ members: Array<{ memberId: string; displayName: string; role: string }> }>(`/families/${session!.family.familyId}/members`, { token: session!.token }),
  });

  const feed = useQuery({
    queryKey: ['family-feed', session?.user.userId, memberId],
    enabled: Boolean(session),
    refetchInterval: 1500,
    queryFn: () =>
      request<{ items: FamilyEvent[] }>(
        `/families/${session!.family.familyId}/events${memberId ? `?memberId=${memberId}` : ''}`,
        { token: session!.token },
      ),
  });

  const overview = useQuery({
    queryKey: ['family-overview', session?.family.familyId],
    enabled: Boolean(session),
    refetchInterval: 5000,
    queryFn: () =>
      request<{ newEventCount: number; activeMembers: Array<{ memberId: string; displayName: string; role: string }>; changes: string[] }>(
        `/families/${session!.family.familyId}/overview?days=7`,
        { token: session!.token },
      ),
  });

  if (!ready || !session) return <div className="state">正在加载…</div>;

  const items = feed.data?.data.items ?? [];
  const visibleMembers = (members.data?.data.members ?? []).filter((member) => member.memberId !== session.user.userId);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">家人</h1>
        <p className="page-sub">家人愿意分享给你的日常。这里没有已读压力，也没有排名。</p>
      </div>

      {overview.data ? (
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>近七天家庭变化</strong>
            <span className="badge">{overview.data.data.newEventCount} 条新分享</span>
          </div>
          {overview.data.data.changes.length > 0 ? (
            <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {overview.data.data.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">最近七天还没有新的家庭变化。</p>
          )}
        </div>
      ) : null}

      <div className="row">
        <button className="chip" aria-pressed={memberId === ''} onClick={() => setMemberId('')}>
          全部
        </button>
        {visibleMembers.map((member) => (
          <button
            key={member.memberId}
            className="chip"
            aria-pressed={memberId === member.memberId}
            onClick={() => setMemberId(member.memberId)}
          >
            {member.displayName} · {roleLabel[member.role] ?? member.role}
          </button>
        ))}
      </div>

      {feed.isLoading ? <LoadingState /> : null}
      {feed.isError ? <ErrorState message={(feed.error as Error).message} onRetry={() => void feed.refetch()} /> : null}
      {feed.isSuccess && items.length === 0 ? (
        <EmptyState
          title={memberId ? '这位家人最近还没有分享' : '还没有新的家庭事件'}
          hint="家人分享后，这里会自动出现对方的版本。"
        />
      ) : null}

      <div className="grid">
        {items.map((item) => (
          <EventCard
            key={item.viewId}
            title={item.title}
            whatHappened={item.whatHappened}
            imageUrl={item.card.imageUrl}
            whyForYou={item.whyForYou}
            roleNote={item.roleNote}
            renderMode={item.card.renderMode}
            footer={
              <span className="muted">
                {item.owner.displayName} · {new Date(item.occurredAt).toLocaleString('zh-CN')}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}