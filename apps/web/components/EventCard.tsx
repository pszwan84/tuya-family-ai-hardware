'use client';

import Link from 'next/link';

export type EventCardProps = {
  eventId?: string;
  title: string;
  whatHappened: string;
  imageUrl?: string | null;
  whyForYou?: string;
  roleNote?: string;
  confidenceLevel?: 'high' | 'low';
  riskLevel?: 'none' | 'sensitive' | 'high';
  renderMode?: 'ai' | 'template' | 'text';
  footer?: React.ReactNode;
  href?: string;
};

export function EventCard(props: EventCardProps) {
  const body = (
    <article className="card">
      {props.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="card-image" src={props.imageUrl} alt={`${props.title}的 AI 整理插画`} />
      ) : (
        <div className="card-image" aria-label="图片暂不可用">
          <div className="card-body">
            <span className="muted">图像暂不可用，先看文字版本</span>
          </div>
        </div>
      )}
      <div className="card-body">
        <div className="badges">
          <span className="badge">AI 整理</span>
          {props.renderMode === 'text' ? <span className="badge badge-soft">文字卡</span> : null}
          {props.confidenceLevel === 'low' ? <span className="badge badge-soft">低置信度</span> : null}
          {props.riskLevel === 'high' ? <span className="badge badge-warn">需二次确认</span> : null}
          {props.riskLevel === 'sensitive' ? <span className="badge badge-warn">包含敏感信息</span> : null}
        </div>
        <div className="card-title">{props.title}</div>
        <div className="card-text">{props.whatHappened}</div>
        {props.whyForYou ? <div className="muted">为什么给你看：{props.whyForYou}</div> : null}
        {props.roleNote ? <div className="muted">{props.roleNote}</div> : null}
        {props.footer}
      </div>
    </article>
  );

  if (props.href) {
    return <Link href={props.href}>{body}</Link>;
  }
  return body;
}