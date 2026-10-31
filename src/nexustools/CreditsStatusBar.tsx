import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { useNexusAuth } from './useNexusAuth';
import { getNexusClient, getWebsiteUrl } from './client';

interface CreditsStatusBarProps {
  cn?: boolean;
}

export function CreditsStatusBar({ cn = true }: CreditsStatusBarProps) {
  const { isLoggedIn, fullStatus } = useNexusAuth();
  const [available, setAvailable] = useState<number | null>(null);
  const [allowance, setAllowance] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !fullStatus?.subscription?.active) {
      setAvailable(null);
      setAllowance(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const client = getNexusClient();
      const balance = await client.credits.getBalance();
      if (cancelled) return;
      setAvailable(balance?.available ?? 0);
      setAllowance(balance?.monthlyAllowance ?? 0);
    };

    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isLoggedIn, fullStatus?.subscription?.active]);

  if (!isLoggedIn || !fullStatus?.subscription?.active) return null;

  const low = (available ?? 0) <= 0;

  const openSubscribe = async () => {
    const client = getNexusClient();
    const token = client.auth.getToken();
    const appId = import.meta.env.VITE_NEXUSTOOLS_APP_ID || 'aether';
    const baseUrl = getWebsiteUrl();
    const url = token
      ? `${baseUrl}/apps/${appId}?token=${encodeURIComponent(token)}`
      : `${baseUrl}/apps/${appId}`;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <button
      type="button"
      onClick={openSubscribe}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md transition cursor-pointer ${
        low
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-[#E5E2DE] bg-[#F9F8F6] text-[#1C1C1C] hover:bg-[#F0EEEB] dark:bg-[#22201D] dark:border-[#3E3A35] dark:text-white'
      }`}
      title={cn ? '点击查看订阅与充值' : 'View subscription'}
    >
      <Coins className="h-3.5 w-3.5" />
      <span>
        {cn ? 'Credits' : 'Credits'} {available ?? '—'}/{allowance ?? '—'}
      </span>
    </button>
  );
}
