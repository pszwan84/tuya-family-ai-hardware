#include "api_client.h"

#include <HTTPClient.h>
#include <SD_MMC.h>
#include <WiFiClient.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>

#include "config.h"

static String hex(const uint8_t* data, size_t len) {
  static const char* digits = "0123456789abcdef";
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    out += digits[data[i] >> 4];
    out += digits[data[i] & 0x0f];
  }
  return out;
}

ApiClient::ApiClient(const char* baseUrl, const char* deviceId, const char* deviceKey)
    : baseUrl_(baseUrl), deviceId_(deviceId), deviceKey_(deviceKey) {}

String ApiClient::hmacHex(const String& payload) {
  uint8_t digest[32];
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, info, 1);
  mbedtls_md_hmac_starts(&ctx, reinterpret_cast<const uint8_t*>(deviceKey_.c_str()), deviceKey_.length());
  mbedtls_md_hmac_update(&ctx, reinterpret_cast<const uint8_t*>(payload.c_str()), payload.length());
  mbedtls_md_hmac_finish(&ctx, digest);
  mbedtls_md_free(&ctx);
  return hex(digest, sizeof(digest));
}

String ApiClient::sha256File(const String& path) {
  File file = SD_MMC.open(path, FILE_READ);
  if (!file) return String();
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);
  uint8_t buffer[1024];
  while (file.available()) {
    size_t read = file.read(buffer, sizeof(buffer));
    mbedtls_sha256_update(&ctx, buffer, read);
  }
  uint8_t digest[32];
  mbedtls_sha256_finish(&ctx, digest);
  mbedtls_sha256_free(&ctx);
  file.close();
  return hex(digest, sizeof(digest));
}

bool ApiClient::ensureToken() {
  if (token_.length() > 0 && millis() < tokenExpiresAt_) return true;

  String timestamp = String(millis() / 1000);
  String nonce = String(random(0x7fffffff));
  String payload = "POST/api/v1/devices/" + deviceId_ + "/token" + timestamp + nonce;
  String signature = hmacHex(payload);

  HTTPClient http;
  http.begin(baseUrl_ + "/devices/" + deviceId_ + "/token");
  http.addHeader("X-Timestamp", timestamp);
  http.addHeader("X-Nonce", nonce);
  http.addHeader("X-Signature", signature);
  int status = http.POST("");
  if (status != 200) {
    http.end();
    return false;
  }

  JsonDocument doc;
  deserializeJson(doc, http.getString());
  token_ = String(doc["data"]["accessToken"].as<const char*>());
  tokenExpiresAt_ = millis() + 840000UL;
  http.end();
  return token_.length() > 0;
}

String ApiClient::buildMultipart(const String& boundary, const String& metadataJson, const uint8_t* data, size_t size) {
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"metadata\"\r\n\r\n";
  head += metadataJson + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  String payload;
  payload.reserve(head.length() + size + tail.length());
  payload += head;
  payload.concat(reinterpret_cast<const char*>(data), size);
  payload += tail;
  return payload;
}

bool ApiClient::uploadJpeg(const String& path, const String& clientAssetId, const String& capturedAt, const String& trigger, const String& sha256) {
  if (!ensureToken()) return false;

  File file = SD_MMC.open(path, FILE_READ);
  if (!file) return false;
  size_t size = file.size();
  if (size == 0 || size > FAH_MAX_UPLOAD_BYTES) {
    file.close();
    return false;
  }
  uint8_t* data = static_cast<uint8_t*>(ps_malloc(size));
  if (data == nullptr) {
    file.close();
    return false;
  }
  file.read(data, size);
  file.close();

  JsonDocument meta;
  meta["clientAssetId"] = clientAssetId;
  meta["assetType"] = "photo";
  meta["capturedStartAt"] = capturedAt;
  meta["capturedEndAt"] = capturedAt;
  meta["trigger"] = trigger;
  meta["sha256"] = sha256;
  meta["fwVersion"] = "esp32s3-ref-1.0";
  meta["qualityFlags"] = JsonArray();
  String metadataJson;
  serializeJson(meta, metadataJson);

  String boundary = "----fah" + String(millis());
  String payload = buildMultipart(boundary, metadataJson, data, size);
  free(data);

  HTTPClient http;
  http.begin(baseUrl_ + "/devices/" + deviceId_ + "/assets");
  http.addHeader("Authorization", "Bearer " + token_);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("Idempotency-Key", deviceId_ + ":" + clientAssetId);
  int status = http.POST(reinterpret_cast<uint8_t*>(payload.begin()), payload.length());
  http.end();

  return status == 200 || status == 202;
}

bool ApiClient::pollCommands(JsonDocument& out) {
  if (!ensureToken()) return false;
  HTTPClient http;
  http.begin(baseUrl_ + "/devices/" + deviceId_ + "/commands");
  http.addHeader("Authorization", "Bearer " + token_);
  int status = http.GET();
  if (status != 200) {
    http.end();
    return false;
  }
  deserializeJson(out, http.getString());
  http.end();
  return true;
}

bool ApiClient::heartbeat(const String& collectState, int queueDepth, int freeMb, const String& fwVersion, int reportedVersion) {
  if (!ensureToken()) return false;
  JsonDocument body;
  body["fwVersion"] = fwVersion;
  body["collectState"] = collectState;
  body["queueDepth"] = queueDepth;
  body["freeMB"] = freeMb;
  body["reportedVersion"] = reportedVersion;
  body["privacyLed"] = "off";
  String payload;
  serializeJson(body, payload);

  HTTPClient http;
  http.begin(baseUrl_ + "/devices/" + deviceId_ + "/heartbeat");
  http.addHeader("Authorization", "Bearer " + token_);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(payload);
  http.end();
  return status == 200;
}