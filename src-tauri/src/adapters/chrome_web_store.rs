use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct ChromeWebStoreAdapter {
    provider: SearchProvider,
}

impl ChromeWebStoreAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for ChromeWebStoreAdapter {
    fn platform_name(&self) -> &str { "Chrome Web Store" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("chromewebstore.google.com", query, &self.provider).await
        } else {
            try_cws_direct_search(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for Chrome Web Store".into()
            } else {
                "Chrome Web Store requires search API key.".into()
            },
        })
    }
}

/// Direct search using Chrome Web Store's public search API.
async fn try_cws_direct_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://chromewebstore.google.com/search/{}",
        urlencoding(query)
    );
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .header("Accept", "text/html")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("CWS HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("CWS read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let item_sel = scraper::Selector::parse("div[class*='card'], div[class*='item'], div[class*='extension']").unwrap();
    let name_sel = scraper::Selector::parse("h2, h3, [class*='name'], [class*='title']").unwrap();
    let desc_sel = scraper::Selector::parse("p, [class*='description']").unwrap();
    let rating_sel = scraper::Selector::parse("[class*='rating'], [class*='star']").unwrap();

    for item in document.select(&item_sel) {
        let title = item.select(&name_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.len() < 2 { continue; }
        let summary = item.select(&desc_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating_text = item.select(&rating_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating = rating_text.parse::<f64>().ok();
        results.push(SearchResult {
            title, url: String::new(), summary, rating,
            review_count: None, date: None, author: None,
            platform: "Chrome Web Store".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
