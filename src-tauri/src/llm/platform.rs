use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlatformAuth {
    pub api_url: String,
    pub jwt: String,
    pub app_id: String,
    pub device_id: String,
}

static PLATFORM_AUTH: OnceLock<Mutex<Option<PlatformAuth>>> = OnceLock::new();

fn store() -> &'static Mutex<Option<PlatformAuth>> {
    PLATFORM_AUTH.get_or_init(|| Mutex::new(None))
}

pub fn set_platform_auth(auth: Option<PlatformAuth>) {
    if let Ok(mut guard) = store().lock() {
        *guard = auth;
    }
}

pub fn get_platform_auth() -> Option<PlatformAuth> {
    store().lock().ok()?.clone()
}

pub struct PlatformLlm {
    auth: PlatformAuth,
    client: reqwest::Client,
}

impl PlatformLlm {
    pub fn new(auth: PlatformAuth) -> Self {
        Self {
            auth,
            client: reqwest::Client::new(),
        }
    }

    pub async fn chat_raw(&self, messages: Vec<serde_json::Value>) -> Result<(String, serde_json::Value), String> {
        let url = format!("{}/api/services/v1/invoke", self.auth.api_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "appId": self.auth.app_id,
            "deviceId": self.auth.device_id,
            "service": "llm",
            "route": "deepseek-chat",
            "payload": { "messages": messages },
            "stream": false,
        });
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.auth.jwt))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Platform LLM request failed: {e}"))?;

        let status = resp.status();
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(data["error"].as_str().unwrap_or("Platform LLM error").to_string());
        }
        let text = data["result"]["text"].as_str().unwrap_or("").to_string();
        Ok((text, data))
    }

    pub async fn search(&self, query: &str) -> Result<Vec<serde_json::Value>, String> {
        let url = format!("{}/api/services/v1/invoke", self.auth.api_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "appId": self.auth.app_id,
            "deviceId": self.auth.device_id,
            "service": "search",
            "route": "serper-search",
            "payload": { "query": query },
        });
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.auth.jwt))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Platform search request failed: {e}"))?;

        let status = resp.status();
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(data["error"].as_str().unwrap_or("Platform search error").to_string());
        }
        Ok(data["result"]["organic"].as_array().cloned().unwrap_or_default())
    }
}
