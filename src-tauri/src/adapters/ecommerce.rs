use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct ECommerceAdapter {
    pub site: String,
    provider: SearchProvider,
}

impl ECommerceAdapter {
    pub fn new(site: &str, provider: SearchProvider) -> Self {
        Self { site: site.to_string(), provider }
    }
}

#[async_trait]
impl PlatformAdapter for ECommerceAdapter {
    fn platform_name(&self) -> &str {
        // This is only called on the adapter object; we return the site
        match self.site.as_str() {
            "amazon.com" => "Amazon",
            "etsy.com" => "Etsy",
            "taobao.com" => "Taobao",
            "jd.com" => "JD.com",
            _ => "E-Commerce",
        }
    }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search(&self.site, query, &self.provider).await
        } else {
            Ok(vec![SearchResult {
                title: format!("E-commerce search unavailable for {}", self.site),
                url: String::new(),
                summary: "E-commerce sources require a search API key (SERP_API_KEY or SERPER_API_KEY).".into(),
                rating: None, review_count: None, date: None, author: None,
                platform: self.site.clone(), content_text: None,
            }])
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                format!("Using search provider for site:{}", self.site)
            } else {
                "E-commerce requires search API key.".into()
            },
        })
    }
}
