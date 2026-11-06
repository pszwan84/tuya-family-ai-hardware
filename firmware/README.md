# 涂鸦固件工程（TuyaOS 应用层）

本目录是基于涂鸦官方 TuyaOS / TuyaOpen 路线的应用层骨架，对应设计文档 T-07 / T-08。

## 官方约束（已核对）

- TuyaOS 分层：TKL / TAL / Libraries / Services / Application，业务代码只写在 Application 层。
- 通过 Tuya Wind IDE（VS Code 插件）创建工程、编译、烧录；或使用 TuyaOpen `tos.py`。
- DP 模型在涂鸦 IoT 平台产品 PID 中冻结，类型定义后不可修改，只能新增。
- 设备只做采集、缓存、上传、状态提示；**永不接收家庭内容**。

## 目录

```
firmware/
├─ tuya/board_profile/board_profile.h   # 板级引脚、DP 编号、上限
├─ app/capture/capture.c                # 按键/定时采集 + 可见指示
├─ app/queue/upload_queue.c             # 断电可恢复的本地队列
├─ app/uploader/uploader.c              # deviceToken + multipart 上传 + 退避
├─ app/dp/dp_policy.c                   # DP 读写与策略校验
└─ app/downlink_guard/downlink_guard.c  # HW-010 下行白名单
```

## G0 门禁（首日必做，见 docs/g0-record.md）

1. 任意 HTTPS 出站并携带自定义头；
2. 连续拍 20 张，单张 ≤5MB、出图 ≤2s；
3. GPIO 按键 / 状态灯 / 提示音可用；
4. 断电重启后本地素材仍在；
5. 涂鸦 App 扫码配网 + 激活，6 个 DP 可读写。

> 当前仓库未包含真实摄像头驱动与 TuyaOS SDK 子模块，G0 结论需在实物板卡上实测后回填 `docs/g0-record.md`。未通过 G0-1 时切换 `ASSET_INGRESS_MODE=cloud_relay`。