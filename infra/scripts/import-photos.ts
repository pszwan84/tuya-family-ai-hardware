import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';
const dir = process.argv[2];
const resetFirst = !process.argv.includes('--no-reset');

async function login(identifier: string) {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: process.env.DEMO_PASSWORD ?? 'demo1234' }),
  });
  const body = (await response.json()) as { data: { token: string; user: { userId: string } } };
  return body.data;
}

async function deviceToken(deviceId: string, deviceKey: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signature = createHmac('sha256', deviceKey).update(`POST/api/v1/devices/${deviceId}/token${timestamp}${nonce}`).digest('hex');
  const response = await fetch(`${BASE}/devices/${deviceId}/token`, {
    method: 'POST',
    headers: { 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-signature': signature },
  });
  const body = (await response.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function main() {
  if (!dir) {
    console.error('用法: npx tsx infra/scripts/import-photos.ts <照片目录> [--no-reset]');
    process.exitCode = 1;
    return;
  }

  if (resetFirst) {
    await fetch(`${BASE}/admin/demo/reset`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  }
  const seedResponse = await fetch(`${BASE}/admin/demo/seed`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const seed = (await seedResponse.json()) as { data: { devices: Array<{ deviceId: string; deviceKey: string }> } };
  const device = seed.data.devices[1];
  const token = await deviceToken(device.deviceId, device.deviceKey);
  const user = await login('mid01');

  const folder = resolve(dir);
  const files = (await readdir(folder)).filter((name) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(name).toLowerCase()));
  if (files.length === 0) {
    console.error('目录中没有可导入的图片');
    process.exitCode = 1;
    return;
  }

  let accepted = 0;
  for (const [index, name] of files.entries()) {
    const path = join(folder, name);
    const info = await stat(path);
    const image = await sharp(path).resize(1280, 960, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const capturedAt = new Date(info.mtimeMs).toISOString();
    const clientAssetId = `import_${Math.round(info.mtimeMs)}_${index}`;

    const form = new FormData();
    form.append('file', new Blob([image], { type: 'image/jpeg' }), `${clientAssetId}.jpg`);
    form.append(
      'metadata',
      JSON.stringify({
        clientAssetId,
        assetType: 'photo',
        capturedStartAt: capturedAt,
        capturedEndAt: capturedAt,
        trigger: 'scheduled',
        sha256: createHash('sha256').update(image).digest('hex'),
        fwVersion: 'import-1.0',
        qualityFlags: [],
      }),
    );

    const response = await fetch(`${BASE}/devices/${device.deviceId}/assets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `${device.deviceId}:${clientAssetId}` },
      body: form,
    });
    if (response.status === 202) accepted += 1;
    console.log(`${response.status} ${name}`);
  }

  let drafts = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${BASE}/events?ownerId=${user.user.userId}&status=draft`, {
      headers: { authorization: `Bearer ${user.token}` },
    });
    const body = (await response.json()) as { data?: { items: unknown[] } };
    drafts = body.data?.items?.length ?? 0;
    if (drafts >= accepted) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log(`\n导入完成：受理 ${accepted}/${files.length}，待分享事件 ${drafts}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});