//! Analysis pipeline — encapsulates the full analyze_idea flow.
//! Search → extract → evaluate → strategize → validate.
//! Supports checkpointing and (in Phase 3) real-time progress events.

use crate::adapters::SearchResult;
use crate::analysis;
use crate::db::Database;
use crate::llm::LlmProvider;
use crate::models::*;
use crate::normalization;
use crate::query_planner;
use crate::scheduler::Scheduler;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::Emitter;

pub fn now_str() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M").to_string()
}

/// Emit a progress event to the frontend.
fn emit(app_handle: &tauri::AppHandle, stage: &str, message: &str, pct: u8) {
    let _ = app_handle.emit("analysis-progress", serde_json::json!({
        "stage": stage,
        "message": message,
        "progressPct": pct,
        "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    }));
}

/// Run the full analysis pipeline. Returns the completed project.
pub async fn run_analysis_pipeline(
    db: &Database,
    scheduler: &Arc<Scheduler>,
    app_handle: &tauri::AppHandle,
    project_id: &str,
    statement: &str,
    product_form: &str,
    target_user: &str,
    scenario: &str,
    enabled_platforms: &[String],
    platform_weights: &PlatformWeights,
) -> Result<ResearchProject, String> {
    // 1. Load project
    emit(app_handle, "loading", "Loading project...", 2);
    let mut project = load_project(db, project_id).await?;

    // 2. Idea modeling
    emit(app_handle, "modeling", "Analyzing idea with LLM...", 10);
    let llm_ext = try_llm_model_idea(statement, product_form, &project.language).await;
    project.idea_model = IdeaModel {
        statement: statement.to_string(),
        target_user: if target_user.is_empty() { llm_ext.target_user.clone() } else { target_user.to_string() },
        core_job: llm_ext.core_job,
        use_scenario: if scenario.is_empty() { llm_ext.use_scenario.clone() } else { scenario.to_string() },
        existing_alternatives: llm_ext.existing_alternatives.join("；"),
        product_form: product_form.to_string(),
        target_budget: if project.language == "en" { "TBD" } else { "待评估" }.to_string(),
        research_goal: if project.language == "en" {
            format!("Validate market demand and entry strategy for \"{}\"", statement)
        } else {
            format!("验证「{}」的市场需求和进入策略", statement)
        },
        key_constraints: String::new(),
        suggested_keywords: llm_ext.suggested_keywords.clone(),
        categories: llm_ext.categories.iter().map(|c| c.name.clone()).collect(),
        excluded_keywords: Vec::new(),
    };
    project.status = ProjectStatus::Searching;
    persist_project(db, &project).await?;

    // 3. Platform search — warn about missing API keys first
    let api_configured = crate::adapters::is_search_api_configured();
    let llm_configured = crate::llm::deepseek::DeepSeekProvider::from_env().is_ok();
    let mut warnings: Vec<String> = Vec::new();

    if !api_configured {
        let needing_keys = crate::adapters::platforms_needing_api_key();
        let affected: Vec<&str> = needing_keys.iter()
            .filter(|p| enabled_platforms.contains(&p.to_string()))
            .cloned().collect();
        if !affected.is_empty() {
            let msg = format!(
                "⚠️ 未配置搜索 API Key（SERP_API_KEY / SERPER_API_KEY）。以下平台将返回 0 结果: {}。仅 Reddit、App Store 可正常工作。",
                affected.join("、")
            );
            warnings.push(msg.to_string());
            emit(app_handle, "warning", &msg, 18);
            log::warn!("{}", msg);
        }
    }
    if !llm_configured {
        let msg = "⚠️ 未配置 DeepSeek API Key（DEEPSEEK_API_KEY）。策略建议、验证计划、话题聚类将使用固定模板，不同项目可能输出相似内容。";
        warnings.push(msg.to_string());
        emit(app_handle, "warning", msg, 19);
        log::warn!("{}", msg);
    }

    emit(app_handle, "searching", "Searching across platforms...", 20);
    project.enabled_platforms = enabled_platforms.to_vec();
    project.platform_weights = platform_weights.clone();

    // P0-3/P0-4: Load merged platform configs (system defaults → user overrides → project overrides)
    let all_platforms = db.load_platform_configs(project_id)
        .map_err(|e| format!("Failed to load platform configs: {}", e))?;

    // A1: Auto-adjust platform weights based on product type (B2B SaaS → G2/LinkedIn, Mobile → App Store, etc.)
    let type_weights = crate::config::product_type_platform_weights(product_form);
    let mut adjusted_weights = platform_weights.clone();
    for (pf_name, multiplier) in &type_weights {
        match pf_name.as_str() {
            "G2 / Capterra" => adjusted_weights.g2 = (adjusted_weights.g2 * multiplier).min(2.0),
            "Reddit" => adjusted_weights.reddit = (adjusted_weights.reddit * multiplier).min(2.0),
            "Google Search" => adjusted_weights.google = (adjusted_weights.google * multiplier).min(2.0),
            "Bing" => adjusted_weights.bing = (adjusted_weights.bing * multiplier).min(2.0),
            "App Store" => adjusted_weights.store = (adjusted_weights.store * multiplier).min(2.0),
            "X / Twitter" => adjusted_weights.x_twitter = (adjusted_weights.x_twitter * multiplier).min(2.0),
            "Product Hunt" => adjusted_weights.product_hunt = (adjusted_weights.product_hunt * multiplier).min(2.0),
            "AlternativeTo" => adjusted_weights.alternative_to = (adjusted_weights.alternative_to * multiplier).min(2.0),
            "Trustpilot" => adjusted_weights.trustpilot = (adjusted_weights.trustpilot * multiplier).min(2.0),
            "Quora" => adjusted_weights.quora = (adjusted_weights.quora * multiplier).min(2.0),
            "TikTok" => adjusted_weights.tiktok = (adjusted_weights.tiktok * multiplier).min(2.0),
            "LinkedIn" => adjusted_weights.linkedin = (adjusted_weights.linkedin * multiplier).min(2.0),
            "YouTube" => adjusted_weights.youtube = (adjusted_weights.youtube * multiplier).min(2.0),
            "Google Play" => adjusted_weights.google_play = (adjusted_weights.google_play * multiplier).min(2.0),
            "Chrome Web Store" => adjusted_weights.chrome_web_store = (adjusted_weights.chrome_web_store * multiplier).min(2.0),
            "Google Trends" => adjusted_weights.google_trends = (adjusted_weights.google_trends * multiplier).min(2.0),
            "Zhihu" => adjusted_weights.zhihu = (adjusted_weights.zhihu * multiplier).min(2.0),
            "Tieba" => adjusted_weights.tieba = (adjusted_weights.tieba * multiplier).min(2.0),
            "Douban" => adjusted_weights.douban = (adjusted_weights.douban * multiplier).min(2.0),
            "Amazon" | "Etsy" | "Taobao" | "JD.com" => adjusted_weights.ecommerce = (adjusted_weights.ecommerce * multiplier).min(2.0),
            _ => {}
        }
    }
    project.platform_weights = adjusted_weights.clone();

    // P0-2: Filter by research_mode (quick/deep)
    let mode_platforms: Vec<&PlatformConfig> = all_platforms.iter()
        .filter(|p| match project.research_mode {
            ResearchMode::Quick => p.participate_quick,
            ResearchMode::Deep => p.participate_deep,
        })
        .filter(|p| enabled_platforms.contains(&p.name))
        .collect();

    // P0-1: Use query_planner (LLM + template dual-path) instead of inline query generation
    let query_plans = query_planner::generate_query_plans(
        &project.idea_model,
        &mode_platforms.iter().map(|&p| p.clone()).collect::<Vec<_>>(),
        &project.language,
        &project.region,
    ).await;

    let mut all_tasks = Vec::new();
    let mut all_results = Vec::new();

    // ═══ Round 1: Initial search with four-layer queries ═══
    emit(app_handle, "searching", "Round 1: Broad search with multi-layer queries...", 22);
    for plan in &query_plans {
        let pf_config = match mode_platforms.iter().find(|p| p.name == plan.platform) {
            Some(c) => (*c).clone(),
            None => continue,
        };
        let queries: Vec<String> = plan.queries.iter().map(|q| q.query_text.clone()).collect();
        if queries.is_empty() { continue; }

        let task_results = scheduler.run_platform_queries(&plan.platform, queries, &pf_config, project_id, Some(app_handle)).await;
        for tp in task_results {
            all_results.extend(tp.results.clone());
            for sr in &tp.results {
                let result_json = serde_json::json!({
                    "title": sr.title, "url": sr.url, "summary": sr.summary,
                    "rating": sr.rating, "review_count": sr.review_count,
                    "date": sr.date, "author": sr.author, "platform": sr.platform,
                });
                let _ = db.insert_search_result(project_id, &sr.platform, &tp.query, &result_json.to_string());
                let content_text = sr.content_text.clone().unwrap_or_else(|| sr.summary.clone());
                let metadata = serde_json::json!({"rating": sr.rating, "review_count": sr.review_count, "author": sr.author, "date": sr.date, "platform": sr.platform});
                let _ = db.insert_raw_document(project_id, &sr.platform, &sr.url, &sr.title, "", &content_text, &metadata.to_string());
            }
            all_tasks.push(SearchTask {
                platform: tp.platform, query: tp.query, status: tp.status,
                count: tp.results.len() as i32, duration_ms: tp.duration_ms,
                logs: tp.logs, retry_count: tp.retry_count,
                started_at: Some(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()),
            });
        }
    }

    // ═══ Vocabulary Extraction — extract community-native terms from round 1 ═══
    let round1_result_count = all_results.len();
    emit(app_handle, "searching", &format!("Round 1 complete: {} raw results. Extracting community vocabulary...", round1_result_count), 28);

    let vocab_set = analysis::try_llm_extract_vocabulary(&all_results).await;
    log::info!(
        "Vocab extracted: {} pain expressions, {} substitute behaviors, {} native terms, {} competitor context terms",
        vocab_set.pain_expressions.len(),
        vocab_set.substitute_behaviors.len(),
        vocab_set.community_native_terms.len(),
        vocab_set.competitor_context_terms.len(),
    );
    // Persist vocab set in project so frontend can display it (R9)
    project.vocab_set = Some(vocab_set.clone());
    persist_project(db, &project).await?;

    // ═══ Round 2: Precision search using community vocabulary (Deep mode only) ═══
    if project.research_mode == ResearchMode::Deep && !all_results.is_empty() {
        emit(app_handle, "searching", "Round 2: Precision search with community vocabulary...", 30);

        let refinement_plans = query_planner::generate_refinement_queries(
            &vocab_set,
            &project.idea_model.statement,
            enabled_platforms,
        );

        let mut round2_results = Vec::new();
        for plan in &refinement_plans {
            let pf_config = match mode_platforms.iter().find(|p| p.name == plan.platform) {
                Some(c) => (*c).clone(),
                None => continue,
            };
            let queries: Vec<String> = plan.queries.iter().map(|q| q.query_text.clone()).collect();
            if queries.is_empty() { continue; }

            let task_results = scheduler.run_platform_queries(&plan.platform, queries, &pf_config, project_id, Some(app_handle)).await;
            for tp in task_results {
                round2_results.extend(tp.results.clone());
                for sr in &tp.results {
                    let result_json = serde_json::json!({
                        "title": sr.title, "url": sr.url, "summary": sr.summary,
                        "rating": sr.rating, "review_count": sr.review_count,
                        "date": sr.date, "author": sr.author, "platform": sr.platform,
                    });
                    let _ = db.insert_search_result(project_id, &sr.platform, &tp.query, &result_json.to_string());
                    let content_text = sr.content_text.clone().unwrap_or_else(|| sr.summary.clone());
                    let metadata = serde_json::json!({"rating": sr.rating, "review_count": sr.review_count, "author": sr.author, "date": sr.date, "platform": sr.platform});
                    let _ = db.insert_raw_document(project_id, &sr.platform, &sr.url, &sr.title, "", &content_text, &metadata.to_string());
                }
                all_tasks.push(SearchTask {
                    platform: tp.platform, query: tp.query, status: tp.status,
                    count: tp.results.len() as i32, duration_ms: tp.duration_ms,
                    logs: tp.logs, retry_count: tp.retry_count,
                    started_at: Some(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                });
            }
        }

        emit(app_handle, "searching", &format!("Round 2 complete: {} additional results", round2_results.len()), 34);
        all_results.extend(round2_results);
    }

    project.search_tasks = all_tasks;

    // Post-search summary: per-platform result counts
    let mut platform_summary: Vec<String> = Vec::new();
    for pf_name in enabled_platforms.iter() {
        let total: usize = project.search_tasks.iter()
            .filter(|t| &t.platform == pf_name)
            .map(|t| t.count as usize)
            .sum();
        let succeeded = project.search_tasks.iter()
            .filter(|t| &t.platform == pf_name && t.status == SearchTaskStatus::Success)
            .count();
        let empty = project.search_tasks.iter()
            .filter(|t| &t.platform == pf_name && t.status == SearchTaskStatus::Empty)
            .count();
        let failed = project.search_tasks.iter()
            .filter(|t| &t.platform == pf_name && t.status == SearchTaskStatus::Failed)
            .count();
        let icon = if total > 0 { "✅" } else if failed > 0 { "❌" } else { "⚠️" };
        platform_summary.push(format!("{} {}: {} results ({} success, {} empty, {} failed)", icon, pf_name, total, succeeded, empty, failed));
    }
    emit(app_handle, "searching", &platform_summary.join(" | "), 40);

    // Normalize and deduplicate results before processing
    let mut normalized_results: Vec<SearchResult> = Vec::new();
    let mut seen_urls: HashSet<String> = HashSet::new();
    for r in &all_results {
        let clean_url = normalization::normalize_url(&r.url);
        if clean_url.is_empty() || seen_urls.contains(&clean_url) { continue; }
        seen_urls.insert(clean_url.clone());
        let mut nr = r.clone();
        nr.url = clean_url;
        if let Some(rating) = r.rating {
            let scale = normalization::detect_rating_scale(&r.platform);
            nr.rating = Some(normalization::normalize_rating(rating, scale));
        }
        nr.date = r.date.as_ref().map(|d| normalization::normalize_date(d));
        normalized_results.push(nr);
    }
    log::info!("Normalized {} results down to {} unique URLs (R1: {}, R2 vocabulary terms: {})",
        all_results.len(), normalized_results.len(), round1_result_count, vocab_set.community_native_terms.len());

    emit(app_handle, "searching", &format!("Search complete: {} tasks, {} unique results", project.search_tasks.len(), normalized_results.len()), 40);
    persist_project(db, &project).await?;

    // 4. Extract voices & competitors (with normalization applied)
    emit(app_handle, "extracting", "Extracting user voices & competitors...", 50);
    project.user_voices = extract_user_voices(&normalized_results, statement);
    project.competitors = extract_competitors(&normalized_results, statement).await;
    emit(app_handle, "extracting", &format!("Found {} voices, {} competitors", project.user_voices.len(), project.competitors.len()), 55);

    // P0-5: LLM competitor enrichment — extract pros/cons/opportunity/pricing etc.
    emit(app_handle, "enriching", "Enriching competitor profiles with LLM...", 58);
    analysis::try_llm_enrich_competitors(&mut project.competitors, &normalized_results, statement, &project.language).await;
    emit(app_handle, "enriching", "Competitor enrichment complete", 60);
    persist_project(db, &project).await?;

    // 5. Extract signals — P0-6: LLM-first with rule-based fallback
    emit(app_handle, "signals", "Extracting signals (LLM + rules)...", 65);
    project.signals = analysis::try_llm_extract_signals(&project.user_voices, &project.competitors, project_id, &project.language).await;
    emit(app_handle, "signals", &format!("Extracted {} signals", project.signals.len()), 70);
    persist_project(db, &project).await?;

    // 6. Compute evaluation
    emit(app_handle, "evaluating", "Computing 9-dimension evaluation...", 75);
    project.evaluation = analysis::compute_evaluation(&project.user_voices, &project.competitors, &project.signals, &adjusted_weights, &project.language);
    // P2-3: Apply LLM quality correction on top of rule-based scores
    emit(app_handle, "evaluating", "Applying LLM quality correction...", 77);
    project.evaluation = analysis::try_llm_correct_evaluation(project.evaluation, &project.signals, &project.competitors, &project.language).await;
    emit(app_handle, "evaluating", &format!("Evaluation complete — confidence: {}%", project.evaluation.confidence_score), 80);
    persist_project(db, &project).await?;

    // 7. Generate strategy
    emit(app_handle, "strategy", "Generating market entry strategy...", 85);
    project.strategy = analysis::try_llm_generate_strategy(&project.evaluation, &project.competitors, statement, None, &project.language).await;
    persist_project(db, &project).await?;

    // 8. Generate validation plan
    project.validation_plan = analysis::try_llm_generate_validation(&project.evaluation, statement, &project.language).await;

    // 9. Topic clusters (LLM-assisted, falls back to rule-based)
    emit(app_handle, "clustering", "Clustering topics...", 92);
    project.topic_clusters = analysis::try_llm_cluster_topics(&project.user_voices).await;

    project.status = ProjectStatus::Completed;
    project.updated_at = now_str();
    emit(app_handle, "complete", "Analysis complete!", 100);

    // Finalize: save with full denormalization
    finalize_project(db, project).await
}

// ── Internal helpers ──

async fn load_project(db: &Database, project_id: &str) -> Result<ResearchProject, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let mut p: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;
    p.id = project_id.to_string();
    Ok(p)
}

async fn persist_project(db: &Database, project: &ResearchProject) -> Result<(), String> {
    let json = serde_json::to_string(project).map_err(|e| e.to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET data_json = ?1, updated_at = ?2, status = ?3 WHERE id = ?4",
        rusqlite::params![json, project.updated_at, project.status.as_str(), project.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

async fn finalize_project(db: &Database, project: ResearchProject) -> Result<ResearchProject, String> {
    let json = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("UPDATE projects SET name = ?1, updated_at = ?2, status = ?3, data_json = ?4 WHERE id = ?5",
        rusqlite::params![project.name, project.updated_at, project.status.as_str(), json, project.id],
    ).map_err(|e| e.to_string())?;

    // Denormalize signals
    conn.execute("DELETE FROM signals WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for sig in &project.signals {
        conn.execute("INSERT INTO signals (id, project_id, signal_type, content, source_platform, source_url, source_timestamp, topic_tags, sentiment, evidence_strength, confidence_score, cross_platform_count, representative_note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![sig.id, project.id, sig.signal_type.label_en(), sig.content, sig.source_platform, sig.source_url, sig.source_timestamp, sig.topic_tags.join(", "), serde_json::to_string(&sig.sentiment).unwrap_or_default().trim_matches('"'), serde_json::to_string(&sig.evidence_strength).unwrap_or_default().trim_matches('"'), sig.confidence_score, sig.cross_platform_count, sig.representative_note],
        ).map_err(|e| e.to_string())?;
    }

    // Denormalize competitors
    conn.execute("DELETE FROM competitors_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for comp in &project.competitors {
        let info_json = serde_json::json!({"positioning": comp.positioning, "target_user": comp.target_user, "core_features": comp.core_features, "pricing": comp.pricing, "platforms": comp.platforms, "ratings": comp.ratings, "reviews_count": comp.reviews_count, "pros": comp.pros, "cons": comp.cons, "opportunity": comp.opportunity, "category_group": comp.category_group});
        conn.execute("INSERT OR REPLACE INTO competitors_store (id, project_id, name, url, info_json) VALUES (?1, ?2, ?3, ?4, ?5)", rusqlite::params![comp.id, project.id, comp.name, comp.url, info_json.to_string()]).map_err(|e| e.to_string())?;
    }

    // Denormalize user voices
    conn.execute("DELETE FROM user_voices_store WHERE project_id = ?1", rusqlite::params![&project.id]).map_err(|e| e.to_string())?;
    for voice in &project.user_voices {
        let content_json = serde_json::to_string(voice).unwrap_or_default();
        conn.execute("INSERT OR REPLACE INTO user_voices_store (id, project_id, content_json) VALUES (?1, ?2, ?3)", rusqlite::params![voice.id, project.id, content_json]).map_err(|e| e.to_string())?;
    }

    // Cache evaluation
    let eval_json = serde_json::to_string(&project.evaluation).unwrap_or_default();
    conn.execute("INSERT OR REPLACE INTO evaluation_cache (project_id, evaluation_json, computed_at) VALUES (?1, ?2, ?3)", rusqlite::params![project.id, eval_json, project.updated_at]).map_err(|e| e.to_string())?;

    Ok(project)
}

// ── LLM helpers ──

pub async fn try_llm_model_idea(statement: &str, product_form: &str, language: &str) -> IdeaModelExtension {
    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let is_en = language == "en";
            let (target_user_hint, core_job_hint, scenario_hint) = if is_en {
                ("target user in English", "core JTBD in English", "usage scenario in English")
            } else {
                ("target user in Chinese", "core JTBD in Chinese", "usage scenario in Chinese")
            };
            let sys = crate::llm::json_system_prompt(&format!(
                r#"{{"target_user":"{}","core_job":"{}","use_scenario":"{}","existing_alternatives":["alternative1"],"product_form":"product form","categories":[{{"name":"category","level":1,"confidence":0.9}}],"suggested_keywords":["kw1"],"platform_priority":[{{"platform":"name","priority":10,"reason":"reason"}}]}}"#,
                target_user_hint, core_job_hint, scenario_hint
            ));
            let lang_instr = crate::llm::language_instruction(language);
            let prompt = format!("Product idea: {}\nProduct form hint: {}\n{}", statement, product_form, lang_instr);
            match llm.structured::<IdeaModelExtension>(&sys, &prompt).await {
                Ok(model) => model,
                Err(e) => { log::warn!("LLM idea modeling failed: {}", e); fallback_idea_model(statement, language) }
            }
        }
        Err(e) => { log::warn!("DeepSeek unavailable: {}", e); fallback_idea_model(statement, language) }
    }
}

pub fn fallback_idea_model(statement: &str, language: &str) -> IdeaModelExtension {
    let is_en = language == "en";
    IdeaModelExtension {
        target_user: if is_en { "To be determined through research" } else { "待通过研究确定" }.to_string(),
        core_job: if is_en {
            format!("Core tasks related to \"{}\"", statement.chars().take(20).collect::<String>())
        } else {
            format!("解决「{}」相关的核心任务", statement.chars().take(20).collect::<String>())
        },
        use_scenario: if is_en { "Frequently encountered pain point in daily work" } else { "日常工作中频繁遇到该痛点" }.to_string(),
        existing_alternatives: if is_en {
            vec!["Excel / manual processes".into(), "Assorted open-source tools".into()]
        } else {
            vec!["Excel/手动流程".into(), "零散开源工具组合".into()]
        },
        product_form: "SaaS".to_string(),
        categories: vec![CategoryCandidate {
            name: if is_en { "General Tools" } else { "通用工具" }.into(),
            level: 1, confidence: 0.5,
        }],
        suggested_keywords: keyword_from_statement(statement),
        platform_priority: vec![
            PlatformPriority {
                platform: "Google Search".into(),
                priority: 10,
                reason: if is_en { "General search entry" } else { "通用搜索入口" }.into(),
            },
            PlatformPriority {
                platform: "Reddit".into(),
                priority: 9,
                reason: if is_en { "Real user discussions" } else { "真实用户讨论" }.into(),
            },
        ],
    }
}

pub fn keyword_from_statement(statement: &str) -> Vec<String> {
    statement.split(|c: char| c == '，' || c == '、' || c == ' ' || c == ',' || c == ';')
        .filter(|s| s.len() >= 2).map(|s| s.trim().to_string()).take(5).collect()
}

fn extract_user_voices(results: &[SearchResult], statement: &str) -> Vec<UserVoice> {
    results.iter().filter_map(|r| {
        let content = r.content_text.clone().unwrap_or_else(|| r.summary.clone());
        if content.len() < 10 { return None; }
        let sentiment = infer_sentiment(&content);
        let topics = extract_topics(&content, statement);
        Some(UserVoice {
            id: format!("voice-{}", uuid::Uuid::new_v4()),
            user_name: r.author.clone().unwrap_or_else(|| "unknown".into()),
            platform: r.platform.clone(), title: r.title.clone(), content: content.clone(),
            sentiment, topics,
            quote: content.chars().take(80).collect::<String>() + "...",
            strength: EvidenceStrength::Medium, source_url: r.url.clone(),
            timestamp: r.date.clone().unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string()),
        })
    }).collect()
}

async fn extract_competitors(results: &[SearchResult], _statement: &str) -> Vec<Competitor> {
    // Step 1: Filter out non-competitor results (articles, listicles, forum indexes)
    let candidates: Vec<&SearchResult> = results.iter().filter(|r| {
        let t = r.title.to_lowercase();
        !t.is_empty()
            && !t.starts_with("best ") && !t.starts_with("top ")
            && !t.contains(" top ") && !t.contains(" best ")
            && !t.contains("how to") && !t.contains("guide")
            && !t.contains("list of") && !t.contains("comparison")
            && !t.ends_with("reddit") && !t.ends_with("forum")
            && !t.starts_with("r/")
            && t.len() >= 3
    }).collect();

    // Step 2: Normalize names and cluster — P2-2: LLM-assisted dedup, fallback to string similarity
    let names: Vec<String> = candidates.iter().map(|r| r.title.trim().to_string()).collect();
    let clusters = normalization::try_llm_deduplicate_entities(&names).await;

    // Step 3: Build competitor cards from clusters
    let mut competitors = Vec::new();
    for cluster in clusters {
        if cluster.is_empty() { continue; }
        // Use the shortest name as canonical (less likely to be a description)
        let canonical = cluster.iter().min_by_key(|n| n.len()).cloned().unwrap_or_default();
        let name = normalization::normalize_product_name(&canonical);

        // Collect data from all results in this cluster
        let mut all_platforms: Vec<String> = Vec::new();
        let mut max_rating: f64 = 0.0;
        let mut total_reviews: i64 = 0;
        let mut best_summary = String::new();
        let mut best_url = String::new();

        for c_name in &cluster {
            if let Some(result) = candidates.iter().find(|r| r.title.trim() == c_name.as_str()) {
                if !all_platforms.contains(&result.platform) {
                    all_platforms.push(result.platform.clone());
                }
                if let Some(r) = result.rating {
                    if r > max_rating { max_rating = r; }
                }
                total_reviews += result.review_count.unwrap_or(0);
                if result.summary.len() > best_summary.len() {
                    best_summary = result.summary.clone();
                }
                if !result.url.is_empty() && best_url.is_empty() {
                    best_url = result.url.clone();
                }
            }
        }

        let category_group = if all_platforms.iter().any(|p| p.contains("G2") || p.contains("App Store") || p.contains("Product Hunt")) {
            "Direct Competitor".to_string()
        } else {
            "Indirect".to_string()
        };

        competitors.push(Competitor {
            id: format!("comp-{}", uuid::Uuid::new_v4()),
            name,
            url: if best_url.is_empty() { "#".into() } else { best_url },
            positioning: best_summary.chars().take(200).collect(),
            target_user: "待确认".into(),
            core_features: "待分析".into(),
            pricing: "待调研".into(),
            platforms: all_platforms,
            ratings: max_rating,
            reviews_count: total_reviews,
            pros: "待提取".into(),
            cons: "待提取".into(),
            opportunity: "待分析".into(),
            category_group,
            last_updated: None,
        });
    }
    competitors
}

fn infer_sentiment(text: &str) -> Sentiment {
    let lower = text.to_lowercase();
    let neg = ["frustrated", "bad", "terrible", "slow", "bug", "crash", "expensive", "missing", "lack", "poor", "disappointed", "annoying", "useless", "frustrating", "难用", "卡", "差", "烂", "贵", "坑", "不行", "失望", "垃圾", "慢"];
    let pos = ["great", "excellent", "love", "best", "amazing", "perfect", "useful", "fast", "reliable", "推荐", "好用", "好", "棒", "不错", "喜欢", "完美"];
    let nc = neg.iter().filter(|w| lower.contains(&**w)).count();
    let pc = pos.iter().filter(|w| lower.contains(&**w)).count();
    if nc > pc { Sentiment::Negative } else if pc > nc { Sentiment::Positive } else { Sentiment::Neutral }
}

fn extract_topics(text: &str, _statement: &str) -> Vec<String> {
    let mut topics = Vec::new();
    let lower = text.to_lowercase();
    let pairs: Vec<(&str, &str)> = vec![
        ("price","pricing"),("pricing","pricing"),("expensive","pricing"),("cost","pricing"),("贵","pricing"),("价格","pricing"),
        ("slow","performance"),("fast","performance"),("crash","stability"),("bug","stability"),("卡","performance"),("慢","performance"),
        ("ux","usability"),("ui","usability"),("design","usability"),("界面","usability"),("体验","usability"),
        ("feature","features"),("missing","features"),("功能","features"),
        ("support","support"),("customer","support"),("客服","support"),
        ("integrate","integration"),("api","integration"),
    ];
    for (kw, topic) in pairs {
        if lower.contains(kw) && !topics.contains(&topic.to_string()) { topics.push(topic.to_string()); }
    }
    if topics.is_empty() { topics.push("general_feedback".to_string()); }
    topics
}
