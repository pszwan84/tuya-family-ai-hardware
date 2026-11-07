import { writeFile } from 'node:fs/promises';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const limit = Number(process.argv[2] ?? 5);

async function login(identifier: string) {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: process.env.DEMO_PASSWORD ?? 'demo1234' }),
  });
  const body = (await response.json()) as { data: { token: string; user: { userId: string } } };
  return body.data;
}

async function main() {
  const user = await login('mid01');
  const draftsResponse = await fetch(`${BASE}/events?ownerId=${user.user.userId}&status=draft`, {
    headers: { authorization: `Bearer ${user.token}` },
  });
  const drafts = (await draftsResponse.json()) as { data: { items: Array<{ eventId: string; title: string; confidence: number; riskLevel: string }> } };

  const rows: string[] = [];
  for (const item of drafts.data.items.slice(0, limit)) {
    const detailResponse = await fetch(`${BASE}/events/${item.eventId}`, {
      headers: { authorization: `Bearer ${user.token}` },
    });
    const detail = (await detailResponse.json()) as {
      data: {
        event: { facts: { who: string; action: string; object: string; scene: string }; confidence: number; risk: { level: string } };
        card: { version: number };
      };
    };
    const facts = detail.data.event.facts;
    rows.push(
      `| ${item.eventId} | ${detail.data.card.version} | ${facts.who} | ${facts.action} | ${facts.object} | ${facts.scene} | ${Math.round(detail.data.event.confidence * 100)}% | ${detail.data.event.risk.level} | 待填 | 待填 |`,
    );
  }

  const content = `# 事实核验记录（自动导出）

导出时间：${new Date().toISOString()}
抽样数量：${rows.length}
模型模式：${process.env.AI_MODE ?? 'mock'}

| eventId | 卡片版本 | 人物 | 行为 | 对象 | 场景 | 置信度 | 风险 | 结论(pass/fail) | 核验人 |
|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

核验规则：
1. 四项事实必须能在原始素材中找到依据；
2. 禁止出现情绪、疾病、关系冲突推断；
3. 抽 5 条，通过率 ≥80% 才能进入演示；
4. 结论为 fail 的事件不得演示。
`;

  await writeFile('docs/fact-check-record.md', content, 'utf8');
  console.log(`已导出 ${rows.length} 条到 docs/fact-check-record.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});