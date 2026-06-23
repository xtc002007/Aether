import { NexusToolsClient, TauriStorageAdapter, setDeviceIdProvider, createTauriDeviceIdProvider } from 'nexustools-sdk';
import { invoke } from '@tauri-apps/api/core';

let _client: NexusToolsClient | null = null;
let _deviceInitialized = false;

async function ensureDeviceProvider(storage: TauriStorageAdapter) {
  if (_deviceInitialized) return;
  setDeviceIdProvider(createTauriDeviceIdProvider(
    (cmd, args) => invoke(cmd, args),
    storage,
    'aether',
  ));
  _deviceInitialized = true;
}

export function getNexusClient(): NexusToolsClient {
  if (!_client) {
    const apiUrl = import.meta.env.VITE_NEXUSTOOLS_API_URL || 'https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev';
    const storage = new TauriStorageAdapter('nexustools-auth.bin');
    ensureDeviceProvider(storage).catch(console.error);
    _client = new NexusToolsClient({
      apiUrl,
      appId: 'aether',
      storage,
    });
  }
  return _client;
}

export function getWebsiteUrl(): string {
  return import.meta.env.VITE_NEXUSTOOLS_WEBSITE_URL || 'https://nexustools.tech';
}

export async function initNexusClient(): Promise<NexusToolsClient> {
  const client = getNexusClient();
  await client.init();
  return client;
}
