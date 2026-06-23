import React from 'react';
import { useNexusAuth } from './useNexusAuth';
import { AlertTriangle } from 'lucide-react';

export function ActivationReminderBanner() {
  const { isLoggedIn, fullStatus, activationConfig, refreshActivation } = useNexusAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  if (!isLoggedIn || !fullStatus?.activation.valid) return null;

  const reminderDays = activationConfig?.reminderDaysBefore ?? 1;
  const daysRemaining = fullStatus.activation.daysRemaining;
  if (daysRemaining > reminderDays) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshActivation();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <span>
          激活将在 {daysRemaining <= 0 ? '今天' : `${daysRemaining} 天后`}到期，请前往网站登录以延续使用。
        </span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition disabled:opacity-50"
      >
        {refreshing ? '同步中...' : '我已登录，同步'}
      </button>
    </div>
  );
}
