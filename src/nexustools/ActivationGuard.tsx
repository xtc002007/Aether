import React from 'react';
import { useNexusAuth } from './useNexusAuth';
import { getWebsiteUrl } from './client';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface ActivationGuardProps {
  children: React.ReactNode;
}

export function ActivationGuard({ children }: ActivationGuardProps) {
  const { isLoggedIn, fullStatus, loading, refreshActivation } = useNexusAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-400">
        正在检查激活状态...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <>{children}</>;
  }

  if (fullStatus?.activation.valid) {
    return <>{children}</>;
  }

  const handleOpenWebsite = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(`${getWebsiteUrl()}/dashboard?activate=aether`);
    } catch {
      window.open(`${getWebsiteUrl()}/dashboard?activate=aether`, '_blank');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshActivation();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-5">
        <RefreshCw className={`h-6 w-6 ${refreshing ? 'animate-spin' : ''}`} />
      </div>
      <h2 className="text-xl font-bold text-slate-200 mb-2">需要激活</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        请前往 NexusTools 网站登录以刷新激活状态。激活后本应用可继续使用。
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleOpenWebsite}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition"
        >
          <ExternalLink className="h-4 w-4" />
          前往网站激活
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 transition"
        >
          我已登录，同步状态
        </button>
      </div>
    </div>
  );
}
