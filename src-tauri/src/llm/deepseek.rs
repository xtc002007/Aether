use super::LlmProvider;
use async_trait::async_trait;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub struct DeepSeekProvider {
    api_key: String,
    client: reqwest::Client,
    model: String,
}

impl DeepSeekProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
            model: "deepseek-chat".to_string(),
        }
    }

    pub fn from_env() -> Result<Self, String> {
        let api_key = std::env::var("DEEPSEEK_API_KEY")
            .or_else(|_| {
                // Fallback: read from .env file in app data dir
                let app_data = get_app_data_dir();
                let env_path = app_data.join(".env");
                if env_path.exists() {
                    let content = std::fs::read_to_string(&env_path).unwrap_or_default();
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if let Some(rest) = trimmed.strip_prefix("DEEPSEEK_API_KEY=") {
                            return Ok(rest.trim().trim_matches('"').to_string());
                        }
                    }
                }
                Err("DEEPSEEK_API_KEY not set".to_string())
            })?;
        Ok(Self::new(api_key))
    }
}

fn get_app_data_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(|p| std::path::PathBuf::from(p).join("Aether"))
            .unwrap_or_else(|_| std::path::PathBuf::from("./data"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .map(|p| std::path::PathBuf::from(p).join("Library").join("Application Support").join("Aether"))
            .unwrap_or_else(|_| std::path::PathBuf::from("./data"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME")
            .map(|p| std::path::PathBuf::from(p).join(".aether"))
            .unwrap_or_else(|_| std::path::PathBuf::from("./data"))
    }
}

#[async_trait]
impl LlmProvider for DeepSeekProvider {
    async fn chat(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        temperature: f64,
    ) -> Result<String, String> {
        let body = serde_json::json!({
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": 4096,
            "stream": false
        });

        let resp = self.client
            .post("https://api.deepseek.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| format!("DeepSeek HTTP error: {}", e))?;

        let status = resp.status();
        let json: Value = resp.json().await.map_err(|e| format!("DeepSeek JSON parse error: {}", e))?;

        if !status.is_success() {
            let err_msg = json["error"]["message"]
                .as_str()
                .unwrap_or("Unknown API error");
            return Err(format!("DeepSeek API error ({}): {}", status.as_u16(), err_msg));
        }

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| "DeepSeek response missing content".to_string())?;

        Ok(content.to_string())
    }

    async fn structured<T: DeserializeOwned + Send>(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<T, String> {
        let text = self.chat(system_prompt, user_prompt, 0.1).await?;
        // Extract JSON from response — the model may wrap it in ```json ... ```
        let json_str = if let Some(start) = text.find("```json") {
            let after = &text[start + 7..];
            if let Some(end) = after.find("```") {
                &after[..end]
            } else {
                after
            }
        } else if let Some(start) = text.find('{') {
            &text[start..]
        } else {
            &text
        };

        let trimmed = json_str.trim();
        serde_json::from_str::<T>(trimmed)
            .map_err(|e| format!("Failed to parse structured response: {}\nRaw: {}", e, trimmed))
    }
}
