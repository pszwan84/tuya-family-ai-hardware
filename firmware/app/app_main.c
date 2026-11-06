#include <stdbool.h>
#include "../../tuya/board_profile/board_profile.h"
#include "downlink_guard/downlink_guard.h"

extern void fah_queue_restore(void);
extern void fah_dp_apply_collect_switch(bool enabled);
extern void fah_dp_apply_capture_now(void);
extern void fah_dp_apply_collect_policy(const char *json);
extern void fah_capture_on_key_press(void);
extern unsigned long tal_tick_ms(void);

static unsigned long last_heartbeat_ms = 0;

static void fah_on_downlink(fah_downlink_type_t type, const void *payload) {
  if (!fah_downlink_allowed(type)) {
    return;
  }
  if (type == FAH_DOWNLINK_CONFIG) {
    (void)payload;
  }
}

static void fah_on_dp(int dp_id, const void *value) {
  switch (dp_id) {
    case FAH_DP_COLLECT_SWITCH:
      fah_dp_apply_collect_switch(true);
      break;
    case FAH_DP_CAPTURE_NOW:
      fah_dp_apply_capture_now();
      break;
    case FAH_DP_COLLECT_POLICY:
      fah_dp_apply_collect_policy((const char *)value);
      break;
    default:
      break;
  }
}

void fah_app_main(void) {
  fah_queue_restore();

  while (true) {
    unsigned long now = tal_tick_ms();
    if (now - last_heartbeat_ms >= FAH_HEARTBEAT_SEC * 1000UL) {
      last_heartbeat_ms = now;
      fah_on_downlink(FAH_DOWNLINK_STATUS_RESPONSE, 0);
    }
  }
}