import { useState, useRef, useEffect } from 'react';
import { useNexusAuth } from './useNexusAuth';
import { AuthModal } from './AuthModal';
import { PurchasePrompt } from './PurchasePrompt';
import { User, LogOut, Key, ShieldCheck, ShoppingCart, Globe, ChevronDown } from 'lucide-react';
import { getWebsiteUrl, getNexusClient } from './client';

interface AccountPanelProps {
  compact?: boolean;
  variant?: 'sidebar' | 'header';
  cn?: boolean;
  onLoginClick?: () => void;
}

export function AccountPanel({ compact = false, variant = 'sidebar', cn = true, onLoginClick }: AccountPanelProps) {
  const { user, isLoggedIn, licenseStatus, fullStatus, loading, logout } = useNexusAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const handleLoginWebsite = async () => {
    const client = getNexusClient();
    const token = client.auth.getToken();
    const baseUrl = getWebsiteUrl();
    const url = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (loading) {
    if (variant === 'header') {
      return <div className="w-16 h-7 bg-[#F9F8F6] animate-pulse rounded dark:bg-[#22201D]" />;
    }
    return (
      <div className="flex items-center justify-center p-4 text-xs text-slate-400">
        {compact ? "..." : (cn ? "正在载入账户数据..." : "Loading account...")}
      </div>
    );
  }

  if (variant === 'header') {
    if (!isLoggedIn) {
      return (
        <>
          <button
            onClick={onLoginClick}
            className="flex items-center gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 border border-indigo-600 rounded-md transition cursor-pointer"
          >
            <User className="h-3.5 w-3.5" />
            <span>{cn ? '登录 Nexus' : 'Sign In'}</span>
          </button>
          <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
          <PurchasePrompt isOpen={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
        </>
      );
    }

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 h-8 bg-[#F9F8F6] hover:bg-[#F0EEEB] border border-[#E5E2DE] text-[#1C1C1C] text-xs font-semibold pl-2 pr-1.5 rounded-md transition cursor-pointer dark:bg-[#22201D] dark:border-[#3E3A35] dark:text-white dark:hover:bg-[#2A2724]"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
            <User className="h-3 w-3" />
          </div>
          <span className="max-w-[5rem] truncate hidden sm:inline">{user?.username || user?.email}</span>
          {licenseStatus?.hasLicense ? (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1 rounded font-extrabold uppercase">Pro</span>
          ) : (
            <span className="text-[8px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1 rounded font-extrabold uppercase">Free</span>
          )}
          <ChevronDown className={`h-3 w-3 text-[#8C8882] transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-[#E5E2DE] rounded-lg shadow-xl z-50 py-1 dark:bg-[#191816] dark:border-[#3E3A35]">
            <div className="px-3 py-2 border-b border-[#E5E2DE] dark:border-[#3E3A35]">
              <p className="text-xs font-bold text-[#1C1C1C] truncate dark:text-white">{user?.username}</p>
              <p className="text-[10px] text-[#8C8882] truncate">{user?.email}</p>
            </div>
            {licenseStatus?.hasLicense ? (
              <div className="px-3 py-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                <span>{licenseStatus?.hasLicense ? (cn ? '订阅版' : 'Subscription') : (cn ? '免费版' : 'Free')} · {fullStatus?.activation.valid ? (cn ? '已激活' : 'Active') : (cn ? '待激活' : 'Pending')}</span>
              </div>
            ) : (
              <button
                onClick={() => { setPurchaseOpen(true); setMenuOpen(false); }}
                className="w-full px-3 py-2 flex items-center gap-1.5 text-[10px] text-indigo-600 hover:bg-indigo-50 transition cursor-pointer dark:text-indigo-400 dark:hover:bg-indigo-950/20"
              >
                <ShoppingCart className="h-3 w-3" />
                <span>{cn ? '购买 Pro 授权' : 'Upgrade to Pro'}</span>
              </button>
            )}
            <button
              onClick={() => { handleLoginWebsite(); setMenuOpen(false); }}
              className="w-full px-3 py-2 flex items-center gap-1.5 text-xs text-[#5C5852] hover:bg-[#F9F8F6] transition cursor-pointer dark:text-[#8C8882] dark:hover:bg-[#22201D]"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{cn ? '前往网页版' : 'Open Website'}</span>
            </button>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="w-full px-3 py-2 flex items-center gap-1.5 text-xs text-rose-500 hover:bg-rose-50 transition cursor-pointer dark:hover:bg-rose-950/20"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{cn ? '登出' : 'Sign Out'}</span>
            </button>
          </div>
        )}
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
        <PurchasePrompt isOpen={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="py-4 px-1 border-t border-white/10 bg-slate-950/40 text-center space-y-3">
        {isLoggedIn ? (
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={handleLoginWebsite}
              title={`已登录: ${user?.username || user?.email} (点击跳转登录网站)`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/35 transition cursor-pointer"
            >
              <User className="h-4 w-4" />
            </button>
            {licenseStatus?.hasLicense ? (
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded font-extrabold uppercase scale-90">Pro</span>
            ) : (
              <button
                onClick={() => setPurchaseOpen(true)}
                title="购买 Pro 授权"
                className="text-[8px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1 rounded font-extrabold uppercase scale-90 hover:bg-amber-500/25 transition cursor-pointer"
              >
                Free
              </button>
            )}
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={handleLoginWebsite}
                title="登录网站"
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => logout()}
                title="登出"
                className="text-rose-400 hover:text-rose-300 transition p-1 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <button
              onClick={onLoginClick}
              title="登录 NexusTools"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        )}
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
        <PurchasePrompt isOpen={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-white/10 bg-slate-950/40">
      {isLoggedIn ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate text-slate-200">
                {user?.username}
              </p>
              <p className="text-xs truncate text-slate-400">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/60 p-2.5 border border-white/5 space-y-1.5">
            {licenseStatus?.hasLicense ? (
              <div className="flex items-center space-x-2 text-xs text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {licenseStatus?.hasLicense ? '订阅版授权' : '免费版'} · {fullStatus?.activation.valid ? '已激活' : '待激活'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2 text-xs text-amber-400">
                  <Key className="h-3.5 w-3.5" />
                  <span className="font-medium">免费限制版</span>
                </div>
                <button
                  onClick={() => setPurchaseOpen(true)}
                  className="flex items-center justify-center space-x-1.5 w-full rounded bg-indigo-600/80 hover:bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition shadow-sm"
                >
                  <ShoppingCart className="h-3 w-3" />
                  <span>购买 Pro 授权</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={handleLoginWebsite}
              className="text-slate-400 hover:text-white transition font-medium cursor-pointer"
            >
              登录网站
            </button>
            <button
              onClick={() => logout()}
              className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 transition font-medium cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>登出</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 text-center mb-1">
            登录 NexusTools 可解锁专业版高级分析功能
          </p>
          <button
            onClick={onLoginClick}
            className="flex items-center justify-center space-x-2 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2 text-sm font-semibold text-white transition shadow-md shadow-indigo-600/10"
          >
            <User className="h-4 w-4" />
            <span>登录 NexusTools</span>
          </button>
        </div>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <PurchasePrompt isOpen={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </div>
  );
}
