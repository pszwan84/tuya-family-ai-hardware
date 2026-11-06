# ESP32-S3-CAM 参考固件

对应现场实物：ESP32-S3-CAM N16R8 / Seeed XIAO ESP32S3 Sense，VGA、画质 12、SD 卡队列、10 秒命令轮询。

## 已对齐的现场行为

| 现场固件行为 | 本参考实现 |
|---|---|
| 远程拍一张 | `capture_now` 命令 → 拍照入 SD 队列 |
| 暂停 / 恢复 | `set_switch` → Preferences 持久化，重启保持 |
| 定时间隔 | `set_capture_params.intervalSec` |
| 每 10 秒轮询 | `FAH_COMMAND_POLL_SEC` |
| SD 待补传 | `FAH_QUEUE_DIR` 扫描并逐张补传 |
| 立即补传 | `resync` 命令 |
| 指示灯可见采集 | `FAH_PRIVACY_LED_PIN` 拍照时点亮 |
| 心跳 | 30 秒上报队列深度、状态、版本 |

## 使用前必须核对

`src/config.h` 的引脚、Wi-Fi、API 地址、`deviceId`、`deviceKey` 必须按实物核对。不同 ESP32-S3-CAM 板型的 D0-D7/PCLK 引脚不同，**未核对不得烧录**。

## 构建

本机未安装 ESP32 工具链，未编译验证。需在装有 PlatformIO 的机器执行：

```bash
cd firmware/esp32s3
pio run
pio run -t upload
pio device monitor
```

## G0 等价检查（上板后回填 docs/g0-record.md）

1. HTTPS/HTTP 出站与自定义头；
2. VGA 单张体积 ≤5MB、拍照 ≤2s；
3. SD 断电重启队列保留；
4. 按键/指示灯；
5. 10 秒内命令生效；
6. 断网后 60 秒内按序补传。

## 已知限制

- 未实现深度睡眠与太阳能功耗管理；现场若电池受限，需在 `loop()` 增加 light sleep。
- multipart 在内存中拼装，依赖 8MB PSRAM；超过 5MB 的帧会被拒绝。
- 未做 HTTPS 证书校验；演示网络若走公网 TLS，需改用 `WiFiClientSecure`。