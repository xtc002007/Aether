use crate::llm::platform::{set_platform_auth, PlatformAuth};
use tauri::State;
use crate::commands::AppState;

#[tauri::command]
pub async fn sync_platform_auth(
    _state: State<'_, AppState>,
    api_url: String,
    jwt: String,
    app_id: String,
    device_id: String,
) -> Result<(), String> {
    if jwt.trim().is_empty() {
        set_platform_auth(None);
        return Ok(());
    }
    set_platform_auth(Some(PlatformAuth {
        api_url,
        jwt,
        app_id,
        device_id,
    }));
    Ok(())
}

#[tauri::command]
pub async fn clear_platform_auth(_state: State<'_, AppState>) -> Result<(), String> {
    set_platform_auth(None);
    Ok(())
}
