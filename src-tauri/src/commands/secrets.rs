use keyring::Entry;

fn allowed(service: &str) -> bool {
    matches!(service, "com.aether.app" | "com.nexustools.sdk")
}

#[tauri::command]
pub fn secrets_get(service: String, account: String) -> Option<String> {
    if !allowed(&service) {
        return None;
    }
    Entry::new(&service, &account)
        .ok()?
        .get_password()
        .ok()
        .filter(|value| !value.is_empty())
}

#[tauri::command]
pub fn secrets_set(service: String, account: String, password: String) -> Result<(), String> {
    if !allowed(&service) {
        return Err(format!("unsupported secrets service: {service}"));
    }
    Entry::new(&service, &account)
        .map_err(|e| e.to_string())?
        .set_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secrets_delete(service: String, account: String) -> Result<(), String> {
    if !allowed(&service) {
        return Err(format!("unsupported secrets service: {service}"));
    }
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(_) => Ok(()),
    }
}
