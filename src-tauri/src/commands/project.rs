use crate::models::*;
use tauri::State;
use crate::commands::AppState;

#[tauri::command]
pub async fn get_projects(state: State<'_, AppState>) -> Result<Vec<SerializedProject>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at, updated_at, status, data_json FROM projects ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let projects = stmt
        .query_map([], |row| {
            Ok(SerializedProject {
                id: row.get(0)?, name: row.get(1)?, created_at: row.get(2)?,
                updated_at: row.get(3)?, status: row.get(4)?, data_json: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(projects)
}

#[tauri::command]
pub async fn get_project(state: State<'_, AppState>, project_id: String) -> Result<ResearchProject, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    // Load signals
    let mut sig_stmt = conn
        .prepare("SELECT id, project_id, signal_type, content, source_platform, source_url, source_timestamp, topic_tags, sentiment, evidence_strength, confidence_score, cross_platform_count, representative_note FROM signals WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let signals: Vec<Signal> = sig_stmt
        .query_map(rusqlite::params![project_id], |row| {
            let tags_str: String = row.get(7).unwrap_or_default();
            let topic_tags: Vec<String> = if tags_str.is_empty() { Vec::new() } else { tags_str.split(',').map(|s| s.trim().to_string()).collect() };
            Ok(Signal {
                id: row.get(0)?, project_id: row.get(1)?,
                signal_type: serde_json::from_str(&format!("\"{}\"", row.get::<_, String>(2)?)).unwrap_or(SignalType::DemandSignal),
                content: row.get(3)?, source_platform: row.get(4)?, source_url: row.get(5)?,
                source_timestamp: row.get(6).unwrap_or_default(), topic_tags,
                sentiment: serde_json::from_str(&format!("\"{}\"", row.get::<_, String>(8)?)).unwrap_or(Sentiment::Neutral),
                evidence_strength: serde_json::from_str(&format!("\"{}\"", row.get::<_, String>(9)?)).unwrap_or(EvidenceStrength::Medium),
                confidence_score: row.get(10)?, cross_platform_count: row.get(11)?,
                representative_note: row.get(12).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    project.signals = signals;
    Ok(project)
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    statement: String,
    product_form: String,
    target_user: String,
    scenario: String,
    research_mode: Option<String>,
) -> Result<ResearchProject, String> {
    let mode = match research_mode.as_deref() {
        Some("deep") => ResearchMode::Deep,
        _ => ResearchMode::Quick,
    };
    let project_id = format!("proj-{}", uuid::Uuid::new_v4());
    let now = crate::worker::now_str();
    let llm_extension = super::try_llm_model_idea(&statement, &product_form, "zh").await;
    let idea_model = IdeaModel {
        statement: statement.clone(),
        target_user: if target_user.is_empty() { llm_extension.target_user.clone() } else { target_user.clone() },
        core_job: llm_extension.core_job.clone(),
        use_scenario: if scenario.is_empty() { llm_extension.use_scenario.clone() } else { scenario.clone() },
        existing_alternatives: llm_extension.existing_alternatives.join("；"),
        product_form: product_form.clone(),
        target_budget: String::new(),
        research_goal: format!("验证「{}」的市场需求和进入价值", statement),
        key_constraints: String::new(),
        suggested_keywords: llm_extension.suggested_keywords.clone(),
        categories: llm_extension.categories.iter().map(|c| c.name.clone()).collect(),
        excluded_keywords: Vec::new(),
    };
    let project = ResearchProject {
        id: project_id.clone(),
        name: format!("想法：{}...", statement.chars().take(15).collect::<String>()),
        created_at: now.clone(), updated_at: now,
        status: ProjectStatus::Completed,
        idea_model,
        search_tasks: Vec::new(), competitors: Vec::new(), user_voices: Vec::new(),
        signals: Vec::new(), topic_clusters: Vec::new(), vocab_set: None,
        evaluation: Evaluation {
            overall_recommendation: "待分析 - 请点击「开启全网并联分析」启动调研".to_string(),
            confidence_score: 0, dimensions: Vec::new(),
            key_opportunities: String::new(), key_risks: String::new(), uncertainty_note: String::new(),
        },
        strategy: Strategy {
            market_scenario: String::new(), suggested_path: String::new(),
            positioning_statement: String::new(), must_have_features: Vec::new(),
            avoid_features: Vec::new(), offensive_tactics: String::new(),
        },
        validation_plan: Vec::new(),
        platform_weights: PlatformWeights::default(),
        enabled_platforms: vec!["Reddit".into(), "Google Search".into(), "G2 / Capterra".into(), "App Store".into()],
        research_mode: mode,
        region: "global".to_string(), language: "zh".to_string(),
    };
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO projects (id, name, created_at, updated_at, status, data_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![project.id, project.name, project.created_at, project.updated_at, project.status.as_str(), json],
    ).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(
        &state.db, &project, "",
        &format!("Project created: {}", project.name),
        "Initial project creation", SnapshotType::Auto,
    );
    Ok(project)
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    project_id: String,
    project_data: ResearchProject,
) -> Result<(), String> {
    let json = serde_json::to_string(&project_data).map_err(|e| e.to_string())?;
    let now = crate::worker::now_str();
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET name = ?1, updated_at = ?2, status = ?3, data_json = ?4 WHERE id = ?5",
        rusqlite::params![project_data.name, now, project_data.status.as_str(), json, project_id],
    ).map_err(|e| e.to_string())?;
    // Persist signals
    conn.execute("DELETE FROM signals WHERE project_id = ?1", rusqlite::params![project_id]).map_err(|e| e.to_string())?;
    for sig in &project_data.signals {
        conn.execute(
            "INSERT INTO signals (id, project_id, signal_type, content, source_platform, source_url, source_timestamp, topic_tags, sentiment, evidence_strength, confidence_score, cross_platform_count, representative_note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                sig.id, project_id, sig.signal_type.label_en(), sig.content, sig.source_platform,
                sig.source_url, sig.source_timestamp, sig.topic_tags.join(", "),
                serde_json::to_string(&sig.sentiment).unwrap_or_default().trim_matches('"'),
                serde_json::to_string(&sig.evidence_strength).unwrap_or_default().trim_matches('"'),
                sig.confidence_score, sig.cross_platform_count, sig.representative_note
            ],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_project(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![project_id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM signals WHERE project_id = ?1", rusqlite::params![project_id]).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = state.db.delete_project_snapshots(&project_id);
    Ok(())
}

// ── Competitor CRUD ──

#[tauri::command]
pub async fn add_competitor(
    state: State<'_, AppState>, project_id: String, name: String, url: String,
    positioning: String, pricing: String, core_features: String,
    pros: String, cons: String, category_group: String,
) -> Result<Competitor, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    let competitor = Competitor {
        id: format!("comp-{}", uuid::Uuid::new_v4()), name,
        url: if url.is_empty() { "#".to_string() } else { url },
        positioning: if positioning.is_empty() { "用户手工补充的竞品定位说明".to_string() } else { positioning },
        target_user: "待定高粘性客户群".to_string(),
        core_features: if core_features.is_empty() { "Standard functionalities".to_string() } else { core_features },
        pricing, platforms: vec!["Web".to_string()],
        ratings: 4.0, reviews_count: 1,
        pros: if pros.is_empty() { "N/A".to_string() } else { pros },
        cons: if cons.is_empty() { "N/A".to_string() } else { cons },
        opportunity: "待定差异化空间".to_string(),
        category_group,
        last_updated: None,
    };
    let result = competitor.clone();
    project.competitors.push(competitor);
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![json, project.updated_at, project_id],
    ).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(
        &state.db, &project, "", "Competitor added",
        &format!("Added competitor: {}", result.name), SnapshotType::Auto,
    );
    Ok(result)
}

#[tauri::command]
pub async fn delete_competitor(
    state: State<'_, AppState>, project_id: String, competitor_id: String,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    project.competitors.retain(|c| c.id != competitor_id);
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3", rusqlite::params![json, project.updated_at, project_id]).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(&state.db, &project, "", "Competitor deleted", &format!("Deleted: {}", competitor_id), SnapshotType::Auto);
    Ok(())
}

#[tauri::command]
pub async fn move_competitor_group(
    state: State<'_, AppState>, project_id: String, competitor_id: String, new_group: String,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    if let Some(comp) = project.competitors.iter_mut().find(|c| c.id == competitor_id) {
        comp.category_group = new_group;
    }
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3", rusqlite::params![json, project.updated_at, project_id]).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(&state.db, &project, "", "Competitor group changed", "Competitor moved to new group", SnapshotType::Auto);
    Ok(())
}

// ── User Voice CRUD ──

#[tauri::command]
pub async fn add_user_voice(
    state: State<'_, AppState>, project_id: String, user_name: String, platform: String,
    title: String, content: String, sentiment: String, topic: String, source_url: String,
) -> Result<UserVoice, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    let parsed_sentiment = match sentiment.as_str() {
        "positive" => Sentiment::Positive, "negative" => Sentiment::Negative, _ => Sentiment::Neutral,
    };
    let topics = if topic.is_empty() { vec!["自定义补充".to_string()] } else { vec![topic] };
    let voice = UserVoice {
        id: format!("voice-{}", uuid::Uuid::new_v4()),
        user_name: if user_name.is_empty() { "anonymous_user".to_string() } else { user_name },
        platform, title: if title.is_empty() { "用户补充的反馈主题".to_string() } else { title },
        content: content.clone(), sentiment: parsed_sentiment, topics,
        quote: content.chars().take(40).collect::<String>() + "...",
        strength: EvidenceStrength::Medium,
        source_url: if source_url.is_empty() { "https://example.com/source".to_string() } else { source_url },
        timestamp: chrono::Utc::now().format("%Y-%m-%d").to_string(),
    };
    let result = voice.clone();
    project.user_voices.insert(0, voice);
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3", rusqlite::params![json, project.updated_at, project_id]).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(&state.db, &project, "", "User voice added", &format!("Added voice: {}", result.title), SnapshotType::Auto);
    Ok(result)
}

#[tauri::command]
pub async fn delete_user_voice(
    state: State<'_, AppState>, project_id: String, voice_id: String,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    project.id = project_id.clone();
    project.user_voices.retain(|v| v.id != voice_id);
    let now = crate::worker::now_str();
    project.updated_at = now;
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute("UPDATE projects SET data_json = ?1, updated_at = ?2 WHERE id = ?3", rusqlite::params![json, project.updated_at, project_id]).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = crate::commands::snapshot::save_snapshot(&state.db, &project, "", "User voice deleted", &format!("Deleted: {}", voice_id), SnapshotType::Auto);
    Ok(())
}

// ── Stats ──

#[tauri::command]
pub async fn get_stats(state: State<'_, AppState>) -> Result<AppStats, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let total_projects: i64 = conn
        .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
        .unwrap_or(0);
    let total_competitors: i64 = conn
        .query_row("SELECT COUNT(*) FROM competitors_store", [], |row| row.get(0))
        .unwrap_or(0);
    let total_raw_documents: i64 = conn
        .query_row("SELECT COUNT(*) FROM raw_documents", [], |row| row.get(0))
        .unwrap_or(0);
    let recent_7d_projects: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE updated_at >= date('now', '-7 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(AppStats {
        total_projects,
        total_competitors,
        total_raw_documents,
        recent_7d_projects,
    })
}

// ── Competitor Evidence ──

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorEvidence {
    pub platform: String,
    pub query_text: String,
    pub title: String,
    pub url: String,
    pub summary: String,
    pub captured_at: String,
}

/// A6: Query search_results table for evidence related to a competitor name.
#[tauri::command]
pub async fn get_competitor_evidence(
    state: State<'_, AppState>,
    project_id: String,
    competitor_name: String,
) -> Result<Vec<CompetitorEvidence>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT platform, query_text, result_json, captured_at FROM search_results WHERE project_id = ?1 ORDER BY captured_at DESC")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String, String)> = stmt
        .query_map(rusqlite::params![project_id], |row| {
            Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let name_lower = competitor_name.to_lowercase();
    let mut evidence = Vec::new();
    for (platform, query_text, result_json, captured_at) in &rows {
        // Check if result_json contains the competitor name
        if result_json.to_lowercase().contains(&name_lower) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(result_json) {
                let title = parsed["title"].as_str().unwrap_or("").to_string();
                let url = parsed["url"].as_str().unwrap_or("").to_string();
                let summary = parsed["summary"].as_str().unwrap_or("").to_string();
                if !title.is_empty() || !summary.is_empty() {
                    evidence.push(CompetitorEvidence {
                        platform: platform.clone(),
                        query_text: query_text.clone(),
                        title,
                        url,
                        summary,
                        captured_at: captured_at.clone(),
                    });
                }
            }
        }
    }
    Ok(evidence)
}
