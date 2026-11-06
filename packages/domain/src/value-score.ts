export type ShareValueInput = {
  freshness: number;
  relevance: number;
  understandability: number;
  intent: number;
  privacyRisk: number;
  careBurden: number;
};

export type ShareValue = ShareValueInput & { total: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function computeShareValue(input: ShareValueInput): ShareValue {
  const freshness = clamp01(input.freshness);
  const relevance = clamp01(input.relevance);
  const understandability = clamp01(input.understandability);
  const intent = clamp01(input.intent);
  const privacyRisk = clamp01(input.privacyRisk);
  const careBurden = clamp01(input.careBurden);
  const total =
    freshness + relevance + understandability + intent - privacyRisk - careBurden;
  return { freshness, relevance, understandability, intent, privacyRisk, careBurden, total };
}

export function recommendReason(value: ShareValue, eventType: string): string {
  if (value.total >= 2.5) return '这是最近发生的新鲜小事，家人容易理解，也与你关心的人相关。';
  if (value.freshness >= 0.7) return '这是第一次出现的变化，适合让家人知道。';
  if (value.relevance >= 0.7) return '这件事与接收家人的共同兴趣有关。';
  if (value.understandability >= 0.7) return '内容简单清楚，长辈也容易看懂。';
  if (eventType === 'small_achievement') return '这是一次小小的完成，值得被家人看见。';
  return '这条记录可以留作家庭日常，也可以由你决定是否分享。';
}

export function lowRecommendation(value: ShareValue): boolean {
  return value.total < 1.2;
}