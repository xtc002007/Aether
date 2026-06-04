use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::SearchResult;

pub struct RedditAdapter;

#[async_trait]
impl PlatformAdapter for RedditAdapter {
    fn platform_name(&self) -> &str { "Reddit" }

    async fn search(&self, query: &str, config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        let client = reqwest::Client::new();
        let search_url = format!(
            "https://www.reddit.com/search.json?q={}&limit={}&sort=relevance",
            urlencoding(query), config.max_results.min(25)
        );
        let resp = client.get(&search_url)
            .header("User-Agent", random_ua())
            .timeout(std::time::Duration::from_millis(config.timeout_ms as u64))
            .send().await.map_err(|e| format!("Reddit HTTP error: {}", e))?;

        if resp.status().as_u16() == 429 {
            return Err("Reddit rate limited (429). Reduce concurrency or wait.".into());
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Reddit parse: {}", e))?;
        let mut results = Vec::new();

        if let Some(children) = json["data"]["children"].as_array() {
            for child in children {
                let data = &child["data"];
                let title = data["title"].as_str().unwrap_or("").to_string();
                let selftext = data["selftext"].as_str().unwrap_or("").to_string();
                let permalink = data["permalink"].as_str().unwrap_or("");
                let url = format!("https://www.reddit.com{}", permalink);
                let author = data["author"].as_str().map(|s| s.to_string());
                if !title.is_empty() {
                    results.push(SearchResult {
                        title, url,
                        summary: selftext.chars().take(300).collect(),
                        rating: None,
                        review_count: Some(data["num_comments"].as_i64().unwrap_or(0)),
                        date: data["created_utc"].as_f64().map(|ts| {
                            chrono::DateTime::from_timestamp(ts as i64, 0)
                                .map(|dt| dt.format("%Y-%m-%d").to_string()).unwrap_or_default()
                        }),
                        author, platform: "Reddit".into(),
                        content_text: Some(selftext),
                    });
                }
            }
        }
        Ok(results)
    }
}

fn random_ua() -> &'static str {
    "Aether/0.1 Research Workstation (Mozilla/5.0 compatible)"
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
        .replace('"', "%22").replace('\'', "%27")
}
