import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const API = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const WEB = process.env.WEB_BASE ?? 'http://localhost:3000';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';
const photosArg = process.argv.find((arg) => arg.startsWith('--photos='));
const photos = photosArg ? photosArg.slice('--photos='.length) : null;

let failed = 0;
const startedAt = Date.now();

async function step(name: string, action: () => Promise<boolean>): Promise<void> {
  const started = Date.now();
  try {
    const ok = await action();
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${Date.now() - started}ms)`);
    if (!ok) failed += 1;
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function runScript(script: string, args: string[]): boolean {
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const result = spawnSync(process.execPath, [tsxCli, script, ...args], { stdio: 'inherit' });
  return result.status === 0;
}

async function main(): Promise<void> {
  await step('API /healthz', async () => (await fetch(`${API.replace('/api/v1', '')}/healthz`)).ok);
  await step('API /readyz', async () => (await fetch(`${API.replace('/api/v1', '')}/readyz`)).ok);
  await step('Web 首页', async () => (await fetch(`${WEB}/`)).ok);
  await step('Web 登录页', async () => (await fetch(`${WEB}/login`)).ok);
  await step('家庭页', async () => (await fetch(`${WEB}/family/feed`)).ok);

  await step('重置演示数据', async () => {
    const response = await fetch(`${API}/admin/demo/reset`, { method: 'POST', headers: { 'x-demo-key': KEY } });
    return response.ok;
  });
  await step('写入种子数据', async () => {
    const response = await fetch(`${API}/admin/demo/seed`, { method: 'POST', headers: { 'x-demo-key': KEY } });
    return response.ok;
  });

  if (photos) {
    await step('导入现场照片', async () => runScript('infra/scripts/import-photos.ts', [photos, '--no-reset']));
  }

  await step('端到端冒烟（16 项）', async () => runScript('infra/scripts/verify.ts', []));

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n彩排检查完成，用时 ${seconds}s，失败 ${failed} 项`);
  console.log('演示前确认：');
  console.log('1. 打开 / 念开场白');
  console.log('2. mid01 待分享 → 详情 → 双角色预览 → 确认分享');
  console.log('3. 切 gp01 验证 2 秒可见；切回撤回');
  console.log('4. 设备页拍一张 / 暂停');
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});