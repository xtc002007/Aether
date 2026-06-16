import { NexusToolsClient, TauriStorageAdapter } from 'nexustools-sdk';

let _client: NexusToolsClient | null = null;

export function getNexusClient(): NexusToolsClient {
  if (!_client) {
    const apiUrl = import.meta.env.VITE_NEXUSTOOLS_API_URL || 'https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev';
    _client = new NexusToolsClient({
      apiUrl,
      appId: 'aether',
      storage: new TauriStorageAdapter('nexustools-auth.bin'),
    });
  }
  return _client;
}

export function getWebsiteUrl(): string {
  return import.meta.env.VITE_NEXUSTOOLS_WEBSITE_URL || 'https://nexustools.tech';
}
