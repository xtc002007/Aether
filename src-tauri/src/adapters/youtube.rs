use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct YouTubeAdapter {
    provider: SearchProvider,
}

impl YouTubeAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for YouTubeAdapter {
    fn platform_name(&self) -> &str { "YouTube" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        match self.provider {
            SearchProvider::SerpApi => serpapi_youtube_search(query).await,
            SearchProvider::Serper => serper_fallback(query, "YouTube").await,
            SearchProvider::None => Err("No search provider configured. Set SERP_API_KEY for YouTube search.".into()),
        }
    }
}

async fn serpapi_youtube_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERP_API_KEY")
        .map_err(|_| "SERP_API_KEY not set".to_string())?;
    let url = format!(
        "https://serpapi.com/search?engine=youtube&search_query={}&api_key={}&gl=us&hl=en",
        urlencoding(query), api_key
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("YouTube SerpAPI HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("YouTube SerpAPI JSON: {}", e))?;

    let mut results = Vec::new();
    if let Some(videos) = json["video_results"].as_array() {
        for v in videos {
            let title = v["title"].as_str().unwrap_or("").to_string();
            let link = v["link"].as_str().unwrap_or("").to_string();
            let snippet = v["snippet"].as_str().unwrap_or("").to_string();
            let published = v["published_date"].as_str().map(|s| s.to_string());
            let channel = v["channel"]["name"].as_str().map(|s| s.to_string());
            results.push(SearchResult {
                title: title.clone(),
                url: link,
                summary: snippet.clone(),
                rating: None,
                review_count: None,
                date: published,
                author: channel,
                platform: "YouTube".into(),
                content_text: Some(format!("{}\n{}", title, snippet)),
            });
        }
    }
    Ok(results)
}

async fn serper_fallback(query: &str, platform: &str) -> Result<Vec<SearchResult>, String> {
    // Fallback: search via Serper.dev with site:youtube.com
    let api_key = std::env::var("SERPER_API_KEY")
        .map_err(|_| "SERPER_API_KEY not set".to_string())?;
    let client = reqwest::Client::new();
    let search_query = format!("site:youtube.com {}", query);
    let body = serde_json::json!({"q": search_query, "num": 10, "gl": "us", "hl": "en"});
    let resp = client.post("https://google.serper.dev/search")
        .header("X-API-KEY", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("Serper HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Serper JSON: {}", e))?;
    let mut results = Vec::new();
    if let Some(organic) = json["organic"].as_array() {
        for r in organic {
            results.push(SearchResult {
                title: r["title"].as_str().unwrap_or("").to_string(),
                url: r["link"].as_str().unwrap_or("").to_string(),
                summary: r["snippet"].as_str().unwrap_or("").to_string(),
                rating: None, review_count: None, date: None, author: None,
                platform: platform.to_string(),
                content_text: r["snippet"].as_str().map(|s| s.to_string()),
            });
        }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
