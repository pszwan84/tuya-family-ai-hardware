const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const KEY = process.env.DEMO_SWITCH_KEY ?? 'demo-switch-key';

async function main(): Promise<void> {
  const response = await fetch(`${BASE}/admin/demo/seed`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const body = await response.json();
  if (!response.ok) {
    console.error('seed failed', body);
    process.exitCode = 1;
    return;
  }
  const data = body.data as {
    familyId: string;
    members: Array<{ loginIdentifier: string; role: string }>;
    devices: Array<{ deviceId: string; deviceKey: string }>;
  };
  console.log('演示家庭已就绪');
  console.log('familyId:', data.familyId);
  console.log('账号: gp01 / mid01 / kid01，密码 demo1234');
  console.log('设备:', data.devices.map((device) => `${device.deviceId}(${device.deviceKey})`).join(', '));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});