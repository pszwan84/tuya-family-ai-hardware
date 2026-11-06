export const ERROR_CATALOG = {
  OK: { status: 200, retryable: false, message: '成功' },
  ACCEPTED: { status: 202, retryable: false, message: '已受理' },
  INVALID_METADATA: { status: 400, retryable: false, message: '素材元数据不合法' },
  INVALID_RECIPIENT: { status: 400, retryable: false, message: '接收人不合法' },
  TIME_DRIFT_EXCEEDED: { status: 400, retryable: false, message: '采集时间与服务器偏差过大' },
  UNAUTHENTICATED: { status: 401, retryable: false, message: '未登录或登录已过期' },
  DEVICE_CREDENTIAL_MISMATCH: { status: 401, retryable: false, message: '设备凭据不匹配' },
  FORBIDDEN: { status: 403, retryable: false, message: '无权执行该操作' },
  MATERIAL_ACCESS_DENIED: { status: 403, retryable: false, message: '原始素材仅本人可见' },
  NOT_FOUND: { status: 404, retryable: false, message: '资源不存在或不可见' },
  INVALID_STATE_TRANSITION: { status: 409, retryable: false, message: '当前状态不允许该操作' },
  SHARE_CONFLICT: { status: 409, retryable: false, message: '分享请求冲突' },
  NO_RECIPIENT: { status: 409, retryable: false, message: '请至少选择一位接收人' },
  ASSET_CONTENT_CONFLICT: { status: 409, retryable: false, message: '同一素材标识对应了不同内容' },
  RISK_ACK_REQUIRED: { status: 428, retryable: false, message: '该事件包含敏感信息，需要二次确认' },
  RATE_LIMITED: { status: 429, retryable: true, message: '请求过于频繁，请稍后重试' },
  INTERNAL: { status: 500, retryable: true, message: '服务内部错误' },
  UPSTREAM_UNAVAILABLE: { status: 503, retryable: true, message: '上游服务暂不可用' },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export const RETRYABLE_CODES: ErrorCode[] = (Object.keys(ERROR_CATALOG) as ErrorCode[]).filter(
  (code) => ERROR_CATALOG[code].retryable,
);

export function statusOf(code: ErrorCode): number {
  return ERROR_CATALOG[code].status;
}