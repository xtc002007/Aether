import { useState, useEffect, useCallback } from 'react';
import { NexusUser, FullLicenseStatus, ActivationConfig } from 'nexustools-sdk';
import { getNexusClient, initNexusClient } from './client';

export function useNexusAuth() {
  const [user, setUser] = useState<NexusUser | null>(null);
  const [fullStatus, setFullStatus] = useState<FullLicenseStatus | null>(null);
  const [activationConfig, setActivationConfig] = useState<ActivationConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    const client = getNexusClient();
    const status = await client.licenses.getFullStatus();
    setFullStatus(status);
    return status;
  }, []);

  useEffect(() => {
    const client = getNexusClient();
    let isSubscribed = true;

    async function initSession() {
      try {
        await initNexusClient();
        const client = getNexusClient();
        const appInfo = await client.licenses.fetchAppInfo();
        if (isSubscribed && appInfo?.activation) {
          setActivationConfig(appInfo.activation);
        }
        const u = await client.auth.refreshSession();
        if (!isSubscribed) return;
        setUser(u);
        if (u) {
          await client.onLoginComplete();
          const status = await client.licenses.getFullStatus();
          if (isSubscribed) setFullStatus(status);
        } else {
          const status = await client.licenses.getFullStatus();
          if (isSubscribed) setFullStatus(status);
        }
      } catch (err) {
        console.error('Failed to initialize session:', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    initSession();

    const unsub = client.auth.onAuthStateChange(async (u) => {
      if (!isSubscribed) return;
      setUser(u);
      if (u) {
        await client.onLoginComplete();
      } else {
        await client.licenses.clearCache();
      }
      const status = await client.licenses.getFullStatus();
      if (isSubscribed) setFullStatus(status);
    });

    const interval = setInterval(() => {
      refreshStatus().catch(() => {});
    }, 24 * 60 * 60 * 1000);

    return () => {
      isSubscribed = false;
      unsub();
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const login = async (email: string, password: string) => {
    const res = await getNexusClient().auth.login(email, password);
    if (res.success) await getNexusClient().onLoginComplete();
    return res;
  };

  const register = async (email: string, username: string, password: string) => {
    const res = await getNexusClient().auth.register(email, username, password);
    if (res.success) await getNexusClient().onLoginComplete();
    return res;
  };

  const logout = async () => {
    await getNexusClient().logout();
    setUser(null);
    setFullStatus(null);
  };

  const createCheckout = async (priceId: string, discountCode?: string, planId?: string) => {
    return await getNexusClient().orders.createCheckout(priceId, discountCode, planId);
  };

  const loginWithToken = async (token: string) => {
    const res = await getNexusClient().auth.loginWithToken(token);
    if (res.success) await getNexusClient().onLoginComplete();
    return res;
  };

  const refreshActivation = async () => {
    const client = getNexusClient();
    await client.activation.refresh();
    return refreshStatus();
  };

  return {
    user,
    isLoggedIn: !!user,
    fullStatus,
    activationConfig,
    licenseStatus: fullStatus ? {
      hasLicense: fullStatus.subscription.active,
      unlockedFeatures: fullStatus.unlockedFeatures,
      expiresSoon: fullStatus.subscription.expiresSoon,
    } : null,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    createCheckout,
    refreshStatus,
    refreshActivation,
  };
}
