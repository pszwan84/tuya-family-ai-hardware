import { createHash } from 'node:crypto';

export async function computePerceptualHash(buffer: Buffer): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const { data } = await sharp(buffer).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        bits += left > right ? '1' : '0';
      }
    }
    return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
  } catch {
    return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }
}

export function hammingDistance(a: string, b: string): number {
  const length = Math.max(a.length, b.length);
  let distance = 0;
  for (let index = 0; index < length; index += 1) {
    const left = parseInt(a[index] ?? '0', 16);
    const right = parseInt(b[index] ?? '0', 16);
    let xor = left ^ right;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}