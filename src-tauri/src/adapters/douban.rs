use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct DoubanAdapter {
    provider: SearchProvider,
}

impl DoubanAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for DoubanAdapter {
    fn platform_name(&self) -> &str { "Douban" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("douban.com", query, &self.provider).await
        } else {
            try_douban_direct_search(query).await
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "使用搜索提供者搜索 site:douban.com".into()
            } else {
                "豆瓣直接搜索作为备用方案可用。".into()
            },
        })
    }
}

async fn try_douban_direct_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.douban.com/search?q={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("Douban HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("Douban read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();

    let result_sel = scraper::Selector::parse("div.result, div[class*='result'], div[class*='item']").unwrap();
    let title_sel = scraper::Selector::parse("h3, div.title, a[class*='title']").unwrap();
    let desc_sel = scraper::Selector::parse("p, span[class*='desc'], span[class*='abstract']").unwrap();
    let rating_sel = scraper::Selector::parse("span[class*='rating'], span[class*='star']").unwrap();

    for item in document.select(&result_sel) {
        let title = item.select(&title_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.is_empty() { continue; }
        let summary = item.select(&desc_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating_text = item.select(&rating_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let rating = rating_text.parse::<f64>().ok();
        results.push(SearchResult {
            title, url: String::new(), summary, rating,
            review_count: None, date: None, author: None,
            platform: "Douban".into(), content_text: None,
        });
        if results.len() >= 10 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
