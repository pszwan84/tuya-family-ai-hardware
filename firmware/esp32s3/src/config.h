#pragma once

#define FAH_WIFI_SSID "replace-me"
#define FAH_WIFI_PASSWORD "replace-me"

#define FAH_API_BASE "http://192.168.1.10:3001/api/v1"
#define FAH_DEVICE_ID "replace-with-device-id"
#define FAH_DEVICE_KEY "replace-with-device-key"

#define FAH_CAPTURE_INTERVAL_SEC 60
#define FAH_COMMAND_POLL_SEC 10
#define FAH_HEARTBEAT_SEC 30
#define FAH_MAX_UPLOAD_BYTES (5 * 1024 * 1024)
#define FAH_QUEUE_DIR "/fah/queue"

#define FAH_PRIVACY_LED_PIN 48
#define FAH_SD_CS_PIN 10
#define FAH_SD_MOSI_PIN 11
#define FAH_SD_MISO_PIN 13
#define FAH_SD_SCLK_PIN 12

#define FAH_CAM_PIN_PWDN -1
#define FAH_CAM_PIN_RESET -1
#define FAH_CAM_PIN_XCLK 15
#define FAH_CAM_PIN_SIOD 4
#define FAH_CAM_PIN_SIOC 5
#define FAH_CAM_PIN_D7 16
#define FAH_CAM_PIN_D6 17
#define FAH_CAM_PIN_D5 18
#define FAH_CAM_PIN_D4 12
#define FAH_CAM_PIN_D3 10
#define FAH_CAM_PIN_D2 8
#define FAH_CAM_PIN_D1 9
#define FAH_CAM_PIN_D0 11
#define FAH_CAM_PIN_VSYNC 6
#define FAH_CAM_PIN_HREF 7
#define FAH_CAM_PIN_PCLK 13

#define FAH_CAM_XCLK_HZ 20000000