use crate::config::system_default_platforms;
use crate::models::*;
use tauri::State;
use crate::commands::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM app_settings").map_err(|e| e.to_string())?;
    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let mut settings = AppSettings::default();
    for (key, value) in rows {
        match key.as_str() {
            "language" => settings.language = value,
            "theme" => settings.theme = value,
            "global_max_concurrent" => settings.global_max_concurrent = value.parse().unwrap_or(8),
            "default_crawl_depth" => settings.default_crawl_depth = match value.as_str() { "deep" => ResearchMode::Deep, _ => ResearchMode::Quick },
            "auto_backup" => settings.auto_backup = value == "true",
            "save_html" => settings.save_html = value == "true",
            "sqlite_path" => settings.sqlite_path = value,
            "log_level" => settings.log_level = value,
            _ => {}
        }
    }
    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let pairs = vec![
        ("language", settings.language),
        ("theme", settings.theme),
        ("global_max_concurrent", settings.global_max_concurrent.to_string()),
        ("default_crawl_depth", match settings.default_crawl_depth { ResearchMode::Deep => "deep".into(), ResearchMode::Quick => "quick".into() }),
        ("auto_backup", settings.auto_backup.to_string()),
        ("save_html", settings.save_html.to_string()),
        ("sqlite_path", settings.sqlite_path),
        ("log_level", settings.log_level),
    ];
    for (key, value) in pairs {
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)", rusqlite::params![key, value]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_platform_configs(state: State<'_, AppState>) -> Result<Vec<PlatformConfig>, String> {
    let defaults = system_default_platforms();
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT name, config_json FROM platform_configs").map_err(|e| e.to_string())?;
    let overrides: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let mut configs = Vec::new();
    for mut cfg in defaults {
        if let Some((_, json)) = overrides.iter().find(|(n, _)| n == &cfg.name) {
            if let Ok(override_cfg) = serde_json::from_str::<PlatformConfig>(json) {
                cfg = override_cfg;
            }
        }
        configs.push(cfg);
    }
    Ok(configs)
}

#[tauri::command]
pub async fn update_platform_config(state: State<'_, AppState>, config: PlatformConfig) -> Result<(), String> {
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO platform_configs (name, config_json) VALUES (?1, ?2)", rusqlite::params![config.name, json]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_api_key(state: State<'_, AppState>, api_key: String) -> Result<(), String> {
    let key = api_key.trim().to_string();
    {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('deepseek_api_key', ?1)", rusqlite::params![key]).map_err(|e| format!("DB save failed: {}", e))?;
    }
    let app_data = get_app_data_dir();
    std::fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create dir: {}", e))?;
    let env_path = app_data.join(".env");
    let content = format!("DEEPSEEK_API_KEY={}\n", key);
    std::fs::write(&env_path, content).map_err(|e| format!("Failed to write .env: {}", e))?;
    std::env::set_var("DEEPSEEK_API_KEY", &key);
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let result: Result<String, _> = conn.query_row("SELECT value FROM app_settings WHERE key = 'deepseek_api_key'", [], |row| row.get(0));
    match result {
        Ok(key) => Ok(key),
        Err(_) => {
            let app_data = get_app_data_dir();
            let env_path = app_data.join(".env");
            if env_path.exists() {
                let content = std::fs::read_to_string(&env_path).unwrap_or_default();
                for line in content.lines() {
                    if let Some(rest) = line.trim().strip_prefix("DEEPSEEK_API_KEY=") {
                        return Ok(rest.trim().trim_matches('"').to_string());
                    }
                }
            }
            Ok(String::new())
        }
    }
}

// ── Project Platform Overrides ──

#[tauri::command]
pub async fn get_project_platform_overrides(
    state: State<'_, AppState>, project_id: String,
) -> Result<Vec<(String, String)>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT platform_name, override_json FROM project_platform_overrides WHERE project_id = ?1").map_err(|e| e.to_string())?;
    let rows: Vec<(String, String)> = stmt.query_map(rusqlite::params![project_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command]
pub async fn set_project_platform_override(
    state: State<'_, AppState>, project_id: String, platform_name: String, override_json: String,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO project_platform_overrides (project_id, platform_name, override_json) VALUES (?1, ?2, ?3)", rusqlite::params![project_id, platform_name, override_json]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reset_project_platform_override(
    state: State<'_, AppState>, project_id: String, platform_name: String,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_platform_overrides WHERE project_id = ?1 AND platform_name = ?2", rusqlite::params![project_id, platform_name]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn clear_cache(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM search_results", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM raw_documents", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM evaluation_cache", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM reports", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM config_snapshots", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM documents_fts", []).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_app_data_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    { std::env::var("APPDATA").map(|p| std::path::PathBuf::from(p).join("Aether")).unwrap_or_else(|_| std::path::PathBuf::from("./data")) }
    #[cfg(target_os = "macos")]
    { std::env::var("HOME").map(|p| std::path::PathBuf::from(p).join("Library").join("Application Support").join("Aether")).unwrap_or_else(|_| std::path::PathBuf::from("./data")) }
    #[cfg(target_os = "linux")]
    { std::env::var("HOME").map(|p| std::path::PathBuf::from(p).join(".aether")).unwrap_or_else(|_| std::path::PathBuf::from("./data")) }
}
