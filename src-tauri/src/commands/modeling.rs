use crate::models::*;
use crate::worker;

/// Re-run idea modeling through LLM and return updated extension data.
#[tauri::command]
pub async fn reanalyze_idea_model(
    statement: String,
    target_user: String,
    scenario: String,
    language: Option<String>,
) -> Result<IdeaModelExtension, String> {
    let combined = if !target_user.is_empty() && !scenario.is_empty() {
        format!("{}\nTarget user: {}\nScenario: {}", statement, target_user, scenario)
    } else if !target_user.is_empty() {
        format!("{}\nTarget user: {}", statement, target_user)
    } else {
        statement.clone()
    };
    let lang = language.unwrap_or_else(|| "zh".to_string());
    Ok(worker::try_llm_model_idea(&combined, "", &lang).await)
}
