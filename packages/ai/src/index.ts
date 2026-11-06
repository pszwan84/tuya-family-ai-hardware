export * from './extraction';
export * from './providers/vision';
export * from './providers/image';
export * from './prompt-registry';
export * from './fact-guard';

import { MockVisionProvider, OpenAiCompatibleVisionProvider } from './providers/vision';
import type { VisionProvider } from './extraction';
import { TemplateOnlyImageProvider, DashScopeImageProvider, type ImageProvider } from './providers/image';

export type AiOptions = {
  mode: 'mock' | 'live';
  vlmBaseUrl: string;
  vlmApiKey: string;
  vlmModel: string;
  cardMode: 'template' | 'live';
  imageBaseUrl: string;
  imageApiKey: string;
};

export function createVisionProvider(options: AiOptions): VisionProvider {
  if (options.mode === 'live' && options.vlmApiKey) {
    return new OpenAiCompatibleVisionProvider(options.vlmBaseUrl, options.vlmApiKey, options.vlmModel);
  }
  return new MockVisionProvider();
}

export function createImageProvider(options: AiOptions): ImageProvider {
  if (options.cardMode === 'live' && options.imageApiKey) {
    return new DashScopeImageProvider(options.imageBaseUrl, options.imageApiKey);
  }
  return new TemplateOnlyImageProvider();
}