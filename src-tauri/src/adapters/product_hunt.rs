use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct ProductHuntAdapter {
    provider: SearchProvider,
}

impl ProductHuntAdapter {
    pub fn new(provider: SearchProvider) -> Self { Self { provider } }
}

#[async_trait]
impl PlatformAdapter for ProductHuntAdapter {
    fn platform_name(&self) -> &str { "Product Hunt" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        // Try PH API if token is set, else use search provider
        if let Ok(token) = std::env::var("PH_API_TOKEN") {
            return try_ph_api(query, &token).await;
        }
        if self.provider != SearchProvider::None {
            return super::search_provider::site_search("producthunt.com", query, &self.provider).await;
        }
        try_ph_direct_scrape(query).await
    }
}

async fn try_ph_api(query: &str, token: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "query": format!("query {{ posts(search:\"{}\", first:15) {{ edges {{ node {{ id name tagline url votesCount createdAt }} }} }} }}", query)
    });
    let resp = client.post("https://api.producthunt.com/v2/api/graphql")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send().await.map_err(|e| format!("PH API: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("PH JSON: {}", e))?;
    let mut results = Vec::new();
    if let Some(edges) = json["data"]["posts"]["edges"].as_array() {
        for edge in edges {
            let node = &edge["node"];
            results.push(SearchResult {
                title: node["name"].as_str().unwrap_or("").to_string(),
                url: node["url"].as_str().unwrap_or("").to_string(),
                summary: node["tagline"].as_str().unwrap_or("").to_string(),
                rating: None,
                review_count: node["votesCount"].as_i64(),
                date: node["createdAt"].as_str().map(|s| s.to_string()),
                author: None, platform: "Product Hunt".into(), content_text: None,
            });
        }
    }
    Ok(results)
}

async fn try_ph_direct_scrape(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.producthunt.com/search?q={}", urlencoding(query));
    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; Aether/0.1)")
        .header("Accept", "text/html")
        .timeout(std::time::Duration::from_secs(10))
        .send().await.map_err(|e| format!("PH HTTP: {}", e))?;
    let html = resp.text().await.map_err(|e| format!("PH read: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let mut results = Vec::new();
    let item_sel = scraper::Selector::parse("div[class*='item'], div[class*='card'], li[class*='result']").unwrap();
    let name_sel = scraper::Selector::parse("h2, h3, [class*='title'], [class*='name'], a[class*='link']").unwrap();
    let desc_sel = scraper::Selector::parse("p, [class*='tagline'], [class*='description']").unwrap();
    let votes_sel = scraper::Selector::parse("[class*='vote'], [class*='upvote'], [class*='score']").unwrap();
    for item in document.select(&item_sel) {
        let title = item.select(&name_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        if title.len() < 2 { continue; }
        let summary = item.select(&desc_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
        let votes = item.select(&votes_sel).next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default()
            .parse::<i64>().ok();
        results.push(SearchResult { title, url: String::new(), summary, rating: None, review_count: votes, date: None, author: None, platform: "Product Hunt".into(), content_text: None });
        if results.len() >= 15 { break; }
    }
    Ok(results)
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
