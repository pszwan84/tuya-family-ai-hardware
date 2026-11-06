#ifndef FAH_DOWNLINK_GUARD_H
#define FAH_DOWNLINK_GUARD_H

#include <stdbool.h>

typedef enum {
  FAH_DOWNLINK_UPLOAD_RECEIPT = 0,
  FAH_DOWNLINK_CONFIG = 1,
  FAH_DOWNLINK_STATUS_RESPONSE = 2,
  FAH_DOWNLINK_EVENT = 90,
  FAH_DOWNLINK_SUMMARY = 91,
  FAH_DOWNLINK_FAMILY_NOTICE = 92,
  FAH_DOWNLINK_REACTION = 93,
} fah_downlink_type_t;

bool fah_downlink_allowed(fah_downlink_type_t type);

#endif