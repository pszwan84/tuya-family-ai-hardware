'use client';

const STAGES = [
  { min: 0, label: '刚刚种下', hint: '家人分享后，小家会慢慢长大', leaves: 0, flower: false },
  { min: 1, label: '冒出芽了', hint: '新的日常正在发生', leaves: 1, flower: false },
  { min: 3, label: '长出叶子', hint: '家里的故事多起来了', leaves: 2, flower: false },
  { min: 6, label: '开出小花', hint: '这一周，彼此看见了很多', leaves: 3, flower: true },
];

export function GrowthCard({ count }: { count: number }) {
  const stage = [...STAGES].reverse().find((item) => count >= item.min) ?? STAGES[0];
  return (
    <div className="panel" style={{ background: 'linear-gradient(135deg, #f2f7ec, #e6efe0)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong>一起把日子养大</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            本周 {count} 条新分享 · {stage.label}
          </p>
        </div>
        <span className="badge">{stage.hint}</span>
      </div>
      <svg viewBox="0 0 240 110" role="img" aria-label={`小家成长：${stage.label}`} style={{ width: '100%', maxWidth: 320, marginTop: 8 }}>
        <ellipse cx="120" cy="96" rx="64" ry="10" fill="#d7c8b2" opacity="0.5" />
        <path d="M120 96V52" stroke="#5d7c52" strokeWidth="4" strokeLinecap="round" />
        {stage.leaves >= 1 ? <path d="M120 76c-18-2-26-12-26-24 14 0 24 8 26 24Z" fill="#7ba36b" /> : null}
        {stage.leaves >= 2 ? <path d="M120 66c18-2 26-12 26-24-14 0-24 8-26 24Z" fill="#94b881" /> : null}
        {stage.leaves >= 3 ? <path d="M120 58c-14-1-20-9-20-18 11 0 18 6 20 18Z" fill="#6d955e" /> : null}
        {stage.flower ? (
          <>
            <circle cx="120" cy="44" r="9" fill="#e8a87c" />
            <circle cx="120" cy="44" r="4" fill="#f6d6a8" />
          </>
        ) : null}
        <text x="120" y="108" textAnchor="middle" fontSize="10" fill="#7b7268">
          {stage.label}
        </text>
      </svg>
    </div>
  );
}