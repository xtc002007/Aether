use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct ZhihuAdapter {
    provider: SearchProvider,
}

impl ZhihuAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for ZhihuAdapter {
    fn platform_name(&self) -> &str { "Zhihu" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        match self.provider {
            SearchProvider::None => direct_zhihu_scrape(query).await,
            // For Zhihu, prefer direct scrape since SerpAPI doesn't have a dedicated engine
            // But if API keys are present, use site:zhihu.com search as fallback
            SearchProvider::SerpApi => {
                match serpapi_zhihu_search(query).await {
                    Ok(results) if !results.is_empty() => Ok(results),
                    _ => direct_zhihu_scrape(query).await,
                }
            }
            SearchProvider::Serper => {
                match serper_zhihu_search(query).await {
                    Ok(results) if !results.is_empty() => Ok(results),
                    _ => direct_zhihu_scrape(query).await,
                }
            }
        }
    }
}

async fn serpapi_zhihu_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERP_API_KEY")
        .map_err(|_| "SERP_API_KEY not set".to_string())?;
    let search_query = format!("site:zhihu.com {}", query);
    let url = format!(
        "https://serpapi.com/search?engine=google&q={}&api_key={}&num=10&gl=cn&hl=zh-cn",
        urlencoding(&search_query), api_key
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("Zhihu SerpAPI HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Zhihu SerpAPI JSON: {}", e))?;
    let mut results = Vec::new();
    if let Some(organic) = json["organic_results"].as_array() {
        for r in organic {
            results.push(SearchResult {
                title: r["title"].as_str().unwrap_or("").to_string(),
                url: r["link"].as_str().unwrap_or("").to_string(),
                summary: r["snippet"].as_str().unwrap_or("").to_string(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Zhihu".into(),
                content_text: r["snippet"].as_str().map(|s| s.to_string()),
            });
        }
    }
    Ok(results)
}

async fn serper_zhihu_search(query: &str) -> Result<Vec<SearchResult>, String> {
    let api_key = std::env::var("SERPER_API_KEY")
        .map_err(|_| "SERPER_API_KEY not set".to_string())?;
    let client = reqwest::Client::new();
    let search_query = format!("site:zhihu.com {}", query);
    let body = serde_json::json!({"q": search_query, "num": 10, "gl": "cn", "hl": "zh-cn"});
    let resp = client.post("https://google.serper.dev/search")
        .header("X-API-KEY", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send().await.map_err(|e| format!("Serper HTTP: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Serper JSON: {}", e))?;
    let mut results = Vec::new();
    if let Some(organic) = json["organic"].as_array() {
        for r in organic {
            results.push(SearchResult {
                title: r["title"].as_str().unwrap_or("").to_string(),
                url: r["link"].as_str().unwrap_or("").to_string(),
                summary: r["snippet"].as_str().unwrap_or("").to_string(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Zhihu".into(),
                content_text: r["snippet"].as_str().map(|s| s.to_string()),
            });
        }
    }
    Ok(results)
}

/// Direct Zhihu search page scraping — extracts Q&A snippets from the search results page.
async fn direct_zhihu_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.zhihu.com/search?type=content&q={}", urlencoding(query));
    let resp = match client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept-Language", "zh-CN,zh;q=0.9")
        .timeout(std::time::Duration::from_secs(15))
        .send().await
    {
        Ok(r) => r,
        Err(e) => return Err(format!("Zhihu HTTP error: {}", e)),
    };
    let html = resp.text().await.map_err(|e| format!("Zhihu read error: {}", e))?;
    let document = scraper::Html::parse_document(&html);

    let mut results = Vec::new();
    // Zhihu search results are in div.List-item or div.SearchResult-Card
    let item_sel = scraper::Selector::parse("div.List-item, div.SearchResult-Card, div[class*='search-result'], a[data-za-detail-view-element_name='Title']").unwrap();
    let link_sel = scraper::Selector::parse("a[href^='/question/'], a[href^='/answer/'], a[href^='https://www.zhihu.com/question/'], a[href^='https://zhuanlan.zhihu.com/']").unwrap();
    let content_sel = scraper::Selector::parse("div.RichText, div[class*='summary'], div[class*='content'], span[class*='highlight']").unwrap();

    for item in document.select(&item_sel) {
        let title_text: String = item.select(&link_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join(""))
            .unwrap_or_default();
        let link = item.select(&link_sel).next()
            .and_then(|el| el.value().attr("href"))
            .map(|href| {
                if href.starts_with("http") { href.to_string() }
                else { format!("https://www.zhihu.com{}", href) }
            })
            .unwrap_or_default();

        let snippet: String = item.select(&content_sel)
            .map(|el| el.text().collect::<Vec<_>>().join(""))
            .collect::<Vec<_>>()
            .join(" ");

        let display_title = if title_text.is_empty() {
            snippet.chars().take(60).collect::<String>() + "..."
        } else {
            title_text
        };

        if !display_title.is_empty() && !link.is_empty() {
            results.push(SearchResult {
                title: display_title.clone(),
                url: link,
                summary: snippet.clone(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Zhihu".into(),
                content_text: Some(format!("{}\n{}", display_title, snippet)),
            });
        }
        if results.len() >= 10 { break; }
    }
    if results.is_empty() {
        return Err("Zhihu returned no parseable results. The page structure may have changed.".into());
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
