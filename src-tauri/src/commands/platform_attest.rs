//! Hardware-backed device attestation (Windows TPM EK chain / Apple App Attest).

#[derive(Clone, Debug)]
pub struct PlatformAttestation {
    pub platform: String,
    pub platform_public_key: String,
    pub platform_signature: String,
    pub ek_certificate: String,
    pub attestation_object: String,
    pub key_id: String,
    pub tpm_certify_blob: String,
    pub tpm_public: String,
}

impl PlatformAttestation {
    fn software() -> Self {
        Self {
            platform: "software".into(),
            platform_public_key: String::new(),
            platform_signature: String::new(),
            ek_certificate: String::new(),
            attestation_object: String::new(),
            key_id: String::new(),
            tpm_certify_blob: String::new(),
            tpm_public: String::new(),
        }
    }
}

pub fn attest(payload: &[u8]) -> PlatformAttestation {
    #[cfg(target_os = "windows")]
    {
        if let Ok(att) = windows_tpm::attest(payload) {
            return att;
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(att) = macos_appattest::attest(payload) {
            return att;
        }
    }
    PlatformAttestation::software()
}

#[cfg(target_os = "macos")]
mod macos_appattest {
    use super::PlatformAttestation;
    use std::ffi::CStr;
    use std::os::raw::c_char;

    extern "C" {
        fn nexus_app_attest(
            payload: *const u8,
            payload_len: usize,
            out_attestation_b64: *mut *mut c_char,
            out_key_id: *mut *mut c_char,
        ) -> i32;
        fn nexus_app_attest_free(ptr: *mut c_char);
    }

    pub fn attest(payload: &[u8]) -> Result<PlatformAttestation, String> {
        unsafe {
            let mut attestation = std::ptr::null_mut();
            let mut key_id = std::ptr::null_mut();
            let rc = nexus_app_attest(
                payload.as_ptr(),
                payload.len(),
                &mut attestation,
                &mut key_id,
            );
            if rc != 0 || attestation.is_null() || key_id.is_null() {
                return Err(format!("app attest failed: {rc}"));
            }
            let attestation_object = CStr::from_ptr(attestation).to_string_lossy().into_owned();
            let key = CStr::from_ptr(key_id).to_string_lossy().into_owned();
            nexus_app_attest_free(attestation);
            nexus_app_attest_free(key_id);
            Ok(PlatformAttestation {
                platform: "apple-appattest".into(),
                platform_public_key: String::new(),
                platform_signature: String::new(),
                ek_certificate: String::new(),
                attestation_object,
                key_id: key,
                tpm_certify_blob: String::new(),
                tpm_public: String::new(),
            })
        }
    }
}

#[cfg(target_os = "windows")]
mod windows_tpm {
    use super::PlatformAttestation;
    use sha2::{Digest, Sha256};
    use std::ptr;
    use windows_sys::Win32::Security::Cryptography::{
        NCRYPT_OVERWRITE_KEY_FLAG, NCRYPT_SILENT_FLAG, NCryptCreatePersistedKey, NCryptExportKey,
        NCryptFinalizeKey, NCryptFreeObject, NCryptGetProperty, NCryptOpenKey,
        NCryptOpenStorageProvider, NCryptSignHash,
    };

    const BCRYPT_ECDSA_PUBLIC_P256_MAGIC: u32 = 0x3153_4345; // 'ECS1'
    const KEY_NAME: &str = "NexusToolsDeviceEC256";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    struct Handle(usize);
    impl Drop for Handle {
        fn drop(&mut self) {
            if self.0 != 0 {
                unsafe {
                    NCryptFreeObject(self.0);
                }
            }
        }
    }

    pub fn attest(payload: &[u8]) -> Result<PlatformAttestation, String> {
        unsafe {
            let provider_name = wide("Microsoft Platform Crypto Provider");
            let mut prov: usize = 0;
            if NCryptOpenStorageProvider(&mut prov, provider_name.as_ptr(), 0) != 0 || prov == 0 {
                return Err("tpm provider unavailable".into());
            }
            let prov = Handle(prov);

            let key_name = wide(KEY_NAME);
            let alg = wide("ECDSA_P256");
            let mut key: usize = 0;
            if NCryptOpenKey(prov.0, &mut key, key_name.as_ptr(), 0, NCRYPT_SILENT_FLAG) != 0 || key == 0 {
                if NCryptCreatePersistedKey(
                    prov.0,
                    &mut key,
                    alg.as_ptr(),
                    key_name.as_ptr(),
                    0,
                    NCRYPT_OVERWRITE_KEY_FLAG,
                ) != 0 || key == 0
                {
                    return Err("tpm key create failed".into());
                }
                if NCryptFinalizeKey(key, 0) != 0 {
                    NCryptFreeObject(key);
                    return Err("tpm key finalize failed".into());
                }
            }
            let key = Handle(key);

            // Hash the original payload once; NCryptSignHash ECDSA-signs that digest
            // and the server verifies SHA-256(payload) without hashing a digest again.
            let hash = Sha256::digest(payload);
            let mut sig_len: u32 = 0;
            if NCryptSignHash(
                key.0,
                ptr::null(),
                hash.as_ptr(),
                hash.len() as u32,
                ptr::null_mut(),
                0,
                &mut sig_len,
                0,
            ) != 0 || sig_len == 0
            {
                return Err("tpm sign size failed".into());
            }
            let mut signature = vec![0u8; sig_len as usize];
            if NCryptSignHash(
                key.0,
                ptr::null(),
                hash.as_ptr(),
                hash.len() as u32,
                signature.as_mut_ptr(),
                sig_len,
                &mut sig_len,
                0,
            ) != 0
            {
                return Err("tpm sign failed".into());
            }
            signature.truncate(sig_len as usize);

            let blob_name = wide("ECCPUBLICBLOB");
            let mut pub_len: u32 = 0;
            NCryptExportKey(
                key.0,
                0,
                blob_name.as_ptr(),
                ptr::null(),
                ptr::null_mut(),
                0,
                &mut pub_len,
                0,
            );
            if pub_len < 72 {
                return Err("tpm export size failed".into());
            }
            let mut pub_blob = vec![0u8; pub_len as usize];
            if NCryptExportKey(
                key.0,
                0,
                blob_name.as_ptr(),
                ptr::null(),
                pub_blob.as_mut_ptr(),
                pub_len,
                &mut pub_len,
                0,
            ) != 0 || pub_len < 72
            {
                return Err("tpm export failed".into());
            }
            let magic = u32::from_le_bytes(pub_blob[0..4].try_into().unwrap());
            let cb_key = u32::from_le_bytes(pub_blob[4..8].try_into().unwrap());
            if magic != BCRYPT_ECDSA_PUBLIC_P256_MAGIC || cb_key != 32 {
                return Err("unexpected tpm public blob".into());
            }
            let mut uncompressed = vec![0x04u8];
            uncompressed.extend_from_slice(&pub_blob[8..72]);

            let mut ek = Vec::new();
            for prop in ["PCP_EKCERT", "PCP_EKNVCERT"] {
                let prop_w = wide(prop);
                let mut cert_len: u32 = 0;
                if NCryptGetProperty(prov.0, prop_w.as_ptr(), ptr::null_mut(), 0, &mut cert_len, 0) == 0
                    && cert_len > 64
                {
                    let mut buf = vec![0u8; cert_len as usize];
                    if NCryptGetProperty(
                        prov.0,
                        prop_w.as_ptr(),
                        buf.as_mut_ptr(),
                        cert_len,
                        &mut cert_len,
                        0,
                    ) == 0
                    {
                        buf.truncate(cert_len as usize);
                        ek = buf;
                        break;
                    }
                }
            }
            if ek.is_empty() {
                return Err("tpm ek certificate unavailable".into());
            }

            let mut certify_blob = Vec::new();
            for prop in ["PCP_KEYATTESTATION", "KeyAttestation"] {
                let prop_w = wide(prop);
                let mut len: u32 = 0;
                if NCryptGetProperty(key.0, prop_w.as_ptr(), ptr::null_mut(), 0, &mut len, 0) == 0
                    && len > 24
                {
                    let mut buf = vec![0u8; len as usize];
                    if NCryptGetProperty(key.0, prop_w.as_ptr(), buf.as_mut_ptr(), len, &mut len, 0) == 0
                    {
                        buf.truncate(len as usize);
                        certify_blob = buf;
                        break;
                    }
                }
            }

            let mut tpm_public = Vec::new();
            for blob in ["TPM20PUBLIC", "TPM PUBLIC"] {
                let blob_w = wide(blob);
                let mut len: u32 = 0;
                if NCryptExportKey(
                    key.0,
                    0,
                    blob_w.as_ptr(),
                    ptr::null(),
                    ptr::null_mut(),
                    0,
                    &mut len,
                    0,
                ) == 0
                    && len > 8
                {
                    let mut buf = vec![0u8; len as usize];
                    if NCryptExportKey(
                        key.0,
                        0,
                        blob_w.as_ptr(),
                        ptr::null(),
                        buf.as_mut_ptr(),
                        len,
                        &mut len,
                        0,
                    ) == 0
                    {
                        buf.truncate(len as usize);
                        tpm_public = buf;
                        break;
                    }
                }
            }

            Ok(PlatformAttestation {
                platform: "windows-tpm".into(),
                platform_public_key: hex::encode(uncompressed),
                platform_signature: hex::encode(signature),
                ek_certificate: hex::encode(ek),
                attestation_object: String::new(),
                key_id: String::new(),
                tpm_certify_blob: hex::encode(certify_blob),
                tpm_public: hex::encode(tpm_public),
            })
        }
    }
}
