import { useNexusAuth } from './useNexusAuth';
import { ShoppingBag } from 'lucide-react';

interface PurchasePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PurchasePrompt({ isOpen, onClose }: PurchasePromptProps) {
  const { createCheckout } = useNexusAuth();

  if (!isOpen) return null;

  const handlePurchase = async (variantId: number) => {
    try {
      const res = await createCheckout(variantId);
      if (res.checkoutUrl) {
        // Since we are inside a Tauri app, we can use the plugin shell or open directly.
        // We import dynamically to handle non-tauri fallbacks
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(res.checkoutUrl);
        } catch {
          window.open(res.checkoutUrl, '_blank');
        }
      }
    } catch (err: any) {
      alert(err.message || '创建订单失败，请稍后重试');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-8 text-white shadow-2xl transition-all">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          &times;
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-5 mx-auto">
          <ShoppingBag className="h-6 w-6" />
        </div>

        <h2 className="mb-2 text-2xl font-bold text-center tracking-tight">
          升级 Aether Pro 专业版
        </h2>
        <p className="mb-6 text-sm text-slate-400 text-center">
          解锁多维市场洞察、深度AI竞品分析与高价值出海模型报告
        </p>

        <div className="space-y-4">
          {/* Lifetime Plan (Paid Variant ID, matching standard Lemon Squeezy test setup) */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/5 p-5 hover:bg-indigo-600/10 transition flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-lg">Aether Pro 终身版</span>
              <span className="text-xl font-bold text-indigo-400">¥299</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              一次购买，终身授权，享受所有后续免费大版本更新
            </p>
            <button
              onClick={() => handlePurchase(41865)} // Test variant ID (or actual variant ID from Lemon Squeezy config)
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/10"
            >
              立即购买终身授权
            </button>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              PRO 版本专属特权：
            </h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>无限次深度 AI 市场分析报告</li>
              <li>更全面的海外竞品情报追踪与出海机会评估</li>
              <li>支持数据导出为 PDF/Markdown/JSON 报告</li>
              <li>多端登录授权同步 (最大 3 台设备)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
