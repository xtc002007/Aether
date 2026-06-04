use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct LinkedInAdapter {
    provider: SearchProvider,
}

impl LinkedInAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for LinkedInAdapter {
    fn platform_name(&self) -> &str { "LinkedIn" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        match self.provider {
            SearchProvider::SerpApi => serpapi_linkedin_search(query).await,
            SearchProvider::Serper => serper_site_search(query, "linkedin.com", "LinkedIn").await,
            SearchProvider::None => Err("No search provider configured. Set SERP_API_KEY for LinkedIn search.".into()),
        }
    }
}

/// Search LinkedIn posts and articles via SerpAPI (cached linkedin results).
async fn serpapi_linkedin_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERP_API_KEY")
        .map_err(|_| "SERP_API_KEY not set".to_string())?;
    // LinkedIn doesn't have a dedicated SerpAPI engine, use site:linkedin.com on Google
    let search_query = format!("site:linkedin.com {}", query);
    let url = format!(
        "https://serpapi.com/search?engine=google&q={}&api_key={}&num=10&gl=us&hl=en",
        urlencoding(&search_query), api_key
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("LinkedIn SerpAPI HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("LinkedIn SerpAPI JSON: {}", e))?;

    let mut results = Vec::new();
    if let Some(organic) = json["organic_results"].as_array() {
        for r in organic {
            let title = r["title"].as_str().unwrap_or("").to_string();
            let link = r["link"].as_str().unwrap_or("").to_string();
            let snippet = r["snippet"].as_str().unwrap_or("").to_string();
            if title.is_empty() { continue; }
            results.push(SearchResult {
                title: title.clone(),
                url: link,
                summary: snippet.clone(),
                rating: None, review_count: None, date: None, author: None,
                platform: "LinkedIn".into(),
                content_text: Some(format!("{}\n{}", title, snippet)),
            });
        }
    }
    Ok(results)
}

async fn serper_site_search(query: &str, domain: &str, platform: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERPER_API_KEY")
        .map_err(|_| "SERPER_API_KEY not set".to_string())?;
    let client = reqwest::Client::new();
    let search_query = format!("site:{} {}", domain, query);
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
            let title = r["title"].as_str().unwrap_or("").to_string();
            let link = r["link"].as_str().unwrap_or("").to_string();
            let snippet = r["snippet"].as_str().unwrap_or("").to_string();
            if title.is_empty() { continue; }
            results.push(SearchResult {
                title: title.clone(),
                url: link,
                summary: snippet.clone(),
                rating: None, review_count: None, date: None, author: None,
                platform: platform.to_string(),
                content_text: Some(format!("{}\n{}", title, snippet)),
            });
        }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
