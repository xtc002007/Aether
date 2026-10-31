use async_trait::async_trait;
use crate::models::PlatformConfig;
use super::traits::PlatformAdapter;
use super::types::{SearchProvider, SearchResult};
use super::search_provider;

pub struct LinkedInAdapter {
    provider: SearchProvider,
}

impl LinkedInAdapter {
    pub fn new(provider: SearchProvider) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl PlatformAdapter for LinkedInAdapter {
    fn platform_name(&self) -> &str { "LinkedIn" }

    async fn search(&self, query: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        let mut results = search_provider::site_search("linkedin.com", query, &self.provider).await?;
        for r in &mut results {
            r.platform = "LinkedIn".into();
        }
        Ok(results)
    }
}
