export type RiskLevel = 'none' | 'sensitive' | 'high';

export type RiskSignal =
  | 'exact_location'
  | 'medical'
  | 'family_conflict'
  | 'third_party'
  | 'screen_document'
  | 'low_confidence'
  | 'continuous_tracking';

export type RiskInput = {
  signals: RiskSignal[];
  text: string;
  confidence: number;
  confidenceThreshold: number;
  hasExactLocation: boolean;
  thirdPartyVisible: boolean;
};

export type RiskResult = { level: RiskLevel; items: string[] };

const SIGNAL_TEXT: Record<RiskSignal, string> = {
  exact_location: '包含精确位置信息',
  medical: '包含就医或健康相关信息',
  family_conflict: '涉及家庭冲突或私人谈话',
  third_party: '包含未授权第三方人物',
  screen_document: '包含屏幕、证件或单据信息',
  low_confidence: '事件置信度偏低，事实可能不准确',
  continuous_tracking: '可能形成连续行踪',
};

export const FORBIDDEN_NARRATIVE_WORDS = [
  '可能生病',
  '不开心',
  '抑郁',
  '争吵',
  '诊断',
  '病情',
  '情绪低落',
  '健康恶化',
];

export function evaluateRisk(input: RiskInput): RiskResult {
  const items = new Set<string>();
  let level: RiskLevel = 'none';

  for (const signal of input.signals) {
    if (signal === 'low_confidence') continue;
    items.add(SIGNAL_TEXT[signal]);
    if (signal === 'medical' || signal === 'family_conflict') level = 'high';
    else if (level === 'none') level = 'sensitive';
  }

  if (input.hasExactLocation) {
    items.add(SIGNAL_TEXT.exact_location);
    if (level === 'none') level = 'sensitive';
  }

  if (input.thirdPartyVisible) {
    items.add(SIGNAL_TEXT.third_party);
    if (level === 'none') level = 'sensitive';
  }

  if (input.confidence < input.confidenceThreshold) {
    items.add(SIGNAL_TEXT.low_confidence);
    if (level === 'none') level = 'sensitive';
  }

  if (input.signals.includes('continuous_tracking')) {
    items.add(SIGNAL_TEXT.continuous_tracking);
    level = 'high';
  }

  return { level, items: [...items] };
}

export function containsForbiddenNarrative(text: string): boolean {
  return FORBIDDEN_NARRATIVE_WORDS.some((word) => text.includes(word));
}
export type QuietHours = { start: string; end: string } | null;

export function isQuietHour(quietHours: QuietHours, at: Date): boolean {
  if (!quietHours) return false;
  const [startHour, startMinute] = quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = quietHours.end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return false;
  const current = at.getHours() * 60 + at.getMinutes();
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}