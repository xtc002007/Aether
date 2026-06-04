pub mod deepseek;

use async_trait::async_trait;
use serde::de::DeserializeOwned;

#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Raw chat completion — returns the model's text response.
    async fn chat(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        temperature: f64,
    ) -> Result<String, String>;

    /// Structured completion — prompt the model to output valid JSON matching T.
    async fn structured<T: DeserializeOwned + Send>(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<T, String>;
}

/// Convenience: build a system prompt that forces JSON-only output.
pub fn json_system_prompt(schema_desc: &str) -> String {
    format!(
        "You are a precise research analyst. Output ONLY valid JSON. No markdown, no explanation.\nExpected JSON schema:\n{}",
        schema_desc
    )
}

/// Returns a language instruction string for output formatting.
/// Used in LLM prompts to control the language of generated content.
pub fn language_instruction(lang: &str) -> &'static str {
    match lang {
        "en" => "Write all output in English.",
        _ => "Write all output in Chinese (中文).",
    }
}

/// Returns the display name of a language code.
pub fn language_name(lang: &str) -> &'static str {
    match lang {
        "en" => "English",
        "zh" => "Chinese",
        _ => "Chinese",
    }
}
