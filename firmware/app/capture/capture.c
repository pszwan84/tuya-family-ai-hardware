#include <stdbool.h>
#include <stddef.h>
#include "../../tuya/board_profile/board_profile.h"

extern bool fah_capture_paused(void);
extern bool fah_queue_push(const void *item);
extern void fah_indicator_set_capture(bool active);

typedef struct {
  void *jpeg;
  size_t jpeg_size;
  unsigned long captured_at_ms;
} fah_frame_t;

extern int tal_camera_capture(fah_frame_t *frame);

bool fah_capture_once(void) {
  if (fah_capture_paused()) return false;

  fah_indicator_set_capture(true);
  fah_frame_t frame = {0};
  int captured = tal_camera_capture(&frame);
  fah_indicator_set_capture(false);

  if (captured != 0) return false;
  if (frame.jpeg_size == 0 || frame.jpeg_size > FAH_MAX_PHOTO_BYTES) return false;

  return true;
}

void fah_capture_on_key_press(void) { (void)fah_capture_once(); }