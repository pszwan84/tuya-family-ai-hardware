import type { Facts } from '@fah/contracts';

export type RecipientRole = 'grandparent' | 'middle' | 'child';

export type NarrativeInput = {
  role: RecipientRole;
  facts: Facts;
  eventType: string;
  relation: string;
};

export type Narrative = {
  title: string;
  whatHappened: string;
  whyForYou: string;
  roleNote: string;
};

const short = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

export function buildNarrative(input: NarrativeInput): Narrative {
  const { role, facts } = input;
  const base = `${facts.who}${facts.action}${facts.object}`;

  if (role === 'grandparent') {
    return {
      title: short(`${facts.time}，${base}`, 20),
      whatHappened: short(`${facts.time}，${facts.who}在${facts.scene}${facts.action}${facts.object}。`, 30),
      whyForYou: '这是家人最近的一件小事，想让你也看一看。',
      roleNote: '内容由 AI 整理，只描述画面里的事实。',
    };
  }

  if (role === 'child') {
    return {
      title: short(base, 24),
      whatHappened: `${facts.who}在${facts.scene}${facts.action}${facts.object}。`,
      whyForYou: '这件事和你也有关系，可以一起看看。',
      roleNote: '这是 AI 根据画面整理的小故事，不是全部经过。',
    };
  }

  return {
    title: short(base, 28),
    whatHappened: `${facts.time}，${facts.who}在${facts.scene}${facts.action}${facts.object}。`,
    whyForYou: '这是一条近期生活记录，帮你更自然地了解家人。',
    roleNote: '内容由 AI 整理并标注，原始素材仅本人可见。',
  };
}

export function factCoverage(narrative: Narrative, facts: Facts): number {
  const text = `${narrative.title} ${narrative.whatHappened}`;
  const keys: Array<keyof Facts> = ['who', 'action', 'object', 'scene'];
  const hit = keys.filter((key) => facts[key] && text.includes(facts[key])).length;
  return hit / keys.length;
}

export function isFactConsistent(narrative: Narrative, facts: Facts): boolean {
  return factCoverage(narrative, facts) >= 0.75;
}