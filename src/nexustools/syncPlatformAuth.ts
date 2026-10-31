import { invoke } from '@tauri-apps/api/core';
import { getDeviceId } from 'nexustools-sdk';
import { getNexusClient } from './client';

export async function syncRustPlatformAuth(): Promise<void> {
  const client = getNexusClient();
  const token = client.auth.getToken();
  const user = client.auth.getUser();
  if (!token || !user) {
    await invoke('clear_platform_auth').catch(() => {});
    return;
  }
  const deviceId = await getDeviceId();
  const apiUrl = import.meta.env.VITE_NEXUSTOOLS_API_URL
    || 'https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev';
  await invoke('sync_platform_auth', {
    apiUrl,
    jwt: token,
    appId: 'aether',
    deviceId,
  });
}
