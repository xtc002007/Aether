use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::SearchResult;

pub struct AppStoreAdapter;

#[async_trait]
impl PlatformAdapter for AppStoreAdapter {
    fn platform_name(&self) -> &str { "App Store" }

    async fn search(&self, query: &str, config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        let client = reqwest::Client::new();
        // iTunes Search API — free, no auth required
        let search_url = format!(
            "https://itunes.apple.com/search?term={}&entity=software&limit={}",
            urlencoding(query), config.max_results.min(25)
        );
        let resp = client.get(&search_url)
            .timeout(std::time::Duration::from_millis(config.timeout_ms as u64))
            .send().await.map_err(|e| format!("iTunes HTTP: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("iTunes JSON: {}", e))?;
        let mut results = Vec::new();

        if let Some(apps) = json["results"].as_array() {
            for app in apps {
                let track_id = app["trackId"].as_i64().unwrap_or(0);
                let app_name = app["trackName"].as_str().unwrap_or("").to_string();
                results.push(SearchResult {
                    title: app_name.clone(),
                    url: app["trackViewUrl"].as_str().unwrap_or("").to_string(),
                    summary: app["description"].as_str().unwrap_or("").chars().take(300).collect(),
                    rating: app["averageUserRating"].as_f64(),
                    review_count: app["userRatingCount"].as_i64(),
                    date: app["currentVersionReleaseDate"].as_str().map(|s| s.to_string()),
                    author: app["artistName"].as_str().map(|s| s.to_string()),
                    platform: "App Store".into(),
                    content_text: Some(format!("App {} (ID: {})", app_name, track_id)),
                });
            }
        }
        Ok(results)
    }

    /// Fetch actual review text for a given app from Apple's Customer Reviews RSS.
    async fn fetch_reviews(&self, product_id: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://itunes.apple.com/rss/customerreviews/page=1/id={}/sortBy=mostRecent/json",
            product_id
        );
        let resp = client.get(&url)
            .timeout(std::time::Duration::from_secs(15))
            .send().await.map_err(|e| format!("Reviews RSS HTTP: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Reviews RSS JSON: {}", e))?;

        let mut reviews = Vec::new();
        if let Some(entries) = json["feed"]["entry"].as_array() {
            for entry in entries.iter().skip(1) { // skip first entry (app metadata)
                let title = entry["title"]["label"].as_str().unwrap_or("").to_string();
                let content = entry["content"]["label"].as_str().unwrap_or("").to_string();
                let rating_str = entry["im:rating"]["label"].as_str().unwrap_or("0");
                let rating = rating_str.parse::<f64>().ok();
                let author = entry["author"]["name"]["label"].as_str().map(|s| s.to_string());
                let date = entry["updated"]["label"].as_str().map(|s| s.to_string());
                if !content.is_empty() {
                    reviews.push(SearchResult {
                        title, url: String::new(), summary: content.chars().take(500).collect(),
                        rating, review_count: None, date, author,
                        platform: "App Store Reviews".into(),
                        content_text: Some(content),
                    });
                }
            }
        }
        Ok(reviews)
    }
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "+").replace('&', "%26").replace('?', "%3F").replace('#', "%23")
}
