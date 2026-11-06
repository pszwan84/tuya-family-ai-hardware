import { createHash, createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const DEMO_KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';

type Envelope<T> = { requestId: string; code: string; message: string; data: T; retryable: boolean };
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}`, detail ?? '');
  }
}

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<{ status: number; body: Envelope<T> }> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = (await response.json()) as Envelope<T>;
  return { status: response.status, body };
}

async function login(identifier: string): Promise<{ token: string; userId: string; familyId: string }> {
  const result = await api<{ token: string; user: { userId: string }; family: { familyId: string } }>('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: process.env.DEMO_PASSWORD ?? 'demo1234' }),
  });
  return { token: result.body.data.token, userId: result.body.data.user.userId, familyId: result.body.data.family.familyId };
}

async function imageBuffer(seed: number): Promise<{ buffer: Buffer; sha256: string }> {
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 40 + (seed % 10) * 15, g: 90, b: 120 } },
  })
    .composite([
      { input: Buffer.from(`<svg width="640" height="480"><circle cx="${120 + seed * 20}" cy="200" r="90" fill="#f59e0b"/><rect x="300" y="260" width="180" height="120" fill="#22c55e"/></svg>`), top: 0, left: 0 },
    ])
    .jpeg({ quality: 80 })
    .toBuffer();
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex') };
}

async function upload(
  deviceId: string,
  deviceKey: string,
  clientAssetId: string,
  image: { buffer: Buffer; sha256: string },
  options?: { forgedKey?: string; trigger?: string },
): Promise<{ status: number; body: Envelope<{ assetId: string; status: string; deduped: boolean }> }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signature = createHmac('sha256', options?.forgedKey ?? deviceKey)
    .update(`POST/api/v1/devices/${deviceId}/token${timestamp}${nonce}`)
    .digest('hex');
  const tokenResponse = await fetch(`${BASE}/devices/${deviceId}/token`, {
    method: 'POST',
    headers: { 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-signature': signature },
  });
  const tokenBody = (await tokenResponse.json()) as Envelope<{ accessToken: string }>;
  if (tokenResponse.status !== 200) {
    return { status: tokenResponse.status, body: tokenBody as never };
  }

  const metadata = {
    clientAssetId,
    assetType: 'photo',
    capturedStartAt: new Date().toISOString(),
    capturedEndAt: new Date().toISOString(),
    trigger: options?.trigger ?? 'manual',
    sha256: image.sha256,
    fwVersion: '1.0.0-demo',
    qualityFlags: [],
  };

  const form = new FormData();
  form.append('file', new Blob([image.buffer], { type: 'image/jpeg' }), `${clientAssetId}.jpg`);
  form.append('metadata', JSON.stringify(metadata));

  const response = await fetch(`${BASE}/devices/${deviceId}/assets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenBody.data.accessToken}`, 'idempotency-key': `${deviceId}:${clientAssetId}` },
    body: form,
  });
  const body = (await response.json()) as Envelope<{ assetId: string; status: string; deduped: boolean }>;
  return { status: response.status, body };
}

async function main(): Promise<void> {
  await api('/admin/demo/reset', { method: 'POST', headers: { 'x-demo-key': DEMO_KEY } }, undefined);
  const seed = await api<{
    familyId: string;
    members: Array<{ userId: string; loginIdentifier: string; role: string }>;
    devices: Array<{ deviceId: string; ownerId: string; deviceKey: string }>;
  }>('/admin/demo/seed', { method: 'POST', headers: { 'x-demo-key': DEMO_KEY } }, undefined);
  if (seed.status !== 200) {
    console.error('seed failed', seed.body);
    process.exit(1);
  }
  const devices = seed.body.data.devices;
  const midDevice = devices[1];
  const mid = await login('mid01');
  const gp = await login('gp01');

  const forged = await upload(midDevice.deviceId, midDevice.deviceKey, `cap_forged_${Date.now()}`, await imageBuffer(1), {
    forgedKey: 'wrong-key',
  });
  check('伪造签名返回 401', forged.status === 401, forged.status);

  const clientAssetId = `cap_${Date.now()}`;
  const image = await imageBuffer(3 + Math.floor(Math.random() * 50));
  const accepted = await upload(midDevice.deviceId, midDevice.deviceKey, clientAssetId, image);
  check('合法上传返回 202', accepted.status === 202, accepted.status);
  check('受理返回 assetId', Boolean(accepted.body?.data?.assetId), accepted.body);

  const duplicate = await upload(midDevice.deviceId, midDevice.deviceKey, clientAssetId, image);
  check('重复上传返回 exists', duplicate.body?.data?.status === 'exists', duplicate.body);

  const conflictImage = await imageBuffer(7);
  const conflict = await upload(midDevice.deviceId, midDevice.deviceKey, clientAssetId, conflictImage);
  check('同 ID 不同内容返回 409', conflict.status === 409, conflict.status);

  let eventId = '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const drafts = await api<{ items: Array<{ eventId: string; title: string; riskLevel: string }> }>(
      `/events?ownerId=${mid.userId}&status=draft&sort=recommend`,
      {},
      mid.token,
    );
    const first = drafts.body?.data?.items?.[0];
    if (first) {
      eventId = first.eventId;
      check('待分享列表返回事件与理由', true);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check('素材处理产出结构化事件', Boolean(eventId));

  if (eventId) {
    const preview = await api<{ previews: Array<{ memberId: string; title: string; whatHappened: string }>; risk: { level: string } }>(
      `/events/${eventId}/share/preview`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientIds: [gp.userId, seed.body.data.members[2].userId], scope: 'members' }),
      },
      mid.token,
    );
    check('预览返回双角色版本', (preview.body?.data?.previews?.length ?? 0) >= 2, preview.body);
    const titles = new Set(preview.body?.data?.previews?.map((item) => item.title));
    check('双角色标题不同', titles.size >= 2, [...titles]);

    const share = await api<{ shareId: string; status: string }>(
      `/events/${eventId}/share`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope: 'members', recipientIds: [gp.userId, seed.body.data.members[2].userId] }),
      },
      mid.token,
    );
    check('确认分享成功', share.body?.data?.status === 'shared', share.body);

    const family = await api<{ items: Array<{ eventId: string }> }>(`/families/${gp.familyId}/events`, {}, gp.token);
    check('接收者 2 秒内可见', family.body?.data?.items?.some((item) => item.eventId === eventId) ?? false, family.body);

    const forbidden = await api(`/events/${eventId}/share`, { method: 'DELETE' }, gp.token);
    check('非 owner 撤回返回 403', forbidden.status === 403, forbidden.status);

    const revoke = await api(`/events/${eventId}/share`, { method: 'DELETE' }, mid.token);
    check('owner 撤回成功', revoke.status === 200, revoke.status);

    const familyAfter = await api<{ items: Array<{ eventId: string }> }>(`/families/${gp.familyId}/events`, {}, gp.token);
    check('撤回后家庭视图消失', !(familyAfter.body?.data?.items?.some((item) => item.eventId === eventId) ?? false));

    const personal = await api<{ items: Array<{ eventId: string; status: string }> }>('/users/me/timeline', {}, mid.token);
    check('个人时间线保留事件', personal.body?.data?.items?.some((item) => item.eventId === eventId) ?? false);
  }

  const deviceStatus = await api<{ online: boolean; collectState: string }>(`/devices/${midDevice.deviceId}/status`, {}, mid.token);
  check('设备状态可查询', deviceStatus.status === 200 && typeof deviceStatus.body?.data?.online === 'boolean', deviceStatus.body);

  console.log(`\nRESULT passed=${passed} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});