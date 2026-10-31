use super::deepseek::DeepSeekProvider;
use super::platform::{get_platform_auth, PlatformLlm};
use super::LlmProvider;
use async_trait::async_trait;

pub enum ResolvedLlm {
    DeepSeek(DeepSeekProvider),
    Platform(PlatformLlm),
}

impl ResolvedLlm {
    pub fn resolve() -> Result<Self, String> {
        if let Ok(p) = DeepSeekProvider::from_env() {
            return Ok(ResolvedLlm::DeepSeek(p));
        }
        if let Some(auth) = get_platform_auth() {
            return Ok(ResolvedLlm::Platform(PlatformLlm::new(auth)));
        }
        Err("Configure DEEPSEEK_API_KEY or sign in with an active NexusTools subscription for platform AI.".into())
    }
}

#[async_trait]
impl LlmProvider for ResolvedLlm {
    async fn chat(&self, system_prompt: &str, user_prompt: &str, temperature: f64) -> Result<String, String> {
        match self {
            ResolvedLlm::DeepSeek(p) => p.chat(system_prompt, user_prompt, temperature).await,
            ResolvedLlm::Platform(p) => {
                let messages = vec![
                    serde_json::json!({"role": "system", "content": system_prompt}),
                    serde_json::json!({"role": "user", "content": user_prompt}),
                ];
                let (text, _) = p.chat_raw(messages).await?;
                Ok(text)
            }
        }
    }

    async fn structured<T: serde::de::DeserializeOwned + Send>(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<T, String> {
        match self {
            ResolvedLlm::DeepSeek(p) => p.structured(system_prompt, user_prompt).await,
            ResolvedLlm::Platform(p) => {
                let messages = vec![
                    serde_json::json!({"role": "system", "content": system_prompt}),
                    serde_json::json!({"role": "user", "content": user_prompt}),
                ];
                let (text, _) = p.chat_raw(messages).await?;
                let cleaned = text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```");
                serde_json::from_str(cleaned).map_err(|e| format!("JSON parse error: {e}"))
            }
        }
    }
}
