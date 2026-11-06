#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

class ApiClient {
 public:
  ApiClient(const char* baseUrl, const char* deviceId, const char* deviceKey);

  bool ensureToken();
  bool uploadJpeg(const String& path, const String& clientAssetId, const String& capturedAt, const String& trigger, const String& sha256);
  bool pollCommands(JsonDocument& out);
  bool heartbeat(const String& collectState, int queueDepth, int freeMb, const String& fwVersion, int reportedVersion);

 private:
  String baseUrl_;
  String deviceId_;
  String deviceKey_;
  String token_;
  unsigned long tokenExpiresAt_ = 0;

  String hmacHex(const String& payload);
  String sha256File(const String& path);
  String buildMultipart(const String& boundary, const String& metadataJson, const uint8_t* data, size_t size);
};