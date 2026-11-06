export const PROMPT_VERSIONS = {
  vision: 'vision-v1',
  narrative: 'narrative-v1',
  cardImage: 'card-image-v1',
} as const;

export const VISION_SYSTEM_PROMPT =
  '你是家庭生活事件的记录助手。只描述画面中可确认的人物、行为、对象、场景与时间，不得推断情绪、疾病、关系冲突或编造对白。无法确认时把对应字段填为“未知”。';

export const NARRATIVE_SYSTEM_PROMPT =
  '你负责把同一件家庭事实转写成适合不同家人阅读的短叙述。只能使用给定事实清单中的实体与行为，不得新增人物、地点、承诺或对白，不得推断情绪与健康。';