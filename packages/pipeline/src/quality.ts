export type QualityFlags = string[];

export type QualityResult = { valid: boolean; reasons: string[] };

export function checkQuality(buffer: Buffer, flags: QualityFlags): QualityResult {
  const reasons: string[] = [];
  if (buffer.length < 512) reasons.push('empty');
  if (flags.includes('dark')) reasons.push('dark');
  if (flags.includes('blur')) reasons.push('blur');
  if (flags.includes('overexposed')) reasons.push('overexposed');
  return { valid: reasons.length === 0, reasons };
}