use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct QuoraAdapter {
    provider: SearchProvider,
}

impl QuoraAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for QuoraAdapter {
    fn platform_name(&self) -> &str { "Quora" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("quora.com", query, &self.provider).await
        } else {
            Ok(vec![SearchResult {
                title: "Quora search unavailable".into(),
                url: String::new(),
                summary: "Quora requires a search API key (SERP_API_KEY or SERPER_API_KEY).".into(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Quora".into(), content_text: None,
            }])
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "Using search provider for site:quora.com".into()
            } else {
                "Quora requires search API key.".into()
            },
        })
    }
}
