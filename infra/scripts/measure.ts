import { createHash, createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const WEB = process.env.WEB_BASE ?? 'http://localhost:3000';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[index]);
};

async function main(): Promise<void> {
  await fetch(`${BASE}/admin/demo/reset`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const seedResponse = await fetch(`${BASE}/admin/demo/seed`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const seed = (await seedResponse.json()) as { data: { devices: Array<{ deviceId: string; deviceKey: string }> } };
  const device = seed.data.devices[1];

  const loginResponse = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'mid01', password: process.env.DEMO_PASSWORD ?? 'demo1234' }),
  });
  const login = (await loginResponse.json()) as { data: { token: string; user: { userId: string } } };
  const userToken = login.data.token;

  const uploadLatencies: number[] = [];
  const eventLatencies: number[] = [];
  const imageLatencies: number[] = [];

  for (let index = 0; index < 8; index += 1) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomUUID();
    const signature = createHmac('sha256', device.deviceKey)
      .update(`POST/api/v1/devices/${device.deviceId}/token${timestamp}${nonce}`)
      .digest('hex');
    const tokenResponse = await fetch(`${BASE}/devices/${device.deviceId}/token`, {
      method: 'POST',
      headers: { 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-signature': signature },
    });
    const token = (await tokenResponse.json()) as { data: { accessToken: string } };

    const image = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 30 + index * 20, g: 100 + index * 5, b: 150 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="800" height="600"><circle cx="${150 + index * 60}" cy="${200 + index * 20}" r="100" fill="#fbbf24"/><rect x="420" y="330" width="220" height="140" fill="#34d399"/></svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 82 })
      .toBuffer();

    const clientAssetId = `perf_${Date.now()}_${index}`;
    const form = new FormData();
    form.append('file', new Blob([image], { type: 'image/jpeg' }), `${clientAssetId}.jpg`);
    form.append(
      'metadata',
      JSON.stringify({
        clientAssetId,
        assetType: 'photo',
        capturedStartAt: new Date().toISOString(),
        capturedEndAt: new Date().toISOString(),
        trigger: 'manual',
        sha256: createHash('sha256').update(image).digest('hex'),
        fwVersion: '1.0.0-perf',
        qualityFlags: [],
      }),
    );

    const started = Date.now();
    const upload = await fetch(`${BASE}/devices/${device.deviceId}/assets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.data.accessToken}`, 'idempotency-key': `${device.deviceId}:${clientAssetId}` },
      body: form,
    });
    uploadLatencies.push(Date.now() - started);

    let found = false;
    const deadline = Date.now() + 15000;
    while (!found && Date.now() < deadline) {
      const drafts = await fetch(`${BASE}/events?ownerId=${login.data.user.userId}&status=draft`, {
        headers: { authorization: `Bearer ${userToken}` },
      });
      const body = (await drafts.json()) as { data?: { items: Array<{ eventId: string; card: { imageUrl: string | null } }> } };
      found = (body.data?.items?.length ?? 0) > index;
      if (found) {
        eventLatencies.push(Date.now() - started);
        const imageUrl = body.data?.items?.[index]?.card.imageUrl;
        if (imageUrl) {
          const imageStarted = Date.now();
          await fetch(imageUrl);
          imageLatencies.push(Date.now() - imageStarted);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  const webStarted = Date.now();
  const webResponse = await fetch(`${WEB}/me/drafts`);
  const webLatency = Date.now() - webStarted;

  const report = {
    uploads: uploadLatencies.length,
    uploadP50Ms: percentile(uploadLatencies, 50),
    uploadP95Ms: percentile(uploadLatencies, 95),
    eventP50Ms: percentile(eventLatencies, 50),
    eventP95Ms: percentile(eventLatencies, 95),
    cardImageP50Ms: percentile(imageLatencies, 50),
    cardImageP95Ms: percentile(imageLatencies, 95),
    webFirstScreenMs: webLatency,
    webStatus: webResponse.status,
  };

  console.log(JSON.stringify(report, null, 2));
  const failed = report.uploadP95Ms > 10000 || report.eventP95Ms > 30000 || report.webFirstScreenMs > 5000;
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});