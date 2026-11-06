import { describe, expect, it } from 'vitest';
import { guardExtraction, MockVisionProvider, validateExtraction } from '../src/index';

const provider = new MockVisionProvider();

describe('vision extraction', () => {
  it('对正常图片产出六要素事件', async () => {
    const result = await provider.analyze({
      image: Buffer.alloc(2048, 1),
      contentType: 'image/jpeg',
      assetId: 'as_abc',
      capturedAt: new Date().toISOString(),
      qualityFlags: [],
    });
    const checked = validateExtraction(result);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.value.facts.who.length).toBeGreaterThan(0);
      expect(checked.value.unrecognized).toBe(false);
    }
  });

  it('空画面标记未识别', async () => {
    const result = await provider.analyze({
      image: Buffer.alloc(10),
      contentType: 'image/jpeg',
      assetId: 'as_small',
      capturedAt: new Date().toISOString(),
      qualityFlags: [],
    });
    expect(result.unrecognized).toBe(true);
  });

  it('拦截情绪与疾病推断词', () => {
    const guarded = guardExtraction({
      eventType: 'shareable',
      facts: { who: '奶奶', action: '去了', object: '医院', scene: '医院', time: '今天' },
      description: '奶奶可能生病了',
      confidence: 0.9,
      typeConfidence: 0.9,
      unrecognized: false,
      riskSignals: ['medical'],
      quality: { valid: true, reasons: [] },
      evidence: { who: true, action: true, object: true, scene: true },
    });
    expect(guarded.ok).toBe(false);
    expect(guarded.description).not.toContain('生病');
  });

  it('Schema 拒绝缺少证据覆盖的输出', () => {
    const checked = validateExtraction({
      eventType: 'shareable',
      facts: { who: '未知', action: '未知', object: '未知', scene: '未知', time: '未知' },
      description: 'x',
      confidence: 0.5,
      typeConfidence: 0.5,
      unrecognized: false,
      riskSignals: [],
      quality: { valid: true, reasons: [] },
      evidence: { who: false, action: false, object: false, scene: false },
    });
    expect(checked.ok).toBe(false);
  });
});