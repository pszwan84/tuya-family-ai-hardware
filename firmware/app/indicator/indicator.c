#include <stdbool.h>

extern void tal_gpio_write(int pin, int level);

static bool led_on = false;

void fah_indicator_set_capture(bool active) {
  led_on = active;
  tal_gpio_write(1, active ? 1 : 0);
}

void fah_indicator_set_upload(bool active) {
  if (active) {
    led_on = !led_on;
    tal_gpio_write(1, led_on ? 1 : 0);
  }
}

void fah_indicator_set_error(bool active) {
  if (active) tal_gpio_write(1, 1);
}