#include "downlink_guard.h"

bool fah_downlink_allowed(fah_downlink_type_t type) {
  switch (type) {
    case FAH_DOWNLINK_UPLOAD_RECEIPT:
    case FAH_DOWNLINK_CONFIG:
    case FAH_DOWNLINK_STATUS_RESPONSE:
      return true;
    case FAH_DOWNLINK_EVENT:
    case FAH_DOWNLINK_SUMMARY:
    case FAH_DOWNLINK_FAMILY_NOTICE:
    case FAH_DOWNLINK_REACTION:
      return false;
    default:
      return false;
  }
}