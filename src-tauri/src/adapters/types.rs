/// Unified search result from any platform adapter.
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub summary: String,
    pub rating: Option<f64>,
    pub review_count: Option<i64>,
    pub date: Option<String>,
    pub author: Option<String>,
    pub platform: String,
    pub content_text: Option<String>,
}

/// Which search backend to use for general web search.
#[derive(Debug, Clone, PartialEq)]
pub enum SearchProvider {
    /// Use SerpAPI (requires API key)
    SerpApi,
    /// Use Serper.dev (requires API key)
    Serper,
    /// No search provider — platform-specific direct APIs only
    None,
}

impl SearchProvider {
    pub fn from_env() -> Self {
        if std::env::var("SERP_API_KEY").is_ok() {
            return SearchProvider::SerpApi;
        }
        if std::env::var("SERPER_API_KEY").is_ok() {
            return SearchProvider::Serper;
        }
        SearchProvider::None
    }
}
