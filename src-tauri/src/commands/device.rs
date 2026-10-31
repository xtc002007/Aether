use ed25519_dalek::{Signer, SigningKey};
use keyring::Entry;
use rand::rngs::OsRng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::process::Command;

#[derive(Serialize)]
pub struct OsInfo {
    pub hostname: String,
    pub platform: String,
}

#[tauri::command]
pub fn get_os_info() -> OsInfo {
    OsInfo {
        hostname: hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok())
            .unwrap_or_else(|| "unknown".to_string()),
        platform: std::env::consts::OS.to_string(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAttestation {
    pub device_public_key: String,
    pub device_signature: String,
    pub platform: String,
    pub platform_public_key: String,
    pub platform_signature: String,
    pub ek_certificate: String,
    pub attestation_object: String,
    pub key_id: String,
    pub tpm_certify_blob: String,
    pub tpm_public: String,
}

fn device_signing_key() -> Result<SigningKey, String> {
    let entry = Entry::new("com.nexustools.sdk", "nexustools.device-ed25519")
        .map_err(|e| format!("device keyring: {e}"))?;
    if let Ok(stored) = entry.get_password() {
        if let Ok(bytes) = hex::decode(stored) {
            if bytes.len() == 32 {
                let arr: [u8; 32] = bytes.try_into().map_err(|_| "device key length".to_string())?;
                return Ok(SigningKey::from_bytes(&arr));
            }
        }
    }
    let key = SigningKey::generate(&mut OsRng);
    entry
        .set_password(&hex::encode(key.to_bytes()))
        .map_err(|e| format!("device keyring write: {e}"))?;
    Ok(key)
}

#[tauri::command]
pub fn nexus_device_attestation(
    user_id: String,
    device_id: String,
    fingerprint: String,
) -> Result<DeviceAttestation, String> {
    let key = device_signing_key()?;
    let payload = format!(
        "{}|{}|{}",
        user_id.to_lowercase(),
        device_id,
        fingerprint.trim().to_lowercase()
    );
    let sig = key.sign(payload.as_bytes());
    let platform = super::platform_attest::attest(payload.as_bytes());
    Ok(DeviceAttestation {
        device_public_key: hex::encode(key.verifying_key().to_bytes()),
        device_signature: hex::encode(sig.to_bytes()),
        platform: platform.platform,
        platform_public_key: platform.platform_public_key,
        platform_signature: platform.platform_signature,
        ek_certificate: platform.ek_certificate,
        attestation_object: platform.attestation_object,
        key_id: platform.key_id,
        tpm_certify_blob: platform.tpm_certify_blob,
        tpm_public: platform.tpm_public,
    })
}

#[tauri::command]
pub fn get_machine_fingerprint(app_id: String) -> String {
    let raw = format!(
        "{}:{}:{}",
        app_id,
        machine_raw_id(),
        std::env::consts::OS
    );
    let hash = Sha256::digest(raw.as_bytes());
    hex::encode(hash)[..32].to_string()
}

fn machine_raw_id() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Some(guid) = read_windows_machine_guid() {
            return guid;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(uuid) = read_macos_platform_uuid() {
            return uuid;
        }
    }

    fallback_id()
}

fn fallback_id() -> String {
    format!(
        "{}:{}",
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "unknown-host".to_string()),
        std::env::var("USERNAME")
            .or_else(|_| std::env::var("USER"))
            .unwrap_or_else(|_| "unknown-user".to_string())
    )
}

#[cfg(target_os = "windows")]
fn read_windows_machine_guid() -> Option<String> {
    let output = Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .find(|line| line.contains("MachineGuid"))
        .and_then(|line| line.split_whitespace().last())
        .map(|s| s.to_string())
}

#[cfg(target_os = "macos")]
fn read_macos_platform_uuid() -> Option<String> {
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .find(|line| line.contains("IOPlatformUUID"))
        .and_then(|line| line.split('"').nth(3))
        .map(|s| s.to_string())
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
fn read_windows_machine_guid() -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
fn read_macos_platform_uuid() -> Option<String> {
    None
}
