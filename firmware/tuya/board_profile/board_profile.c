#include "board_profile.h"

static const fah_board_profile_t profile = {
    .key_pin = 0,
    .led_pin = 1,
    .camera_power_pin = 2,
    .privacy_shutter_pin = 3,
};

const fah_board_profile_t *fah_board_profile(void) { return &profile; }