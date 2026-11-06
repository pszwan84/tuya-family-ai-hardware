const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';

async function main(): Promise<void> {
  const response = await fetch(`${BASE}/admin/demo/reset`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const body = await response.json();
  if (!response.ok) {
    console.error('reset failed', body);
    process.exitCode = 1;
    return;
  }
  console.log('已重置：业务表、队列与对象存储均已清空。RuntimeConfig 保留。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});