use crate::analysis;
use crate::models::*;
use tauri::State;
use crate::commands::AppState;

#[tauri::command]
pub async fn analyze_idea(
    state: State<'_, AppState>,
    project_id: String,
    statement: String,
    product_form: String,
    target_user: String,
    scenario: String,
    enabled_platforms: Vec<String>,
    platform_weights: PlatformWeights,
    research_mode: Option<String>,
) -> Result<ResearchProject, String> {
    // Apply research_mode to project before running pipeline
    {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let json_str: String = conn
            .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![&project_id], |row| row.get(0))
            .map_err(|e| format!("Project not found: {}", e))?;
        let mut p: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
        p.id = project_id.clone();
        if let Some(mode_str) = &research_mode {
            p.research_mode = match mode_str.as_str() {
                "deep" => ResearchMode::Deep,
                _ => ResearchMode::Quick,
            };
        }
        let json = serde_json::to_string(&p).map_err(|e| e.to_string())?;
        conn.execute("UPDATE projects SET data_json = ?1 WHERE id = ?2", rusqlite::params![json, project_id]).map_err(|e| e.to_string())?;
    }
    crate::worker::run_analysis_pipeline(
        &state.db, &state.scheduler, &state.app_handle,
        &project_id, &statement, &product_form, &target_user, &scenario,
        &enabled_platforms, &platform_weights,
    ).await
}

#[tauri::command]
pub async fn re_evaluate(
    state: State<'_, AppState>,
    project_id: String,
    platform_weights: PlatformWeights,
    strategy_mode: Option<String>,
) -> Result<ResearchProject, String> {
    let mut project: ResearchProject = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let json_str: String = conn
            .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
            .map_err(|e| format!("Project not found: {}", e))?;
        let mut p: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
        p.id = project_id.clone();
        p
    };
    project.platform_weights = platform_weights;
    project.evaluation = analysis::compute_evaluation(
        &project.user_voices, &project.competitors, &project.signals, &project.platform_weights,
        &project.language,
    );
    project.strategy = analysis::try_llm_generate_strategy(
        &project.evaluation, &project.competitors, &project.idea_model.statement,
        strategy_mode.as_deref(),
        &project.language,
    ).await;
    project.topic_clusters = analysis::cluster_topics(&project.user_voices);
    project.updated_at = crate::worker::now_str();

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3", rusqlite::params![json, project.updated_at, project_id]).map_err(|e| e.to_string())?;
    drop(conn);

    let _ = crate::commands::snapshot::save_snapshot(
        &state.db, &project, "", "Re-evaluation complete", "Re-evaluated with updated weights", SnapshotType::Auto,
    );
    Ok(project)
}

#[tauri::command]
pub async fn resume_analysis(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ResearchProject, String> {
    let mut project: ResearchProject = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let json_str: String = conn
            .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![&project_id], |row| row.get(0))
            .map_err(|e| format!("Project not found: {}", e))?;
        let mut p: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
        p.id = project_id.clone();
        p
    };
    let snaps = state.db.list_snapshots(&project_id).map_err(|e| e.to_string())?;
    let last_checkpoint = snaps.iter().find(|s| s.checkpoint_stage.is_some());
    let stage = last_checkpoint.and_then(|s| s.checkpoint_stage.clone()).unwrap_or_default();
    let statement = project.idea_model.statement.clone();

    if stage.is_empty() || stage == "platform_queries_done" || stage == "idea_modeled" {
        let enabled = project.enabled_platforms.clone();
        let weights = project.platform_weights.clone();
        return analyze_idea(state, project_id,
            project.idea_model.statement.clone(),
            project.idea_model.product_form.clone(),
            project.idea_model.target_user.clone(),
            project.idea_model.use_scenario.clone(),
            enabled, weights, None).await;
    }

    project.signals = analysis::extract_signals(&project.user_voices, &project.competitors, &project_id);
    project.evaluation = analysis::compute_evaluation(&project.user_voices, &project.competitors, &project.signals, &project.platform_weights, &project.language);
    project.strategy = analysis::try_llm_generate_strategy(&project.evaluation, &project.competitors, &statement, None, &project.language).await;
    project.validation_plan = analysis::try_llm_generate_validation(&project.evaluation, &statement, &project.language).await;
    project.topic_clusters = analysis::cluster_topics(&project.user_voices);
    project.status = ProjectStatus::Completed;
    project.updated_at = crate::worker::now_str();

    let _ = crate::commands::snapshot::save_snapshot(&state.db, &project, "complete", "Analysis resumed & complete", "Resumed from interrupted analysis", SnapshotType::Checkpoint);

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET name = ?1, updated_at = ?2, status = ?3, data_json = ?4 WHERE id = ?5", rusqlite::params![project.name, project.updated_at, project.status.as_str(), json, project.id]).map_err(|e| e.to_string())?;
    // Re-denormalize
    conn.execute("DELETE FROM signals WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for sig in &project.signals {
        conn.execute("INSERT INTO signals (id, project_id, signal_type, content, source_platform, source_url, source_timestamp, topic_tags, sentiment, evidence_strength, confidence_score, cross_platform_count, representative_note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)", rusqlite::params![sig.id, project.id, sig.signal_type.label_en(), sig.content, sig.source_platform, sig.source_url, sig.source_timestamp, sig.topic_tags.join(", "), serde_json::to_string(&sig.sentiment).unwrap_or_default().trim_matches('"'), serde_json::to_string(&sig.evidence_strength).unwrap_or_default().trim_matches('"'), sig.confidence_score, sig.cross_platform_count, sig.representative_note]).map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM competitors_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for comp in &project.competitors {
        let info_json = serde_json::json!({"positioning":comp.positioning,"target_user":comp.target_user,"core_features":comp.core_features,"pricing":comp.pricing,"platforms":comp.platforms,"ratings":comp.ratings,"reviews_count":comp.reviews_count,"pros":comp.pros,"cons":comp.cons,"opportunity":comp.opportunity,"category_group":comp.category_group});
        conn.execute("INSERT OR REPLACE INTO competitors_store (id, project_id, name, url, info_json) VALUES (?1, ?2, ?3, ?4, ?5)", rusqlite::params![comp.id, project.id, comp.name, comp.url, info_json.to_string()]).map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM user_voices_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for voice in &project.user_voices {
        conn.execute("INSERT OR REPLACE INTO user_voices_store (id, project_id, content_json) VALUES (?1, ?2, ?3)", rusqlite::params![voice.id, project.id, serde_json::to_string(voice).unwrap_or_default()]).map_err(|e| e.to_string())?;
    }
    conn.execute("INSERT OR REPLACE INTO evaluation_cache (project_id, evaluation_json, computed_at) VALUES (?1, ?2, ?3)", rusqlite::params![project.id, serde_json::to_string(&project.evaluation).unwrap_or_default(), project.updated_at]).map_err(|e| e.to_string())?;
    drop(conn);
    Ok(project)
}

#[tauri::command]
pub async fn cancel_analysis(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    state.scheduler.cancel_project(&project_id).await;
    Ok(())
}

#[tauri::command]
pub async fn search_documents(state: State<'_, AppState>, query: String) -> Result<Vec<(String, String, String)>, String> {
    state.db.search_fts(&query).map_err(|e| e.to_string())
}
