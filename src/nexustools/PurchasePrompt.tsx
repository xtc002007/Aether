import React, { useEffect, useRef, useState } from 'react';
import { useNexusAuth } from './useNexusAuth';
import { getNexusClient } from './client';
import { ShoppingBag } from 'lucide-react';

interface PurchasePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PricingPlan {
  id: string;
  type: string;
  price: number;
  name?: { zh: string; en: string };
  lemonSqueezyVariantId?: number;
  isPopular?: boolean;
}

export function PurchasePrompt({ isOpen, onClose }: PurchasePromptProps) {
  const { createCheckout, refreshStatus } = useNexusAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const apiUrl = import.meta.env.VITE_NEXUSTOOLS_API_URL || 'https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev';
    fetch(`${apiUrl}/api/apps/aether`)
      .then((r) => r.json())
      .then((app) => {
        const subscriptionPlans = (app.pricingPlans || []).filter(
          (p: PricingPlan) => p.type === 'subscription-monthly' || p.type === 'subscription-yearly',
        );
        setPlans(subscriptionPlans);
      })
      .catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollOrderVerification = (orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const result = await getNexusClient().orders.verifyOrder(orderId);
        if (result.verified) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setVerifying(false);
          await refreshStatus();
          onClose();
          return;
        }
      } catch {
        // keep polling
      }
      if (attempts >= 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setVerifying(false);
        await refreshStatus().catch(() => {});
      }
    }, 3000);
  };

  if (!isOpen) return null;

  const handlePurchase = async (variantId: number) => {
    try {
      const res = await createCheckout(variantId);
      if (res.local) {
        await refreshStatus();
        onClose();
        return;
      }
      if (res.checkoutUrl) {
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(res.checkoutUrl);
        } catch {
          window.open(res.checkoutUrl, '_blank');
        }
        if (res.checkoutId) {
          pollOrderVerification(res.checkoutId);
        } else {
          setTimeout(() => refreshStatus().catch(() => {}), 5000);
        }
      }
    } catch (err: any) {
      alert(err.message || '创建订单失败，请稍后重试');
    }
  };

  const formatPrice = (cents: number) => `¥${(cents / 100).toFixed(0)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-8 text-white shadow-2xl transition-all">
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
          订阅 Aether Pro
        </h2>
        <p className="mb-6 text-sm text-slate-400 text-center">
          解锁策略生成、高级导出等 Pro 功能。通过 NexusTools 安全结账。
        </p>

        {verifying && (
          <p className="mb-4 text-center text-xs text-indigo-300 animate-pulse">
            等待支付完成，正在验证订单...
          </p>
        )}

        <div className="space-y-3">
          {plans.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">加载订阅方案中...</p>
          )}
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 transition flex flex-col ${
                plan.isPopular
                  ? 'border-indigo-500/30 bg-indigo-600/5 hover:bg-indigo-600/10'
                  : 'border-white/5 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-lg">{plan.name?.zh || plan.id}</span>
                <span className="text-xl font-bold text-indigo-400">
                  {formatPrice(plan.price)}
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    /{plan.type === 'subscription-yearly' ? '年' : '月'}
                  </span>
                </span>
              </div>
              <button
                onClick={() => handlePurchase(plan.lemonSqueezyVariantId || 0)}
                disabled={!plan.lemonSqueezyVariantId || verifying}
                className="w-full mt-3 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
              >
                订阅 {plan.name?.zh || plan.id}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
