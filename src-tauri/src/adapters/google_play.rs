use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct GooglePlayAdapter {
    provider: SearchProvider,
}

impl GooglePlayAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for GooglePlayAdapter {
    fn platform_name(&self) -> &str { "Google Play" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("play.google.com", query, &self.provider).await
        } else {
            try_google_play_direct(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for site:play.google.com".into()
            } else {
                "Google Play direct search available as fallback.".into()
            },
        })
    }
}

/// Direct search using Google Play's store page scraping.
async fn try_google_play_direct(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://play.google.com/store/search?q={}&c=apps",
        urlencoding(query)
    );
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .header("Accept-Language", "en-US,en;q=0.9")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Google Play HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Google Play read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let card_sel = scraper::Selector::parse("div[class*='card'], div[class*='Vpfmgd'], c-wiz > div > div").unwrap();
    let name_sel = scraper::Selector::parse("span[class*='DdYX5'], div[class*='WsMG1c'], span[class*='title']").unwrap();
    let dev_sel = scraper::Selector::parse("span[class*='wMUdtb'], div[class*='KoLSrc']").unwrap();
    let rating_sel = scraper::Selector::parse("div[class*='rating'], span[class*='w2kbF']").unwrap();

    for card in document.select(&card_sel) {
        let title = card.select(&name_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.len() < 2 { continue; }
        let author = card.select(&dev_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string());
        let rating_text = card.select(&rating_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating = rating_text.parse::<f64>().ok();
        results.push(SearchResult {
            title, url: String::new(),
            summary: author.clone().unwrap_or_default(),
            rating, review_count: None, date: None, author,
            platform: "Google Play".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
