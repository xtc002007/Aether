#import "app_attest.h"
#import <DeviceCheck/DeviceCheck.h>
#import <Foundation/Foundation.h>
#import <CommonCrypto/CommonDigest.h>

static char *nexus_dup_nsstring(NSString *value) {
    if (!value) return NULL;
    const char *utf8 = value.UTF8String;
    if (!utf8) return NULL;
    return strdup(utf8);
}

void nexus_app_attest_free(char *ptr) {
    free(ptr);
}

int nexus_app_attest(
    const uint8_t *payload,
    size_t payload_len,
    char **out_attestation_b64,
    char **out_key_id
) {
    if (!payload || payload_len == 0 || !out_attestation_b64 || !out_key_id) return -1;
    *out_attestation_b64 = NULL;
    *out_key_id = NULL;

    if (@available(macOS 11.0, *)) {
        DCAppAttestService *service = [DCAppAttestService sharedService];
        if (!service.isSupported) return -2;

        dispatch_semaphore_t generated = dispatch_semaphore_create(0);
        __block NSString *keyId = nil;
        __block NSError *error = nil;
        [service generateKeyWithCompletionHandler:^(NSString * _Nullable generatedKeyId, NSError * _Nullable generateError) {
            keyId = generatedKeyId;
            error = generateError;
            dispatch_semaphore_signal(generated);
        }];
        if (dispatch_semaphore_wait(generated, dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_SEC)) != 0) {
            return -3;
        }
        if (error || keyId.length == 0) return -4;

        uint8_t digest[CC_SHA256_DIGEST_LENGTH];
        CC_SHA256(payload, (CC_LONG)payload_len, digest);
        NSData *clientDataHash = [NSData dataWithBytes:digest length:CC_SHA256_DIGEST_LENGTH];

        dispatch_semaphore_t attested = dispatch_semaphore_create(0);
        __block NSData *attestation = nil;
        [service attestKey:keyId
            clientDataHash:clientDataHash
         completionHandler:^(NSData * _Nullable object, NSError * _Nullable attestError) {
            attestation = object;
            error = attestError;
            dispatch_semaphore_signal(attested);
        }];
        if (dispatch_semaphore_wait(attested, dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_SEC)) != 0) {
            return -5;
        }
        if (error || attestation.length == 0) return -6;

        NSString *b64 = [attestation base64EncodedStringWithOptions:0];
        *out_attestation_b64 = nexus_dup_nsstring(b64);
        *out_key_id = nexus_dup_nsstring(keyId);
        if (!*out_attestation_b64 || !*out_key_id) {
            nexus_app_attest_free(*out_attestation_b64);
            nexus_app_attest_free(*out_key_id);
            *out_attestation_b64 = NULL;
            *out_key_id = NULL;
            return -7;
        }
        return 0;
    }

    return -8;
}
