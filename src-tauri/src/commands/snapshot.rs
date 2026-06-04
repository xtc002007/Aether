use crate::db::Database;
use crate::models::*;
use tauri::State;
use crate::commands::AppState;

/// Internal helper — creates and persists a snapshot. Used across command modules.
pub fn save_snapshot(
    db: &Database, project: &ResearchProject,
    stage: &str, label: &str, description: &str,
    snapshot_type: SnapshotType,
) -> Result<ProjectSnapshot, String> {
    let json = serde_json::to_string(project).map_err(|e| e.to_string())?;
    let latest_ver = db.get_latest_snapshot_version(&project.id).map_err(|e| e.to_string())?.unwrap_or(0);
    let snap = ProjectSnapshot {
        id: format!("snap-{}", uuid::Uuid::new_v4()),
        project_id: project.id.clone(),
        version_number: latest_ver + 1,
        snapshot_type,
        label: label.to_string(),
        description: description.to_string(),
        project_json: json,
        checkpoint_stage: if stage.is_empty() { None } else { Some(stage.to_string()) },
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };
    db.insert_snapshot(&snap).map_err(|e| e.to_string())?;
    Ok(snap)
}

#[tauri::command]
pub async fn create_snapshot(
    state: State<'_, AppState>, project_id: String,
    label: String, description: String,
) -> Result<ProjectSnapshot, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    drop(conn);
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    save_snapshot(&state.db, &project, "", if label.is_empty() { "Manual snapshot" } else { &label }, &description, SnapshotType::Manual)
}

#[tauri::command]
pub async fn list_snapshots(state: State<'_, AppState>, project_id: String) -> Result<Vec<ProjectSnapshot>, String> {
    state.db.list_snapshots(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshot(state: State<'_, AppState>, snapshot_id: String) -> Result<ProjectSnapshot, String> {
    state.db.get_snapshot(&snapshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_snapshot(state: State<'_, AppState>, snapshot_id: String) -> Result<ResearchProject, String> {
    let snap = state.db.get_snapshot(&snapshot_id).map_err(|e| format!("Snapshot not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&snap.project_json).map_err(|e| format!("Parse error: {}", e))?;
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET name = ?1, updated_at = ?2, status = ?3, data_json = ?4 WHERE id = ?5", rusqlite::params![project.name, project.updated_at, project.status.as_str(), json, project.id]).map_err(|e| e.to_string())?;
    // Re-denormalize
    conn.execute("DELETE FROM signals WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for sig in &project.signals {
        conn.execute("INSERT INTO signals (id, project_id, signal_type, content, source_platform, source_url, source_timestamp, topic_tags, sentiment, evidence_strength, confidence_score, cross_platform_count, representative_note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)", rusqlite::params![sig.id, project.id, sig.signal_type.label_en(), sig.content, sig.source_platform, sig.source_url, sig.source_timestamp, sig.topic_tags.join(", "), serde_json::to_string(&sig.sentiment).unwrap_or_default().trim_matches('"'), serde_json::to_string(&sig.evidence_strength).unwrap_or_default().trim_matches('"'), sig.confidence_score, sig.cross_platform_count, sig.representative_note]).map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM competitors_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for comp in &project.competitors {
        let info_json = serde_json::json!({"positioning": comp.positioning, "target_user": comp.target_user, "core_features": comp.core_features, "pricing": comp.pricing, "platforms": comp.platforms, "ratings": comp.ratings, "reviews_count": comp.reviews_count, "pros": comp.pros, "cons": comp.cons, "opportunity": comp.opportunity, "category_group": comp.category_group});
        conn.execute("INSERT OR REPLACE INTO competitors_store (id, project_id, name, url, info_json) VALUES (?1, ?2, ?3, ?4, ?5)", rusqlite::params![comp.id, project.id, comp.name, comp.url, info_json.to_string()]).map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM user_voices_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for voice in &project.user_voices {
        let content_json = serde_json::to_string(voice).unwrap_or_default();
        conn.execute("INSERT OR REPLACE INTO user_voices_store (id, project_id, content_json) VALUES (?1, ?2, ?3)", rusqlite::params![voice.id, project.id, content_json]).map_err(|e| e.to_string())?;
    }
    let eval_json = serde_json::to_string(&project.evaluation).unwrap_or_default();
    conn.execute("INSERT OR REPLACE INTO evaluation_cache (project_id, evaluation_json, computed_at) VALUES (?1, ?2, ?3)", rusqlite::params![project.id, eval_json, project.updated_at]).map_err(|e| e.to_string())?;
    drop(conn);
    Ok(project)
}

#[tauri::command]
pub async fn delete_snapshot(state: State<'_, AppState>, snapshot_id: String) -> Result<(), String> {
    state.db.delete_snapshot(&snapshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshot_counts(state: State<'_, AppState>) -> Result<Vec<(String, i32)>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT project_id, COUNT(*) FROM project_snapshots GROUP BY project_id").map_err(|e| e.to_string())?;
    let counts: Vec<(String, i32)> = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(counts)
}
