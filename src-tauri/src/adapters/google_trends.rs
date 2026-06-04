use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct GoogleTrendsAdapter {
    provider: SearchProvider,
}

impl GoogleTrendsAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for GoogleTrendsAdapter {
    fn platform_name(&self) -> &str { "Google Trends" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("trends.google.com", query, &self.provider).await
        } else {
            try_trends_direct(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for Google Trends".into()
            } else {
                "Google Trends requires search API key for full functionality.".into()
            },
        })
    }
}

/// Use Google Trends explore endpoint to get interest-over-time data.
async fn try_trends_direct(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://trends.google.com/trends/explore?q={}&geo=US",
        urlencoding(query)
    );
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Trends HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Trends read: {}", e))?;

    let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
    Ok(vec![SearchResult {
        title: format!("Google Trends data for: {}", query),
        url: format!("https://trends.google.com/trends/explore?q={}", urlencoding(query)),
        summary: format!("Trend interest data captured at {}. Raw HTML length: {} chars. Use the URL to view full trend charts.", now, html.len()),
        rating: None, review_count: None, date: Some(now), author: None,
        platform: "Google Trends".into(),
        content_text: Some(html.chars().take(2000).collect()),
    }])
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
