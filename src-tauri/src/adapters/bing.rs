use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct BingAdapter {
    provider: SearchProvider,
}

impl BingAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for BingAdapter {
    fn platform_name(&self) -> &str { "Bing" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::web_search(query, &self.provider).await
        } else {
            try_bing_direct_scrape(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        if self.provider == SearchProvider::None {
            return Ok(super::traits::HealthStatus {
                available: false,
                message: "No search API key configured. Set SERP_API_KEY or SERPER_API_KEY.".into(),
            });
        }
        Ok(super::traits::HealthStatus { available: true, message: "Using search provider for Bing".into() })
    }
}

async fn try_bing_direct_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.bing.com/search?q={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Bing HTTP error: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Bing read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();
    let result_sel = scraper::Selector::parse("li.b_algo, div.b_algo").unwrap();
    let link_sel = scraper::Selector::parse("a[href^='http']").unwrap();
    let title_sel = scraper::Selector::parse("h2").unwrap();
    let snippet_sel = scraper::Selector::parse("p, div.b_caption p").unwrap();
    for block in document.select(&result_sel) {
        let title = block.select(&title_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
        if title.is_empty() { continue; }
        let url = block.select(&link_sel).next()
            .and_then(|el| el.value().attr("href")).unwrap_or("").to_string();
        let summary = block.select(&snippet_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
        results.push(SearchResult {
            title, url, summary,
            rating: None, review_count: None, date: None, author: None,
            platform: "Bing".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
