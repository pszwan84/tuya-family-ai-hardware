import type { Extraction } from '../extraction';

export type ImageRequest = {
  facts: Extraction['facts'];
  eventType: string;
  seed: string;
};

export type ImageResult = { data: Buffer; contentType: string } | null;

export interface ImageProvider {
  readonly name: string;
  generate(request: ImageRequest): Promise<ImageResult>;
}

const STYLE_PROMPT =
  '温暖手绘扁平插画风格，柔和配色，家庭日常场景。禁止出现任何文字、招牌、门牌、车牌、屏幕内容、证件或可识别地址。只画画面事实，不添加对白气泡。';

export function buildImagePrompt(request: ImageRequest): string {
  return `${STYLE_PROMPT} 事实：${request.facts.who}在${request.facts.scene}${request.facts.action}${request.facts.object}。时间：${request.facts.time}。`;
}

export class TemplateOnlyImageProvider implements ImageProvider {
  readonly name = 'template_only';

  async generate(): Promise<ImageResult> {
    return null;
  }
}

export class DashScopeImageProvider implements ImageProvider {
  readonly name = 'dashscope';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async generate(request: ImageRequest): Promise<ImageResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/services/aigc/text2image/image-synthesis`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.1-t2i-turbo',
        input: { prompt: buildImagePrompt(request) },
        parameters: { size: '1024*1024', n: 1 },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return null;
  }
}