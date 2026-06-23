import React from 'react';
import { useNexusAuth } from './useNexusAuth';
import { getNexusClient } from './client';
import { PurchasePrompt } from './PurchasePrompt';
import { Key } from 'lucide-react';

interface LicenseGuardProps {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LicenseGuard({ featureId, children, fallback }: LicenseGuardProps) {
  const { fullStatus, loading, isLoggedIn } = useNexusAuth();
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [canUse, setCanUse] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (loading) return;
    let active = true;
    getNexusClient().licenses.canUseFeature(featureId).then((allowed) => {
      if (active) setCanUse(allowed);
    });
    return () => { active = false; };
  }, [featureId, loading, fullStatus]);

  if (loading || canUse === null) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-400">
        正在验证功能授权...
      </div>
    );
  }

  const needsActivation = isLoggedIn && fullStatus && !fullStatus.activation.valid;

  if (needsActivation) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 p-8 text-center">
        <p className="text-sm text-amber-200">请先完成网站激活后再使用此功能</p>
      </div>
    );
  }

  if (canUse) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4">
        <Key className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">
        此功能为 Aether Pro 专属
      </h3>
      <p className="text-sm text-slate-400 max-w-sm mb-5">
        {!isLoggedIn
          ? '请先登录您的 NexusTools 账号，或订阅 Pro 解锁此功能'
          : '订阅 Aether Pro 即可解锁此功能'}
      </p>
      <button
        onClick={() => setPurchaseOpen(true)}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition shadow-lg shadow-indigo-600/15"
      >
        {!isLoggedIn ? '登录或订阅 Pro' : '订阅 Pro 专业版'}
      </button>

      <PurchasePrompt isOpen={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </div>
  );
}
