use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct G2Adapter {
    provider: SearchProvider,
}

impl G2Adapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for G2Adapter {
    fn platform_name(&self) -> &str { "G2 / Capterra" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        // G2 is JS-rendered, cannot be scraped. Use search provider with site:g2.com.
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("g2.com", query, &self.provider).await
        } else {
            // Fallback: try Capterra which may be more scrapeable
            try_capterra_scrape(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        if self.provider == SearchProvider::None {
            Ok(super::traits::HealthStatus {
                available: false,
                message: "G2 requires search API key; Capterra fallback may work.".into(),
            })
        } else {
            Ok(super::traits::HealthStatus { available: true, message: "Using search provider for site:g2.com".into() })
        }
    }
}

async fn try_capterra_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let search_url = format!("https://www.capterra.com/search/?query={}", urlencoding(query));
    let resp = client.get(&search_url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Capterra HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Capterra read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let card_sel = scraper::Selector::parse("div[class*='card'], div[class*='listing'], article").unwrap();
    let name_sel = scraper::Selector::parse("h2, h3, [class*='title'], [class*='name']").unwrap();
    let desc_sel = scraper::Selector::parse("p, [class*='description']").unwrap();
    let rating_sel = scraper::Selector::parse("[class*='rating'], [class*='stars']").unwrap();

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
            title, url: String::new(), summary, rating, review_count: None,
            date: None, author: None, platform: "Capterra".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
