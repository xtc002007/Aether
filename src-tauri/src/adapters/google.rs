use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct GoogleAdapter {
    provider: SearchProvider,
}

impl GoogleAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for GoogleAdapter {
    fn platform_name(&self) -> &str { "Google Search" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider == SearchProvider::None {
            // Try direct scraping as last resort (will likely fail on Google)
            return direct_google_scrape(query).await;
        }
        super::search_provider::web_search(query, &self.provider).await
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        if self.provider == SearchProvider::None {
            return Ok(super::traits::HealthStatus {
                available: false,
                message: "No search API key configured. Set SERP_API_KEY or SERPER_API_KEY for reliable Google search.".into(),
            });
        }
        // Quick test search
        match super::search_provider::web_search("test", &self.provider).await {
            Ok(r) => Ok(super::traits::HealthStatus { available: !r.is_empty(), message: format!("{} results", r.len()) }),
            Err(e) => Ok(super::traits::HealthStatus { available: false, message: e }),
        }
    }
}

/// Direct Google HTML scraping fallback — unreliable, violates ToS, included for offline dev.
async fn direct_google_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.google.com/search?q={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Google HTTP error: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Read error: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();
    let result_sel = scraper::Selector::parse("div.g, div.MjjYud").unwrap();
    let link_sel = scraper::Selector::parse("a[href^='http'], a[href^='/url']").unwrap();
    let title_sel = scraper::Selector::parse("h3").unwrap();
    let snippet_sel = scraper::Selector::parse("div[data-sncf], span.aCOpRe, div.VwiC3b").unwrap();
    for block in document.select(&result_sel) {
        let title = block.select(&title_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
        if title.is_empty() { continue; }
        let raw_url = block.select(&link_sel).next()
            .and_then(|el| el.value().attr("href")).unwrap_or("");
        let clean_url = if raw_url.starts_with("/url?") {
            raw_url.split("&sa=").next().unwrap_or("").replace("/url?q=", "")
        } else { raw_url.to_string() };
        let summary = block.select(&snippet_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
        results.push(SearchResult {
            title: title.clone(), url: clean_url, summary,
            rating: None, review_count: None, date: None, author: None,
            platform: "Google Search".into(), content_text: Some(title),
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
