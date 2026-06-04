use crate::models::*;
use tauri::State;
use crate::commands::AppState;

#[tauri::command]
pub async fn get_export_history(state: State<'_, AppState>) -> Result<Vec<ExportRecord>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, project_id, format, generated_at FROM reports ORDER BY generated_at DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let records = stmt
        .query_map([], |row| {
            Ok(ExportRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                format: row.get(2)?,
                generated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(records)
}

#[tauri::command]
pub async fn export_report(
    state: State<'_, AppState>,
    project_id: String,
    format: String,
) -> Result<ReportContent, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let json_str: String = conn
        .query_row("SELECT data_json FROM projects WHERE id = ?1", rusqlite::params![project_id], |row| row.get(0))
        .map_err(|e| format!("Project not found: {}", e))?;
    let project: ResearchProject = serde_json::from_str(&json_str).map_err(|e| format!("Parse error: {}", e))?;

    let markdown = build_markdown_report(&project);
    let html = build_html_report(&project);
    let json = serde_json::to_string_pretty(&project).unwrap_or_default();
    let now_str = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let snapshot = serde_json::json!({
        "platform_weights": project.platform_weights,
        "enabled_platforms": project.enabled_platforms,
        "research_mode": serde_json::to_string(&project.research_mode).unwrap_or_default(),
        "region": project.region, "language": project.language,
        "generated_at": now_str,
    });
    let snapshot_id = format!("snap-{}", uuid::Uuid::new_v4());
    conn.execute("INSERT OR REPLACE INTO config_snapshots (id, project_id, snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4)", rusqlite::params![snapshot_id, project_id, snapshot.to_string(), now_str]).map_err(|e| e.to_string())?;

    let report_id = format!("rpt-{}", uuid::Uuid::new_v4());
    conn.execute("INSERT OR REPLACE INTO reports (id, project_id, format, content, config_snapshot, generated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", rusqlite::params![report_id, project_id, format, markdown, snapshot.to_string(), now_str]).map_err(|e| e.to_string())?;

    Ok(ReportContent { markdown, html, json })
}

fn build_markdown_report(project: &ResearchProject) -> String {
    let mut md = format!("# {} - 产品想法研究情报报告\n\n", project.name);
    md.push_str(&format!("- **生成时间**: {}\n", project.updated_at));
    md.push_str(&format!("- **置信度**: {}%\n", project.evaluation.confidence_score));
    md.push_str(&format!("- **总体建议**: {}\n\n", project.evaluation.overall_recommendation));

    md.push_str("## 一、想法建模\n\n");
    md.push_str(&format!("**核心陈述**: {}\n\n", project.idea_model.statement));
    md.push_str(&format!("**目标用户**: {}\n\n", project.idea_model.target_user));
    md.push_str(&format!("**产品形态**: {}\n\n", project.idea_model.product_form));

    md.push_str("## 二、竞品分析\n\n");
    for comp in &project.competitors {
        md.push_str(&format!("### {}\n- 定位: {}\n- 定价: {}\n- 优势: {}\n- 劣势: {}\n- 机会: {}\n\n", comp.name, comp.positioning, comp.pricing, comp.pros, comp.cons, comp.opportunity));
    }

    md.push_str("## 三、九维评估\n\n");
    for dim in &project.evaluation.dimensions {
        md.push_str(&format!("- **{}**: {}/10 - {}\n", dim.name, dim.score, dim.reason));
    }

    md.push_str("\n## 四、策略建议\n\n");
    md.push_str(&format!("**市场局面**: {}\n\n", project.strategy.market_scenario));
    md.push_str(&format!("**建议路径**: {}\n\n", project.strategy.suggested_path));
    md.push_str(&format!("**定位语句**: {}\n\n", project.strategy.positioning_statement));

    md.push_str("## 五、验证计划\n\n");
    for plan in &project.validation_plan {
        md.push_str(&format!("### {} ({})\n- 目标: {}\n- 行动: {}\n\n{}\n\n", plan.category, plan.duration, plan.target, plan.action, plan.details));
    }
    md
}

fn build_html_report(project: &ResearchProject) -> String {
    let template = include_str!("../../resources/report-template.html");
    let dims: String = project.evaluation.dimensions.iter()
        .map(|d| format!("<tr><td>{}</td><td><span class=\"score-bar\" style=\"width:{}px\"></span>{}/10</td><td>{}</td></tr>", d.name, d.score * 12, d.score, d.reason))
        .collect::<Vec<_>>().join("\n");
    let comps: String = project.competitors.iter()
        .map(|c| format!("<div class=\"comp-card\"><h3>{}</h3><p>{}</p><p><span class=\"tag\">Rating: {}</span><span class=\"tag\">Reviews: {}</span><span class=\"tag\">{}</span></p><p><strong>Pros:</strong> {}</p><p><strong>Cons:</strong> {}</p><p><strong>Opportunity:</strong> {}</p></div>", c.name, c.positioning, c.ratings, c.reviews_count, c.pricing, c.pros, c.cons, c.opportunity))
        .collect::<Vec<_>>().join("\n");
    let validations: String = project.validation_plan.iter()
        .map(|v| format!("<div class=\"action-item\"><h3>{} ({})</h3><p><strong>Target:</strong> {}</p><p><strong>Action:</strong> {}</p><p><strong>Expected:</strong> {}</p><p>{}</p></div>", v.category, v.duration, v.target, v.action, v.expected_assertion, v.details))
        .collect::<Vec<_>>().join("\n");

    template
        .replace("{{PROJECT_NAME}}", &project.name)
        .replace("{{GENERATED_AT}}", &project.updated_at)
        .replace("{{CONFIDENCE}}", &project.evaluation.confidence_score.to_string())
        .replace("{{OVERALL_RECOMMENDATION}}", &project.evaluation.overall_recommendation)
        .replace("{{STATEMENT}}", &project.idea_model.statement)
        .replace("{{TARGET_USER}}", &project.idea_model.target_user)
        .replace("{{PRODUCT_FORM}}", &project.idea_model.product_form)
        .replace("{{CORE_JOB}}", &project.idea_model.core_job)
        .replace("{{COMPETITOR_COUNT}}", &project.competitors.len().to_string())
        .replace("{{COMPETITORS}}", &comps)
        .replace("{{DIMENSIONS}}", &dims)
        .replace("{{MARKET_SCENARIO}}", &project.strategy.market_scenario)
        .replace("{{SUGGESTED_PATH}}", &project.strategy.suggested_path)
        .replace("{{POSITIONING}}", &project.strategy.positioning_statement)
        .replace("{{MUST_HAVE}}", &project.strategy.must_have_features.join(", "))
        .replace("{{AVOID}}", &project.strategy.avoid_features.join(", "))
        .replace("{{VALIDATION_PLAN}}", &validations)
}
