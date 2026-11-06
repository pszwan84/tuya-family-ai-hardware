# 涂鸦 DP 模型（产品 PID 冻结）

> 状态：历史参考。现场硬件已切换为 ESP32-S3-CAM，设备控制改走 REST 命令
> （`GET/POST /api/v1/devices/{id}/commands`，10 秒轮询），DP 仅保留给涂鸦路线。
> 决策见 `docs/adr-001-esp32s3-field-alignment.md`。

> 依据：TuyaOS 统一 DP 模型。**DP 类型定义后不可修改，只能新增**；调参走 raw JSON 字段。

| DP | 标识 | 类型 | 方向 | 语义 | 需求 |
|---|---|---|---|---|---|
| 1 | `collect_switch` | bool | 下发 + 上报 | 采集开启 / 暂停，持久化，重启保持 | HW-008、PRIV-003 |
| 2 | `capture_now` | bool（脉冲） | 下发 | 立即采集一次，失败回执原因 | HW-003、ME-006 |
| 3 | `collect_policy` | string(raw JSON) | 下发 + 上报 | `{minIntervalSec,dailyLimit,windows[]}` | HW-004、HW-011 |
| 4 | `device_status` | string(raw JSON) | 上报 | `{state,queueDepth,freeMB,lastUpload}` | HW-005、ME-005 |
| 5 | `fw_version` | string | 上报 | 固件与协议版本 | NFR-COMP-003 |
| 6 | `privacy_led` | enum | 上报 | `off/breathing/on/error` | HW-005、HW-009 |

## collect_policy Schema

```json
{
  "minIntervalSec": 60,
  "dailyLimit": 20,
  "windows": [{ "start": "08:00", "end": "21:00" }]
}
```

服务端下发前用 zod 校验；设备侧校验失败回退到上一次有效配置。

## 变更流程

1. 新增 DP 只允许追加，不复用旧编号；
2. 同步更新 `packages/contracts/src/device.ts` 与 `firmware/tuya/board_profile/board_profile.h`；
3. 记录到本文件并在 `docs/handover.md` 标注固件版本兼容范围。