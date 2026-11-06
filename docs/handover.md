# 交付说明与已知限制

## 已实现（可运行、已验证）

- 设备 HMAC 换令牌、multipart 素材上传、幂等、内容冲突、时间漂移校验；
- 质检（黑帧/模糊标记）、dHash 近似去重、采集会话聚类；
- VLM Provider（mock / OpenAI 兼容）、Schema 校验、事实守卫、风险规则、分享价值分；
- 模板 SVG 事件卡（含 AI 标注）、文字卡兜底路径；
- 双角色（祖辈 / 中间一代 / 子女）叙述与 EventView 隔离；
- 分享预览、确认、撤回、幂等键、高风险二次确认；
- 个人时间线、家庭事件流、成员筛选、近七天变化、设备状态与远程暂停、设置、提示聚合、审计、指标；
- 保留期清理（worker 每小时 + `POST /admin/demo/cleanup` 手动触发，实测删除对象并写 `deletedAt`）；
- 安静时间与提示频率按接收者设置生效；
- Web Me / Family 页面，移动端可用；时间线按今天/昨天/近七天/更早分组；
- `demo:seed / reset / verify`、`measure`、`mock:device` 四种剧本；
- 单元测试 22 项、E2E 冒烟 16 项；Redis + BullMQ 模式已联调；
- Dockerfile 与 api/worker/web 编排（`docker compose config` 校验通过）。

## 与设计文档的偏差（有意为之）

| 项 | 设计 | 当前实现 | 原因 |
|---|---|---|---|
| 包管理 | pnpm workspace | npm workspaces | 本机 pnpm 安装持续 `EPERM`（Windows 重命名受限），npm 可完成安装；包结构未变 |
| 对象存储 | MinIO 私有桶 + 预签名 | 本地私有目录 + HMAC 签名 URL（`/assets/content?exp&sig`） | 减少现场依赖；接口仍为 `presign`，可替换回 MinIO |
| 队列 | BullMQ + Redis | 默认 inline，`REDIS_URL` + `QUEUE_FALLBACK=redis` 时走 BullMQ worker | 演示兜底；两种路径共用 `packages/pipeline` |
| 家族隔离 | Prisma 扩展自动注入 familyId | `scopedWhere` 辅助 + 每个服务显式校验 familyId | Prisma 扩展对关系查询注入风险高；当前实现仍在所有读写前校验 |
| AI | Qwen-VL 实调 | 默认 mock 确定性输出 | 无密钥/网络也能演示；设 `AI_MODE=live` 即切换 |
| 卡片图像 | 万相生成 + 版本替换 | 模板卡（SVG）固定；图像 Provider 为空实现 | 生成不稳定，模板卡更适合现场；接口已预留 |

## 未完成 / 阻塞

1. **固件未编译、未上板**：`firmware/` 为应用层骨架，摄像头驱动与 TuyaOS SDK 未接入；G0-1～G0-5 待实物实测（`docs/g0-record.md`）。
2. **AI 实调未验证**：无 `AI_VLM_API_KEY`，live 路径仅代码完成。
3. **BullMQ worker 已联调**：Redis 模式 16/16 通过；默认仍为 inline，现场无 Redis 也可演示。
4. **对象存储未切 MinIO**：本地签名 URL 可用，MinIO 适配器未写。
5. **Docker 镜像未实际构建**：编排文件已校验，构建与镜像回归待执行。
6. **P1 项未做**：日/周/月摘要、多格漫画、自动分享授权、回顾页；保留期清理已做，安静时间已做。

## 现场网络预案

- 首选：局域网 + 公网 TLS（Caddy），设备直传；
- 次选：内网 HTTP（仅在演示环境，风险已知）；
- 兜底：`ASSET_INGRESS_MODE=cloud_relay` 或 `mock:device -- happy` 重放，**不得替代 E2E-001 真机采集**；
- AI 不可用：`CARD_MODE=template` 保持全链路可演示。

## 交付清单

- 本仓库源码与构建产物；
- `.env.example`（不含真实密钥）；
- 本文档、`docs/demo-script.md`、`docs/redline-checklist.md`、`docs/dp-model.md`、`docs/g0-record.md`。