#ifndef FAH_BOARD_PROFILE_H
#define FAH_BOARD_PROFILE_H

#define FAH_DP_COLLECT_SWITCH 1
#define FAH_DP_CAPTURE_NOW 2
#define FAH_DP_COLLECT_POLICY 3
#define FAH_DP_DEVICE_STATUS 4
#define FAH_DP_FW_VERSION 5
#define FAH_DP_PRIVACY_LED 6

#define FAH_MAX_PHOTO_BYTES (5 * 1024 * 1024)
#define FAH_MAX_QUEUE_ITEMS 200
#define FAH_HEARTBEAT_SEC 30
#define FAH_LOW_STORAGE_MB 512
#define FAH_RESET_HOLD_MS 5000

typedef struct {
  int key_pin;
  int led_pin;
  int camera_power_pin;
  int privacy_shutter_pin;
} fah_board_profile_t;

const fah_board_profile_t *fah_board_profile(void);

#endif