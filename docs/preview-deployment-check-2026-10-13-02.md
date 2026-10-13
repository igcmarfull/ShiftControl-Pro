# Chief area login preview validation

The isolated ISLA/TIENDA login path was fixed in `82546e12` and verified with updated regression tests in `5767c5f`.

This commit requests a Git-triggered preview build. Do not merge to main until browser verification is complete. Production app_state and area_state must remain untouched.
