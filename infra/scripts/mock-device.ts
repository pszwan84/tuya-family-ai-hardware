import { createHash, createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';
type Scenario = 'happy' | 'offline' | 'duplicate' | 'slow';

async function getDevice(): Promise<{ deviceId: string; deviceKey: string }> {
  const response = await fetch(`${BASE}/admin/demo/seed`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const body = (await response.json()) as { data: { devices: Array<{ deviceId: string; deviceKey: string }> } };
  return body.data.devices[1];
}

async function token(deviceId: string, deviceKey: string): Promise<string> {
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

async function makeImage(): Promise<{ buffer: Buffer; sha256: string }> {
  const hue = Math.floor(Math.random() * 255);
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: hue, g: 120, b: 160 } } })
    .composite([{ input: Buffer.from('<svg width="800" height="600"><circle cx="300" cy="240" r="120" fill="#fbbf24"/><rect x="430" y="330" width="220" height="140" fill="#34d399"/></svg>'), top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex') };
}

async function uploadOnce(deviceId: string, accessToken: string, clientAssetId: string, image: { buffer: Buffer; sha256: string }, base = BASE) {
  const metadata = {
    clientAssetId,
    assetType: 'photo',
    capturedStartAt: new Date().toISOString(),
    capturedEndAt: new Date().toISOString(),
    trigger: 'manual',
    sha256: image.sha256,
    fwVersion: '1.0.0-mock',
    qualityFlags: [],
  };
  const form = new FormData();
  form.append('file', new Blob([image.buffer], { type: 'image/jpeg' }), `${clientAssetId}.jpg`);
  form.append('metadata', JSON.stringify(metadata));
  const response = await fetch(`${base}/devices/${deviceId}/assets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': `${deviceId}:${clientAssetId}` },
    body: form,
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main(): Promise<void> {
  const scenario = (process.argv[2] ?? 'happy') as Scenario;
  const device = await getDevice();
  const accessToken = await token(device.deviceId, device.deviceKey);
  const clientAssetId = `mock_${Date.now()}`;
  const image = await makeImage();

  if (scenario === 'offline') {
    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        results.push(await uploadOnce(device.deviceId, accessToken, clientAssetId, image, 'http://localhost:3999/api/v1'));
      } catch (error) {
        results.push({ status: 0, body: { error: error instanceof Error ? error.message : 'network' } });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
    console.log('offline 剧本：3 次退避后结果', results.map((item) => item.status));
    return;
  }

  if (scenario === 'slow') {
    const started = Date.now();
    const result = await uploadOnce(device.deviceId, accessToken, clientAssetId, image);
    console.log('slow 剧本：耗时', Date.now() - started, 'ms，状态', result.status);
    return;
  }

  const first = await uploadOnce(device.deviceId, accessToken, clientAssetId, image);
  console.log('happy 剧本：', first.status, JSON.stringify(first.body));
  if (scenario === 'duplicate') {
    const second = await uploadOnce(device.deviceId, accessToken, clientAssetId, image);
    console.log('duplicate 剧本：', second.status, JSON.stringify(second.body));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});