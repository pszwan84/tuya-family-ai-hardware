# 念念 · KinRing / 家事

把家人的日常，整理成彼此看得懂、愿意看的小事件。当前仓库是黑客松 P0 闭环的可运行实现：

```
ESP32-S3-CAM 采集 → 自建服务受理 → 去重/聚类 → 事件提取 → 模板事件卡
→ 双角色叙述 → 本人确认分享 → 家人 Web 查看 → 个人/家庭时间线
```

> 现场资料显示实物为 ESP32-S3-CAM，决策与差异见 `docs/adr-001-esp32s3-field-alignment.md`。
> 涂鸦 TuyaOS 固件骨架保留为历史方案。

## 1. 快速开始

前置：Node 22+、Docker、npm。

```bash
npm install
docker compose -f infra/docker-compose.yml up -d postgres redis
npx prisma db push

npm run build
node apps/api/dist/main.js        # 终端 A，监听 3001
node node_modules/next/dist/bin/next start apps/web -p 3000   # 终端 B
npm run demo:seed
npm run demo:verify
```

打开 http://localhost:3000 ，用演示身份进入（密码统一 `demo1234`）：

| 账号 | 身份 | 说明 |
|---|---|---|
| gp01 | 奶奶（祖辈） | 查看家人分享的内容 |
| mid01 | 妈妈（中间一代） | 采集设备所有者，可分享、可协助配置 |
| kid01 | 小满（子女） | 未成年人，分享需中间一代确认 |

## 2. 目录

```
apps/api        NestJS HTTP 边界（上传受理、事件、分享、时间线、设备、管理）
apps/worker     BullMQ 消费者（Redis 模式；默认 inline 由 API 直接处理）
apps/web        Next.js App Router（Me / Family）
packages/contracts   zod 契约：信封、错误码、设备、素材、事件、分享
packages/domain      纯规则：权限、状态机、风险、价值分、叙述模板、时间线游标
packages/ai          VLM/图像 Provider（mock 默认，可切 OpenAI 兼容 / 通义万相）
packages/pipeline    素材→事件→卡片流水线（API 与 worker 共用）
firmware/esp32s3     ESP32-S3-CAM 参考固件（PlatformIO，未编译）
firmware            TuyaOS 历史骨架
infra            Compose、演示脚本、Mock 设备、照片导入
docs            ADR、G0 记录、DP 模型、3 分钟/8 分钟演示脚本、红线清单、交付说明
```

## 3. 已验证内容

- `npm run demo:verify`：16/16 通过（伪造签名 401、上传 202、幂等 exists、内容冲突 409、事件产出、双角色预览、分享 2s 可见、越权 403、撤回消失、个人时间线保留、设备状态）。
- Redis + BullMQ 模式：worker 消费 `asset.ingest`，同一套 16 项断言通过。
- 单元测试：`packages/domain` 18 项、`packages/ai` 4 项。
- Web `next build` 成功，`/login` 与 `/me/drafts` 返回 200。
- 性能（8 次上传）：上传 P95 66ms、事件产出 P95 295ms、卡片图 P95 3ms、Web 首屏 115ms。
- 保留期清理：过期素材对象删除、`deletedAt` 写入；断网剧本 3 次退避后恢复上传。

```bash
npx tsx infra/scripts/measure.ts     # 性能测量
npx tsx infra/scripts/mock-device.ts offline
npx tsx infra/scripts/mock-device.ts duplicate
npx tsx infra/scripts/import-photos.ts <照片目录>   # 现场照片批量导入
```

### Redis 异步模式（可选）

```bash
env REDIS_URL=redis://localhost:6380 node apps/worker/dist/index.js
env QUEUE_FALLBACK=redis REDIS_URL=redis://localhost:6380 node apps/api/dist/main.js
```

## 4. 默认配置与降级

| 开关 | 默认 | 说明 |
|---|---|---|
| `AI_MODE` | `mock` | 离线可演示；设 `live` + `AI_VLM_API_KEY` 走真实 VLM |
| `CARD_MODE` | `template` | 先出模板卡，AI 插画成功后再升级 |
| `QUEUE_FALLBACK` | `inline` | 无 Redis 也能跑；配 `REDIS_URL` 后改 `redis` |
| `ASSET_INGRESS_MODE` | `direct` | 设备直传自建服务；G0-1 不通过时切 `cloud_relay` |

### 容器化（可选）

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

包含 postgres、redis、api、worker、web 五个服务；共享 `fah-storage` 卷。

## 5. 已知限制

见 `docs/handover.md`。固件需在实物板卡上完成 G0 实测后回填 `docs/g0-record.md`。