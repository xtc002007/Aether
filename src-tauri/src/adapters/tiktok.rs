use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct TikTokAdapter {
    provider: SearchProvider,
}

impl TikTokAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for TikTokAdapter {
    fn platform_name(&self) -> &str { "TikTok" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("tiktok.com", query, &self.provider).await
        } else {
            Ok(vec![SearchResult {
                title: "TikTok search unavailable".into(),
                url: String::new(),
                summary: "TikTok requires a search API key (SERP_API_KEY or SERPER_API_KEY).".into(),
                rating: None, review_count: None, date: None, author: None,
                platform: "TikTok".into(), content_text: None,
            }])
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for site:tiktok.com".into()
            } else {
                "TikTok requires search API key.".into()
            },
        })
    }
}
