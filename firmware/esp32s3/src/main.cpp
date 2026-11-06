#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <SD.h>
#include <WiFi.h>
#include <esp_camera.h>

#include "api_client.h"
#include "config.h"

static ApiClient api(FAH_API_BASE, FAH_DEVICE_ID, FAH_DEVICE_KEY);
static Preferences prefs;
static bool paused = false;
static int intervalSec = FAH_CAPTURE_INTERVAL_SEC;
static unsigned long lastCaptureAt = 0;
static unsigned long lastPollAt = 0;
static unsigned long lastHeartbeatAt = 0;
static int reportedVersion = 0;

static bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = FAH_CAM_PIN_D0;
  config.pin_d1 = FAH_CAM_PIN_D1;
  config.pin_d2 = FAH_CAM_PIN_D2;
  config.pin_d3 = FAH_CAM_PIN_D3;
  config.pin_d4 = FAH_CAM_PIN_D4;
  config.pin_d5 = FAH_CAM_PIN_D5;
  config.pin_d6 = FAH_CAM_PIN_D6;
  config.pin_d7 = FAH_CAM_PIN_D7;
  config.pin_xclk = FAH_CAM_PIN_XCLK;
  config.pin_pclk = FAH_CAM_PIN_PCLK;
  config.pin_vsync = FAH_CAM_PIN_VSYNC;
  config.pin_href = FAH_CAM_PIN_HREF;
  config.pin_sccb_sda = FAH_CAM_PIN_SIOD;
  config.pin_sccb_scl = FAH_CAM_PIN_SIOC;
  config.pin_pwdn = FAH_CAM_PIN_PWDN;
  config.pin_reset = FAH_CAM_PIN_RESET;
  config.xclk_freq_hz = FAH_CAM_XCLK_HZ;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  return esp_camera_init(&config) == ESP_OK;
}

static String isoNow() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 100)) return String("1970-01-01T00:00:00Z");
  char buffer[32];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

static void led(bool on) {
  digitalWrite(FAH_PRIVACY_LED_PIN, on ? HIGH : LOW);
}

static bool captureToSd(String& path, String& assetId) {
  if (paused) return false;
  led(true);
  camera_fb_t* frame = esp_camera_fb_get();
  if (frame == nullptr) {
    led(false);
    return false;
  }

  assetId = String("cap_") + String(millis());
  path = String(FAH_QUEUE_DIR) + "/" + assetId + ".jpg";
  File file = SD.open(path, FILE_WRITE);
  if (!file) {
    esp_camera_fb_return(frame);
    led(false);
    return false;
  }
  file.write(frame->buf, frame->len);
  file.close();
  esp_camera_fb_return(frame);
  led(false);
  return true;
}

static void uploadQueue() {
  File dir = SD.open(FAH_QUEUE_DIR);
  if (!dir) return;
  File entry = dir.openNextFile();
  while (entry) {
    String path = String(FAH_QUEUE_DIR) + "/" + entry.name();
    String clientAssetId = String(entry.name());
    clientAssetId.replace(".jpg", "");
    entry.close();

    String payload = path;
    File file = SD.open(payload, FILE_READ);
    if (!file) break;
    file.close();

    String sha = api.sha256File(payload);
    String capturedAt = isoNow();
    if (api.uploadJpeg(payload, clientAssetId, capturedAt, "scheduled", sha)) {
      SD.remove(payload);
    } else {
      break;
    }
    entry = dir.openNextFile();
  }
  dir.close();
}

static void handleCommand(JsonDocument& doc) {
  JsonArray commands = doc["data"]["commands"].as<JsonArray>();
  for (JsonObject command : commands) {
    String type = String(command["type"].as<const char*>());
    if (type == "capture_now") {
      String path;
      String assetId;
      if (captureToSd(path, assetId)) uploadQueue();
    } else if (type == "set_switch") {
      bool enabled = command["payload"]["collectState"] == "enabled";
      paused = !enabled;
      prefs.putBool("paused", paused);
    } else if (type == "set_capture_params") {
      intervalSec = command["payload"]["intervalSec"] | intervalSec;
      prefs.putInt("interval", intervalSec);
    } else if (type == "resync") {
      uploadQueue();
    }
    reportedVersion = command["version"] | reportedVersion;
  }
}

static void poll() {
  JsonDocument doc;
  if (api.pollCommands(doc)) handleCommand(doc);
}

void setup() {
  Serial.begin(115200);
  pinMode(FAH_PRIVACY_LED_PIN, OUTPUT);
  led(false);

  prefs.begin("fah", false);
  paused = prefs.getBool("paused", false);
  intervalSec = prefs.getInt("interval", FAH_CAPTURE_INTERVAL_SEC);

  WiFi.begin(FAH_WIFI_SSID, FAH_WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  configTime(0, 0, "ntp.aliyun.com", "pool.ntp.org");
  SD.begin(FAH_SD_CS_PIN);
  SD.mkdir(FAH_QUEUE_DIR);

  if (!initCamera()) {
    Serial.println("camera init failed");
  }
  lastPollAt = millis() - FAH_COMMAND_POLL_SEC * 1000UL;
}

void loop() {
  unsigned long now = millis();

  if (now - lastPollAt >= FAH_COMMAND_POLL_SEC * 1000UL) {
    lastPollAt = now;
    poll();
    uploadQueue();
  }

  if (!paused && now - lastCaptureAt >= intervalSec * 1000UL) {
    lastCaptureAt = now;
    String path;
    String assetId;
    if (captureToSd(path, assetId)) uploadQueue();
  }

  if (now - lastHeartbeatAt >= FAH_HEARTBEAT_SEC * 1000UL) {
    lastHeartbeatAt = now;
    File dir = SD.open(FAH_QUEUE_DIR);
    int depth = 0;
    if (dir) {
      File entry = dir.openNextFile();
      while (entry) {
        depth++;
        entry.close();
        entry = dir.openNextFile();
      }
      dir.close();
    }
    api.heartbeat(paused ? "paused" : "enabled", depth, 0, "esp32s3-ref-1.0", reportedVersion);
  }

  delay(200);
}