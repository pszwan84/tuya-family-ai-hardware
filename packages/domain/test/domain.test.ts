import { describe, expect, it } from 'vitest';
import {
  canShare,
  canTransition,
  canViewAsset,
  canViewEvent,
  computeShareValue,
  containsForbiddenNarrative,
  evaluateRisk,
  buildNarrative,
  isFactConsistent,
  paginate,
} from '../src/index';

const actor = { userId: 'u_gp', familyId: 'fam_1', role: 'grandparent' as const, isMinor: false };
const owner = { userId: 'u_mid', familyId: 'fam_1', role: 'middle' as const, isMinor: false };

describe('policy', () => {
  it('禁止跨家庭查看', () => {
    const result = canViewEvent(actor, {
      familyId: 'fam_2',
      ownerId: 'u_mid',
      status: 'shared',
      visibility: 'shared',
    }, true);
    expect(result.allowed).toBe(false);
  });

  it('接收者可查看已分享事件', () => {
    const result = canViewEvent(actor, {
      familyId: 'fam_1',
      ownerId: 'u_mid',
      status: 'shared',
      visibility: 'shared',
    }, true);
    expect(result.allowed).toBe(true);
  });

  it('非接收者不可查看已分享事件', () => {
    const result = canViewEvent(actor, {
      familyId: 'fam_1',
      ownerId: 'u_mid',
      status: 'shared',
      visibility: 'shared',
    }, false);
    expect(result.allowed).toBe(false);
  });

  it('原始素材仅本人可见', () => {
    expect(canViewAsset(owner, 'u_mid', 'fam_1').allowed).toBe(true);
    expect(canViewAsset(actor, 'u_mid', 'fam_1').allowed).toBe(false);
  });

  it('分享给未成年需中间一代操作', () => {
    const minor = { userId: 'u_kid', familyId: 'fam_1', role: 'child' as const, isMinor: true };
    const event = { familyId: 'fam_1', ownerId: 'u_mid', status: 'draft' as const, visibility: 'owner_only' as const };
    expect(canShare(actor, event, [minor]).allowed).toBe(false);
    expect(canShare(owner, event, [minor]).allowed).toBe(true);
  });
});

describe('state machine', () => {
  it('允许 draft 到 shared', () => {
    expect(canTransition('draft', 'shared').ok).toBe(true);
  });

  it('允许 revoked 重新分享', () => {
    expect(canTransition('revoked', 'shared').ok).toBe(true);
  });

  it('禁止 shared 回到 draft', () => {
    expect(canTransition('shared', 'draft').ok).toBe(false);
  });
});

describe('risk rules', () => {
  it('医疗信号判为高风险', () => {
    const result = evaluateRisk({
      signals: ['medical'],
      text: '去了医院',
      confidence: 0.9,
      confidenceThreshold: 0.6,
      hasExactLocation: false,
      thirdPartyVisible: false,
    });
    expect(result.level).toBe('high');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('低置信度加入敏感项', () => {
    const result = evaluateRisk({
      signals: [],
      text: '一个画面',
      confidence: 0.4,
      confidenceThreshold: 0.6,
      hasExactLocation: false,
      thirdPartyVisible: false,
    });
    expect(result.level).toBe('sensitive');
    expect(result.items.some((item) => item.includes('置信度'))).toBe(true);
  });

  it('拦截情绪与疾病推断词', () => {
    expect(containsForbiddenNarrative('她可能生病了')).toBe(true);
    expect(containsForbiddenNarrative('她在包饺子')).toBe(false);
  });
});

describe('share value', () => {
  it('总分为四维减风险与负担', () => {
    const value = computeShareValue({
      freshness: 0.8,
      relevance: 0.8,
      understandability: 0.9,
      intent: 0.7,
      privacyRisk: 0.1,
      careBurden: 0.1,
    });
    expect(value.total).toBeCloseTo(3.0, 5);
  });
});

describe('narrative', () => {
  const facts = { who: '奶奶', action: '包了', object: '饺子', scene: '厨房', time: '今天上午' };

  it('祖辈与子女版本不同', () => {
    const gp = buildNarrative({ role: 'grandparent', facts, eventType: 'small_joy', relation: 'child' });
    const kid = buildNarrative({ role: 'child', facts, eventType: 'small_joy', relation: 'grandparent' });
    expect(gp.title).not.toBe(kid.title);
    expect(gp.whyForYou).not.toBe(kid.whyForYou);
  });

  it('祖辈版本单句不超过 30 字', () => {
    const gp = buildNarrative({ role: 'grandparent', facts, eventType: 'small_joy', relation: 'child' });
    expect(gp.whatHappened.length).toBeLessThanOrEqual(30);
  });

  it('叙述覆盖事实四要素', () => {
    const story = buildNarrative({ role: 'middle', facts, eventType: 'small_joy', relation: 'parent' });
    expect(isFactConsistent(story, facts)).toBe(true);
  });
});

describe('timeline pagination', () => {
  it('游标翻页不重复', () => {
    const items = Array.from({ length: 25 }).map((_, index) => ({
      id: `ev_${String(index).padStart(2, '0')}`,
      occurredAt: new Date(Date.UTC(2026, 10, 6, 10, 0, 0) - index * 60000).toISOString(),
      status: 'shared' as const,
    }));
    const first = paginate(items, null, 10);
    const second = paginate(items, first.nextCursor ? { occurredAt: items[9].occurredAt, id: items[9].id } : null, 10);
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(10);
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(20);
  });
});
describe('quiet hours', () => {
  it('夜间区间命中', async () => {
    const { isQuietHour } = await import('../src/risk-rules');
    expect(isQuietHour({ start: '22:00', end: '07:00' }, new Date(2026, 10, 6, 23, 30))).toBe(true);
    expect(isQuietHour({ start: '22:00', end: '07:00' }, new Date(2026, 10, 6, 12, 0))).toBe(false);
  });

  it('跨天区间边界', async () => {
    const { isQuietHour } = await import('../src/risk-rules');
    expect(isQuietHour({ start: '22:00', end: '07:00' }, new Date(2026, 10, 6, 6, 59))).toBe(true);
    expect(isQuietHour({ start: '22:00', end: '07:00' }, new Date(2026, 10, 6, 7, 0))).toBe(false);
  });
});
