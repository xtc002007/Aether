use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct XTwitterAdapter {
    provider: SearchProvider,
}

impl XTwitterAdapter {
    pub fn new(provider: SearchProvider) -> Self { Self { provider } }
}

#[async_trait]
impl PlatformAdapter for XTwitterAdapter {
    fn platform_name(&self) -> &str { "X / Twitter" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            // Search both x.com and twitter.com
            let mut results = super::search_provider::site_search("x.com", query, &self.provider).await?;
            if let Ok(tw) = super::search_provider::site_search("twitter.com", query, &self.provider).await {
                results.extend(tw);
            }
            return Ok(results);
        }
        // Without search provider, X/Twitter is essentially unavailable (requires login)
        Ok(vec![SearchResult {
            title: "X/Twitter search unavailable".into(),
            url: String::new(),
            summary: "Twitter/X requires a search API key (SERP_API_KEY or SERPER_API_KEY) to search.".into(),
            rating: None, review_count: None, date: None, author: None,
            platform: "X / Twitter".into(), content_text: None,
        }])
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        if self.provider == SearchProvider::None {
            Ok(super::traits::HealthStatus {
                available: false,
                message: "X/Twitter requires search API key (SERP_API_KEY or SERPER_API_KEY).".into(),
            })
        } else {
            Ok(super::traits::HealthStatus { available: true, message: "Using search provider for site:x.com".into() })
        }
    }
}
