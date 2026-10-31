#ifndef NEXUS_APP_ATTEST_H
#define NEXUS_APP_ATTEST_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

int nexus_app_attest(
    const uint8_t *payload,
    size_t payload_len,
    char **out_attestation_b64,
    char **out_key_id
);

void nexus_app_attest_free(char *ptr);

#ifdef __cplusplus
}
#endif

#endif
