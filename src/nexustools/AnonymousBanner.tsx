import React from 'react';
import { useNexusAuth } from './useNexusAuth';
import { LogIn } from 'lucide-react';

interface AnonymousBannerProps {
  onLoginClick: () => void;
}

export function AnonymousBanner({ onLoginClick }: AnonymousBannerProps) {
  const { isLoggedIn, fullStatus } = useNexusAuth();

  if (isLoggedIn) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-500/20 bg-indigo-600/10 px-4 py-2.5 text-sm text-indigo-200">
      <span>
        当前为访客模式，部分功能受限。
        {fullStatus?.unlockedFeatures.length
          ? ` 可用功能：${fullStatus.unlockedFeatures.join('、')}`
          : ''}
      </span>
      <button
        onClick={onLoginClick}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
      >
        <LogIn className="h-3.5 w-3.5" />
        登录解锁更多
      </button>
    </div>
  );
}
