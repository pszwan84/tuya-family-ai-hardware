#include <stdbool.h>
#include "../../tuya/board_profile/board_profile.h"
#include <stddef.h>

typedef struct {
  char client_asset_id[64];
  char captured_start_at[32];
  char captured_end_at[32];
  char sha256[65];
  char fw_version[32];
  unsigned int size_bytes;
  bool uploaded;
} fah_queue_item_t;

static fah_queue_item_t queue[FAH_MAX_QUEUE_ITEMS];
static size_t queue_count = 0;
static bool paused = false;

void fah_queue_restore(void);
void fah_queue_persist(void);

bool fah_capture_paused(void) { return paused; }

void fah_capture_set_paused(bool value) {
  paused = value;
  fah_queue_persist();
}

bool fah_capture_should_capture(unsigned long now_ms, unsigned long min_interval_ms, unsigned int daily_count, unsigned int daily_limit) {
  if (paused) return false;
  if (daily_count >= daily_limit) return false;
  return now_ms >= min_interval_ms;
}

bool fah_queue_push(const fah_queue_item_t *item) {
  if (queue_count >= FAH_MAX_QUEUE_ITEMS) return false;
  queue[queue_count++] = *item;
  fah_queue_persist();
  return true;
}

size_t fah_queue_depth(void) { return queue_count; }

const fah_queue_item_t *fah_queue_next_pending(void) {
  for (size_t index = 0; index < queue_count; index += 1) {
    if (!queue[index].uploaded) return &queue[index];
  }
  return NULL;
}

void fah_queue_mark_uploaded(const char *client_asset_id) {
  if (client_asset_id == NULL) return;
  for (size_t index = 0; index < queue_count; index += 1) {
    const char *left = queue[index].client_asset_id;
    const char *right = client_asset_id;
    while (*left != '\0' && *left == *right) {
      left += 1;
      right += 1;
    }
    if (*left == '\0' && *right == '\0') {
      queue[index].uploaded = true;
      fah_queue_persist();
      return;
    }
  }
}