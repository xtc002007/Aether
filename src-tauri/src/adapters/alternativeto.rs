use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct AlternativeToAdapter {
    provider: SearchProvider,
}

impl AlternativeToAdapter {
    pub fn new(provider: SearchProvider) -> Self { Self { provider } }
}

#[async_trait]
impl PlatformAdapter for AlternativeToAdapter {
    fn platform_name(&self) -> &str { "AlternativeTo" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            return super::search_provider::site_search("alternativeto.net", query, &self.provider).await;
        }
        try_direct_scrape(query).await
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        if self.provider == SearchProvider::None {
            Ok(super::traits::HealthStatus {
                available: false,
                message: "AlternativeTo may work via direct scrape; search API key recommended.".into(),
            })
        } else {
            Ok(super::traits::HealthStatus { available: true, message: "Using search provider.".into() })
        }
    }
}

async fn try_direct_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://alternativeto.net/browse/search/?q={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .header("Accept", "text/html")
        .timeout(std::time::Duration::from_secs(10))
        .send().await.map_err(|e| format!("AlternativeTo HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("AlternativeTo read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let app_sel = scraper::Selector::parse("li[class*='app'], div[class*='ListItem'], div[class*='result']").unwrap();
    let name_sel = scraper::Selector::parse("h2, h3, a[class*='name'], [class*='title']").unwrap();
    let desc_sel = scraper::Selector::parse("p, [class*='description']").unwrap();
    let likes_sel = scraper::Selector::parse("[class*='like'], [class*='vote'], [class*='count']").unwrap();

    for app in document.select(&app_sel) {
        let title = app.select(&name_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.is_empty() { continue; }
        let summary = app.select(&desc_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let likes = app.select(&likes_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default()
            .parse::<i64>().ok();
        results.push(SearchResult { title, url: String::new(), summary, rating: None, review_count: likes, date: None, author: None, platform: "AlternativeTo".into(), content_text: None });
        if results.len() >= 15 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
