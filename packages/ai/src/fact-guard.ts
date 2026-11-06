import { containsForbiddenNarrative } from '@fah/domain';
import type { Extraction } from './extraction';

export type FactGuardResult =
  | { ok: true; description: string }
  | { ok: false; reason: string; description: string };

export function guardExtraction(extraction: Extraction): FactGuardResult {
  if (extraction.unrecognized) {
    return { ok: true, description: extraction.description };
  }
  if (containsForbiddenNarrative(extraction.description)) {
    const safe = `${extraction.facts.time}，${extraction.facts.who}在${extraction.facts.scene}${extraction.facts.action}${extraction.facts.object}。`;
    return { ok: false, reason: 'forbidden_narrative', description: safe };
  }
  if (extraction.confidence < 0.6) {
    return { ok: true, description: extraction.description };
  }
  return { ok: true, description: extraction.description };
}

export function detectRiskSignals(text: string, base: string[]): string[] {
  const signals = new Set(base);
  if (/(医院|看病|吃药|检查|诊断)/.test(text)) signals.add('medical');
  if (/(争吵|吵架|冲突)/.test(text)) signals.add('family_conflict');
  if (/(门牌|车牌|身份证|证件|屏幕|地址)/.test(text)) signals.add('screen_document');
  if (/(定位|经纬度|门牌号)/.test(text)) signals.add('exact_location');
  return [...signals];
}