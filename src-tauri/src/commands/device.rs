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
