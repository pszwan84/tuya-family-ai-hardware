'use client';

import { useState } from 'react';
import { request } from '../lib/api';
import { ApiClientError } from '../lib/api';
import { roleLabel } from '../lib/session';

type Recipient = { memberId: string; displayName: string; role: string };

type Preview = {
  memberId: string;
  role: string;
  title: string;
  whatHappened: string;
  whyForYou: string;
  roleNote: string;
  imageUrl: string | null;
};

type PreviewResponse = {
  previews: Preview[];
  risk: { level: 'none' | 'sensitive' | 'high'; items: string[]; requiresAck: boolean; riskAckToken?: string };
};

export function ShareSheet({
  eventId,
  token,
  recipients,
  shareStatus,
  onDone,
}: {
  eventId: string;
  token: string;
  recipients: Recipient[];
  shareStatus?: 'draft' | 'shared' | 'revoked' | 'ignored' | null;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);

  function toggle(memberId: string) {
    setSelected((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  }

  async function loadPreview() {
    setBusy(true);
    setError(null);
    try {
      const result = await request<PreviewResponse>(`/events/${eventId}/share/preview`, {
        method: 'POST',
        token,
        body: { recipientIds: selected, scope: 'members' },
      });
      setPreview(result.data);
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : '预览失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/events/${eventId}/share`, {
        method: 'POST',
        token,
        body: {
          scope: 'members',
          recipientIds: selected,
          riskAckToken: ack ? preview.risk.riskAckToken : undefined,
        },
      });
      setPreview(null);
      setSelected([]);
      onDone();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'RISK_ACK_REQUIRED') {
        setError('这条内容包含敏感信息，请先勾选确认后再分享。');
      } else {
        setError(cause instanceof Error ? cause.message : '分享失败');
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await request(`/events/${eventId}/share`, { method: 'DELETE', token });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '撤回失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <h2>分享给谁</h2>
        <p className="muted">默认不预选任何人。切换接收人可以先看对方会看到什么。</p>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}

      <div className="checklist">
        {recipients.map((recipient) => (
          <label key={recipient.memberId} className="check">
            <input
              type="checkbox"
              checked={selected.includes(recipient.memberId)}
              onChange={() => toggle(recipient.memberId)}
            />
            <span>
              {recipient.displayName}
              <span className="muted"> · {roleLabel[recipient.role] ?? recipient.role}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="row">
        <button className="btn" disabled={selected.length === 0 || busy} onClick={loadPreview}>
          预览对方版本
        </button>
        {shareStatus === 'shared' ? (
          <button className="btn" disabled={busy} onClick={revoke}>
            撤回分享
          </button>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="divider" />
          {preview.risk.items.length > 0 ? (
            <div className="notice">
              分享前请留意：{preview.risk.items.join('；')}
              {preview.risk.requiresAck ? (
                <label className="check" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
                  我已知晓风险，仍要分享这条内容
                </label>
              ) : null}
            </div>
          ) : null}

          {preview.previews.map((item) => (
            <div key={item.memberId} className="preview stack">
              <div className="badges">
                <span className="badge">{roleLabel[item.role] ?? item.role}</span>
                <span className="badge badge-soft">AI 整理</span>
              </div>
              <strong>{item.title}</strong>
              <span>{item.whatHappened}</span>
              <span className="muted">为什么给你看：{item.whyForYou}</span>
            </div>
          ))}

          <button
            className="btn btn-primary"
            disabled={busy || (preview.risk.requiresAck && !ack)}
            onClick={confirm}
          >
            {busy ? '提交中…' : '确认分享'}
          </button>
        </>
      ) : null}
    </section>
  );
}