use async_trait::async_trait;
use crate::models::{PlatformConfig, QueryType};
use super::types::SearchResult;

#[derive(Debug, Clone)]
pub struct HealthStatus {
    pub available: bool,
    pub message: String,
}

#[async_trait]
pub trait PlatformAdapter: Send + Sync {
    /// The display name of this platform.
    fn platform_name(&self) -> &str;

    /// Which query types this adapter supports.
    fn supported_query_types(&self) -> Vec<QueryType> {
        vec![QueryType::Category, QueryType::Task, QueryType::Compare, QueryType::Brand, QueryType::Intent]
    }

    /// Primary search method.
    async fn search(&self, query: &str, config: &PlatformConfig) -> Result<Vec<SearchResult>, String>;

    /// Optional: fetch reviews for a specific product.
    async fn fetch_reviews(&self, _product_id: &str, _config: &PlatformConfig) -> Result<Vec<SearchResult>, String> {
        Err("fetch_reviews not supported".into())
    }

    /// Health check.
    async fn health_check(&self) -> Result<HealthStatus, String> {
        Ok(HealthStatus { available: true, message: "OK".into() })
    }
}
