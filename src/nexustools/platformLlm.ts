import { getNexusClient } from './client';

export async function canUsePlatformLlm(): Promise<boolean> {
  const client = getNexusClient();
  const user = client.auth.getUser();
  if (!user) return false;
  const status = await client.licenses.getFullStatus();
  if (!status.subscription.active) return false;
  if (!status.unlockedFeatures.includes('platform_llm')) return false;
  return client.credits.hasAvailableCredits();
}
