import type { Extraction, VisionProvider, VisionRequest } from '../extraction';

const FIXTURES: Extraction[] = [
  {
    eventType: 'small_joy',
    facts: { who: '奶奶', action: '包了', object: '饺子', scene: '厨房', time: '今天上午' },
    description: '今天上午，奶奶在厨房包了饺子。',
    confidence: 0.88,
    typeConfidence: 0.84,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
  {
    eventType: 'small_achievement',
    facts: { who: '孩子', action: '搭好了', object: '积木城堡', scene: '客厅', time: '今天下午' },
    description: '今天下午，孩子在客厅搭好了一座积木城堡。',
    confidence: 0.82,
    typeConfidence: 0.8,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
  {
    eventType: 'small_change',
    facts: { who: '爷爷', action: '浇了', object: '阳台的花', scene: '阳台', time: '今天早上' },
    description: '今天早上，爷爷在阳台给花浇水。',
    confidence: 0.76,
    typeConfidence: 0.72,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
  {
    eventType: 'shareable',
    facts: { who: '家人', action: '一起散步', object: '傍晚的街道', scene: '小区外', time: '傍晚' },
    description: '傍晚，家人在小区外一起散步。',
    confidence: 0.7,
    typeConfidence: 0.66,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
  {
    eventType: 'first_time',
    facts: { who: '孩子', action: '画了', object: '一幅画', scene: '书桌', time: '今天' },
    description: '今天，孩子在书桌画了一幅画。',
    confidence: 0.8,
    typeConfidence: 0.78,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
  {
    eventType: 'shared_memory',
    facts: { who: '奶奶', action: '翻看', object: '旧相册', scene: '客厅', time: '午后' },
    description: '午后，奶奶在客厅翻看旧相册。',
    confidence: 0.74,
    typeConfidence: 0.7,
    unrecognized: false,
    riskSignals: [],
    quality: { valid: true, reasons: [] },
    evidence: { who: true, action: true, object: true, scene: true },
  },
];

const hashIndex = (request: VisionRequest) => {
  let sum = 0;
  for (let index = 0; index < request.assetId.length; index += 1) {
    sum = (sum * 31 + request.assetId.charCodeAt(index)) % 997;
  }
  return sum % FIXTURES.length;
};

export class MockVisionProvider implements VisionProvider {
  readonly name = 'mock';

  async analyze(request: VisionRequest): Promise<Extraction> {
    if (request.image.length < 512) {
      return {
        ...FIXTURES[0],
        eventType: 'shareable',
        facts: { who: '未知', action: '未识别', object: '未知', scene: '未知', time: '未知' },
        description: '画面内容不足，暂时无法识别明确事件。',
        confidence: 0.2,
        typeConfidence: 0.1,
        unrecognized: true,
        quality: { valid: false, reasons: ['empty'] },
        evidence: { who: false, action: false, object: false, scene: false },
      };
    }
    const fixture = FIXTURES[hashIndex(request)];
    const flags = request.qualityFlags.filter((flag) => flag === 'dark' || flag === 'blur');
    if (flags.length > 0) {
      return {
        ...fixture,
        confidence: 0.35,
        typeConfidence: 0.3,
        quality: { valid: false, reasons: flags as Array<'dark' | 'blur'> },
      };
    }
    return fixture;
  }
}

export class OpenAiCompatibleVisionProvider implements VisionProvider {
  readonly name = 'openai-compatible';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async analyze(request: VisionRequest): Promise<Extraction> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是家庭生活事件的记录助手。只描述画面中可确认的人物、行为、对象、场景与时间，不得推断情绪、疾病、关系冲突或编造对白。无法确认时把对应字段填为“未知”。仅输出 JSON，不要输出解释。',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请输出事件 JSON，字段为 eventType、facts{who,action,object,scene,time}、description、confidence、typeConfidence、unrecognized、riskSignals、quality{valid,reasons}、evidence{who,action,object,scene}。' },
              {
                type: 'image_url',
                image_url: { url: `data:${request.contentType};base64,${request.image.toString('base64')}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`vision upstream ${response.status}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('vision response is not json');
    return JSON.parse(match[0]) as Extraction;
  }
}