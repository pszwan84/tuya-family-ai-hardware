const API = process.env.API_BASE ?? 'http://localhost:3001';
const WEB = process.env.WEB_BASE ?? 'http://localhost:3000';

async function check(name: string, url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const ok = response.ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${response.status}`);
    return ok;
  } catch (error) {
    console.log(`FAIL ${name}`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main(): Promise<void> {
  const results = await Promise.all([
    check('api /healthz', `${API}/healthz`),
    check('api /readyz', `${API}/readyz`),
    check('web /login', `${WEB}/login`),
  ]);
  if (results.some((ok) => !ok)) process.exitCode = 1;
}

main();