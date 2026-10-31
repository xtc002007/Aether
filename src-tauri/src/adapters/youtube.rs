use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};
use super::search_provider;

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
            SearchProvider::Serper | SearchProvider::None => {
                let mut results = search_provider::site_search("youtube.com", query, &self.provider).await?;
                for r in &mut results {
                    r.platform = "YouTube".into();
                }
                Ok(results)
            }
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

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
