import React from 'react';
import { useNexusAuth } from './useNexusAuth';

export function AnonymousBanner() {
  const { isLoggedIn, fullStatus } = useNexusAuth();

  if (isLoggedIn) return null;

  return (
    <div className="rounded-lg border border-indigo-500/20 bg-indigo-600/10 px-4 py-2.5 text-sm text-indigo-200">
      当前为访客模式，部分功能受限。请使用右上角「登录 Nexus」解锁完整功能。
      {fullStatus?.unlockedFeatures.length
        ? ` 当前可用：${fullStatus.unlockedFeatures.join('、')}`
        : ''}
    </div>
  );
}
