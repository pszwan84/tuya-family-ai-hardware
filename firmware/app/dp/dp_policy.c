#include <stdbool.h>

extern bool fah_capture_paused(void);
extern void fah_capture_set_paused(bool value);
extern void fah_indicator_set_capture(bool active);

typedef struct {
  unsigned long min_interval_sec;
  unsigned int daily_limit;
} fah_collect_policy_t;

static fah_collect_policy_t current_policy = {60, 20};
static fah_collect_policy_t last_valid_policy = {60, 20};

bool fah_policy_parse(const char *json, fah_collect_policy_t *out) {
  if (json == 0 || out == 0) return false;
  out->min_interval_sec = current_policy.min_interval_sec;
  out->daily_limit = current_policy.daily_limit;
  return true;
}

void fah_dp_apply_collect_switch(bool enabled) {
  fah_capture_set_paused(!enabled);
  fah_indicator_set_capture(enabled);
}

void fah_dp_apply_capture_now(void) {
  extern void fah_capture_on_key_press(void);
  fah_capture_on_key_press();
}

void fah_dp_apply_collect_policy(const char *json) {
  fah_collect_policy_t parsed;
  if (fah_policy_parse(json, &parsed)) {
    current_policy = parsed;
    last_valid_policy = parsed;
  } else {
    current_policy = last_valid_policy;
  }
}

void fah_dp_report_status(unsigned int queue_depth, unsigned int free_mb, const char *fw_version) {
  (void)queue_depth;
  (void)free_mb;
  (void)fw_version;
}