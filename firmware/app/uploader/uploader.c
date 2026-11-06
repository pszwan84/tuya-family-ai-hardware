#include <stdbool.h>
#include <stddef.h>

typedef enum {
  FAH_UPLOAD_OK = 0,
  FAH_UPLOAD_RETRY = 1,
  FAH_UPLOAD_FATAL = 2,
} fah_upload_result_t;

typedef struct {
  const char *device_id;
  const char *device_key;
  const char *base_url;
  unsigned long backoff_ms;
} fah_uploader_t;

fah_upload_result_t fah_upload_token(fah_uploader_t *uploader, char *out_token, size_t out_len);
fah_upload_result_t fah_upload_asset(fah_uploader_t *uploader, const char *token, const void *jpeg, size_t jpeg_size, const char *metadata_json);

void fah_uploader_tick(fah_uploader_t *uploader) {
  if (uploader->backoff_ms < 1000) uploader->backoff_ms = 1000;
  if (uploader->backoff_ms < 30000) uploader->backoff_ms *= 2;
}

void fah_indicator_set_capture(bool active);
void fah_indicator_set_upload(bool active);
void fah_indicator_set_error(bool active);

fah_upload_result_t fah_capture_and_upload(fah_uploader_t *uploader, const void *jpeg, size_t jpeg_size, const char *metadata_json) {
  char token[512] = {0};
  fah_indicator_set_upload(true);

  fah_upload_result_t result = fah_upload_token(uploader, token, sizeof(token));
  if (result == FAH_UPLOAD_OK) {
    result = fah_upload_asset(uploader, token, jpeg, jpeg_size, metadata_json);
  }

  fah_indicator_set_upload(false);
  fah_indicator_set_error(result != FAH_UPLOAD_OK);
  if (result == FAH_UPLOAD_RETRY) fah_uploader_tick(uploader);
  return result;
}