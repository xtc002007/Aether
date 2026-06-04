use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};

pub struct TiebaAdapter {
    provider: SearchProvider,
}

impl TiebaAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for TiebaAdapter {
    fn platform_name(&self) -> &str { "Tieba" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        if self.provider != SearchProvider::None {
            super::search_provider::site_search("tieba.baidu.com", query, &self.provider).await
        } else {
            Ok(vec![SearchResult {
                title: "贴吧搜索暂不可用".into(),
                url: String::new(),
                summary: "贴吧需要配置搜索 API 密钥 (SERP_API_KEY 或 SERPER_API_KEY)。".into(),
                rating: None, review_count: None, date: None, author: None,
                platform: "Tieba".into(), content_text: None,
            }])
        }
    }

    async fn health_check(&self) -> Result<super::traits::HealthStatus, String> {
        Ok(super::traits::HealthStatus {
            available: self.provider != SearchProvider::None,
            message: if self.provider != SearchProvider::None {
                "使用搜索提供者搜索 site:tieba.baidu.com".into()
            } else {
                "贴吧需要配置搜索 API 密钥。".into()
            },
        })
    }
}
