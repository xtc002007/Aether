use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct TrustpilotAdapter {
    provider: SearchProvider,
}

impl TrustpilotAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for TrustpilotAdapter {
    fn platform_name(&self) -> &str { "Trustpilot" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("trustpilot.com", query, &self.provider).await
        } else {
            try_trustpilot_direct_scrape(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for site:trustpilot.com".into()
            } else {
                "Trustpilot may work with direct scraping as fallback.".into()
            },
        })
    }
}

async fn try_trustpilot_direct_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.trustpilot.com/search?query={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Trustpilot HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Trustpilot read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let card_sel = scraper::Selector::parse("div[class*='search-result'], div[class*='business-unit-card'], article").unwrap();
    let name_sel = scraper::Selector::parse("h2, h3, [class*='name'], [class*='title'], a[class*='link']").unwrap();
    let rating_sel = scraper::Selector::parse("[class*='rating'], [class*='star'], [class*='score']").unwrap();
    let desc_sel = scraper::Selector::parse("p, [class*='description']").unwrap();

    for card in document.select(&card_sel) {
        let title = card.select(&name_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.is_empty() { continue; }
        let summary = card.select(&desc_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating_text = card.select(&rating_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating = rating_text.parse::<f64>().ok();
        results.push(SearchResult {
            title, url: String::new(), summary, rating,
            review_count: None, date: None, author: None,
            platform: "Trustpilot".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
