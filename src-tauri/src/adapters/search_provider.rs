//! Search provider abstraction — supports SerpAPI and Serper.dev.
//! Used by adapters that need general web search (Google, site:domain queries).

use super::types::{SearchProvider, SearchResult};

/// Execute a web search query through the configured provider.
/// Returns structured search results from SERP.
pub async fn web_search(
    query: &str,
    provider: &SearchProvider,
) -> Result<Vec<SearchResult>, String> {
    match provider {
        SearchProvider::SerpApi => serpapi_search(query).await,
        SearchProvider::Serper => serper_search(query).await,
        SearchProvider::None => Err("No search provider configured. Set SERP_API_KEY or SERPER_API_KEY.".into()),
    }
}

/// Search with site:domain filter using the search provider.
pub async fn site_search(
    domain: &str,
    query: &str,
    provider: &SearchProvider,
) -> Result<Vec<SearchResult>, String> {
    let full_query = format!("site:{} {}", domain, query);
    let mut results = web_search(&full_query, provider).await?;
    for r in &mut results {
        r.platform = domain.to_string();
    }
    Ok(results)
}

// ── SerpAPI implementation ──

async fn serpapi_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERP_API_KEY")
        .map_err(|_| "SERP_API_KEY not set".to_string())?;
    let url = format!(
        "https://serpapi.com/search?engine=google&q={}&api_key={}&num=15&gl=us&hl=en",
        urlencoding(query), api_key
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("SerpAPI HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("SerpAPI JSON: {}", e))?;

    let mut results = Vec::new();
    if let Some(organic) = json["organic_results"].as_array() {
        for r in organic {
            results.push(SearchResult {
                title: r["title"].as_str().unwrap_or("").to_string(),
                url: r["link"].as_str().unwrap_or("").to_string(),
                summary: r["snippet"].as_str().unwrap_or("").to_string(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Google Search".into(),
                content_text: r["snippet"].as_str().map(|s| s.to_string()),
            });
        }
    }
    Ok(results)
}

// ── Serper.dev implementation ──

async fn serper_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERPER_API_KEY")
        .map_err(|_| "SERPER_API_KEY not set".to_string())?;
    let client = reqwest::Client::new();
    let body = serde_json::json!({"q": query, "num": 15, "gl": "us", "hl": "en"});
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
                platform: "Google Search".into(),
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
