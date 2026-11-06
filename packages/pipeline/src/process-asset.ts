import { MockVisionProvider, guardExtraction, detectRiskSignals, validateExtraction } from '@fah/ai';
import { buildNarrative, computeShareValue, evaluateRisk } from '@fah/domain';
import type { PipelineDeps } from './deps';
import { computePerceptualHash, hammingDistance } from './hash';
import { checkQuality } from './quality';
import { renderTemplateCard } from './card';

export type ProcessResult =
  | { status: 'skipped'; reason: string }
  | { status: 'invalid'; assetId: string; reasons: string[] }
  | { status: 'duplicate'; assetId: string; representativeAssetId: string }
  | { status: 'unrecognized'; assetId: string }
  | { status: 'event_created'; assetId: string; eventId: string };

const valueByType = (eventType: string) => {
  switch (eventType) {
    case 'first_time':
      return { freshness: 0.95, relevance: 0.8, understandability: 0.8, intent: 0.7 };
    case 'small_change':
      return { freshness: 0.85, relevance: 0.75, understandability: 0.8, intent: 0.65 };
    case 'small_achievement':
      return { freshness: 0.8, relevance: 0.8, understandability: 0.85, intent: 0.7 };
    case 'shared_memory':
      return { freshness: 0.6, relevance: 0.9, understandability: 0.75, intent: 0.7 };
    case 'small_joy':
      return { freshness: 0.75, relevance: 0.7, understandability: 0.85, intent: 0.6 };
    default:
      return { freshness: 0.7, relevance: 0.7, understandability: 0.8, intent: 0.6 };
  }
};

export async function processAsset(deps: PipelineDeps, assetId: string): Promise<ProcessResult> {
  const { prisma, storage, config, logger } = deps;
  const asset = await prisma.asset.findUnique({ where: { assetId } });
  if (!asset) return { status: 'skipped', reason: 'asset_not_found' };
  if (asset.validity !== 'unprocessed') return { status: 'skipped', reason: 'already_processed' };

  const buffer = await storage.get(asset.storageKey);
  const flags = Array.isArray(asset.qualityFlags) ? (asset.qualityFlags as string[]) : [];
  const quality = checkQuality(buffer, flags);
  if (!quality.valid) {
    await prisma.asset.update({
      where: { assetId },
      data: { validity: 'invalid', invalidReason: quality.reasons.join(',') },
    });
    return { status: 'invalid', assetId, reasons: quality.reasons };
  }

  const perceptualHash = await computePerceptualHash(buffer);
  const capturedAt = asset.capturedStartAt;
  const windowStart = new Date(capturedAt.getTime() - config.dedupeWindowSec * 1000);
  const windowEnd = new Date(capturedAt.getTime() + config.dedupeWindowSec * 1000);

  const candidates = await prisma.asset.findMany({
    where: {
      familyId: asset.familyId,
      ownerId: asset.ownerId,
      assetId: { not: assetId },
      perceptualHash: { not: null },
      capturedStartAt: { gte: windowStart, lte: windowEnd },
      validity: { in: ['valid', 'duplicate'] },
    },
    orderBy: { capturedStartAt: 'asc' },
  });

  const duplicate = candidates.find(
    (candidate) =>
      candidate.perceptualHash !== null &&
      hammingDistance(perceptualHash, candidate.perceptualHash) <= config.dedupeHammingThreshold,
  );

  if (duplicate) {
    await prisma.asset.update({
      where: { assetId },
      data: {
        validity: 'duplicate',
        perceptualHash,
        captureSessionId: duplicate.captureSessionId,
        invalidReason: `duplicate_of:${duplicate.assetId}`,
      },
    });
    return { status: 'duplicate', assetId, representativeAssetId: duplicate.assetId };
  }

  const clusterStart = new Date(capturedAt.getTime() - config.clusterWindowSec * 1000);
  const existingSession = await prisma.captureSession.findFirst({
    where: {
      familyId: asset.familyId,
      ownerId: asset.ownerId,
      windowEnd: { gte: clusterStart },
    },
    orderBy: { windowEnd: 'desc' },
  });

  const session = existingSession
    ? await prisma.captureSession.update({
        where: { sessionId: existingSession.sessionId },
        data: {
          windowEnd: new Date(Math.max(existingSession.windowEnd.getTime(), capturedAt.getTime())),
          assetCount: { increment: 1 },
        },
      })
    : await prisma.captureSession.create({
        data: {
          familyId: asset.familyId,
          ownerId: asset.ownerId,
          windowStart: new Date(capturedAt.getTime() - config.clusterWindowSec * 2000),
          windowEnd: capturedAt,
          assetCount: 1,
        },
      });

  await prisma.asset.update({
    where: { assetId },
    data: { perceptualHash, captureSessionId: session.sessionId },
  });

  const request = {
    image: buffer,
    contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
    assetId: asset.assetId,
    capturedAt: asset.capturedStartAt.toISOString(),
    qualityFlags: flags,
  };

  let extraction;
  try {
    extraction = await deps.vision.analyze(request);
  } catch (error) {
    logger?.warn({ err: error, assetId }, 'vision provider failed, retrying once');
    try {
      extraction = await deps.vision.analyze(request);
    } catch {
      extraction = await new MockVisionProvider().analyze(request);
    }
  }

  const checked = validateExtraction(extraction);
  if (!checked.ok) {
    await prisma.asset.update({
      where: { assetId },
      data: { validity: 'valid', invalidReason: `schema_failed:${checked.errors.join(';').slice(0, 200)}` },
    });
    return { status: 'skipped', reason: 'schema_failed' };
  }

  const value = checked.value;
  const guarded = guardExtraction(value);

  if (value.unrecognized) {
    await prisma.asset.update({ where: { assetId }, data: { validity: 'valid' } });
    return { status: 'unrecognized', assetId };
  }

  const riskSignals = detectRiskSignals(value.description, value.riskSignals);
  const risk = evaluateRisk({
    signals: riskSignals as never,
    text: guarded.description,
    confidence: value.confidence,
    confidenceThreshold: config.confidenceThreshold,
    hasExactLocation: riskSignals.includes('exact_location'),
    thirdPartyVisible: riskSignals.includes('third_party'),
  });

  const base = valueByType(value.eventType);
  const shareValue = computeShareValue({
    ...base,
    privacyRisk: risk.level === 'high' ? 0.9 : risk.level === 'sensitive' ? 0.35 : 0.05,
    careBurden: risk.level === 'high' ? 0.5 : 0.1,
  });

  const middleNarrative = buildNarrative({
    role: 'middle',
    facts: value.facts,
    eventType: value.eventType,
    relation: 'family',
  });

  const event = await prisma.event.create({
    data: {
      familyId: asset.familyId,
      ownerId: asset.ownerId,
      sessionId: session.sessionId,
      eventType: value.eventType,
      factsWho: value.facts.who,
      factsAction: value.facts.action,
      factsObject: value.facts.object,
      factsScene: value.facts.scene,
      factsTime: value.facts.time,
      description: guarded.description,
      confidence: value.confidence,
      confidenceLevel: value.confidence < config.confidenceThreshold ? 'low' : 'high',
      riskLevel: risk.level,
      riskItems: risk.items,
      shareFreshness: shareValue.freshness,
      shareRelevance: shareValue.relevance,
      shareUnderstand: shareValue.understandability,
      shareIntent: shareValue.intent,
      shareTotal: shareValue.total,
      status: 'draft',
      visibility: 'owner_only',
      occurredAt: asset.capturedStartAt,
      cardTitle: middleNarrative.title,
      cardWhatHappened: middleNarrative.whatHappened,
      cardVersion: 1,
      cardRenderMode: 'template',
      generationStatus: 'ok',
    },
  });

  const cardKey = `cards/${event.eventId}/v1.svg`;
  const svg = renderTemplateCard({
    eventType: value.eventType,
    facts: value.facts,
    title: middleNarrative.title,
    whatHappened: middleNarrative.whatHappened,
  });
  await storage.put(cardKey, svg, 'image/svg+xml');

  await prisma.event.update({
    where: { eventId: event.eventId },
    data: { cardId: `card_${event.eventId}`, cardImageKey: cardKey },
  });

  await prisma.asset.update({
    where: { assetId },
    data: { validity: 'valid' },
  });

  logger?.info({ assetId, eventId: event.eventId, risk: risk.level }, 'event created');
  return { status: 'event_created', assetId, eventId: event.eventId };
}