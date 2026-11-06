import type { Facts } from '@fah/contracts';

const COLORS: Record<string, { bg: string; accent: string }> = {
  first_time: { bg: '#fef3c7', accent: '#f59e0b' },
  small_change: { bg: '#dcfce7', accent: '#22c55e' },
  small_achievement: { bg: '#dbeafe', accent: '#3b82f6' },
  small_joy: { bg: '#fae8ff', accent: '#d946ef' },
  shareable: { bg: '#e0f2fe', accent: '#0ea5e9' },
  shared_memory: { bg: '#fde68a', accent: '#b45309' },
};

const escapeXml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export function renderTemplateCard(input: {
  eventType: string;
  facts: Facts;
  title: string;
  whatHappened: string;
}): Buffer {
  const palette = COLORS[input.eventType] ?? COLORS.shareable;
  const lines = [input.whatHappened].flatMap((text) => {
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += 18) chunks.push(text.slice(index, index + 18));
    return chunks;
  });
  const body = lines
    .map((line, index) => `<text x="48" y="${300 + index * 34}" font-size="24" fill="#3f3f46">${escapeXml(line)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="560" viewBox="0 0 880 560">
  <rect width="880" height="560" fill="${palette.bg}"/>
  <rect x="0" y="0" width="880" height="12" fill="${palette.accent}"/>
  <circle cx="760" cy="120" r="72" fill="${palette.accent}" opacity="0.18"/>
  <rect x="648" y="180" width="150" height="96" rx="18" fill="${palette.accent}" opacity="0.25"/>
  <text x="48" y="92" font-size="40" font-weight="700" fill="#18181b">${escapeXml(input.title)}</text>
  <text x="48" y="140" font-size="20" fill="#71717a">${escapeXml(input.facts.time)} · ${escapeXml(input.facts.scene)}</text>
  <rect x="48" y="180" width="560" height="150" rx="22" fill="#ffffff" opacity="0.72"/>
  ${body}
  <rect x="48" y="470" width="120" height="40" rx="20" fill="#ffffff" opacity="0.9"/>
  <text x="66" y="497" font-size="18" fill="#52525b">AI 整理</text>
  <text x="660" y="520" font-size="16" fill="#71717a">原始素材仅本人可见</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

export function renderTextCard(input: { title: string; whatHappened: string; reason: string }): string {
  return `${input.title}\n${input.whatHappened}\nAI 整理：${input.reason}`;
}