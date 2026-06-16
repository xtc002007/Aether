import { useState, useEffect } from 'react';
import { NexusUser, AppLicenseStatus } from 'nexustools-sdk';
import { getNexusClient } from './client';

export function useNexusAuth() {
  const [user, setUser] = useState<NexusUser | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<AppLicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getNexusClient();

    let isSubscribed = true;

    async function initSession() {
      try {
        await client.init();
        const u = await client.auth.refreshSession();
        if (!isSubscribed) return;
        setUser(u);
        if (u) {
          const lic = await client.licenses.getAppLicenseStatus();
          if (isSubscribed) setLicenseStatus(lic);
        }
      } catch (err) {
        console.error("Failed to initialize session:", err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    initSession();

    const unsub = client.auth.onAuthStateChange(async (u) => {
      if (!isSubscribed) return;
      setUser(u);
      if (u) {
        const lic = await client.licenses.getAppLicenseStatus();
        if (isSubscribed) setLicenseStatus(lic);
      } else {
        setLicenseStatus(null);
      }
    });

    return () => {
      isSubscribed = false;
      unsub();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await getNexusClient().auth.login(email, password);
    return res;
  };

  const register = async (email: string, username: string, password: string) => {
    const res = await getNexusClient().auth.register(email, username, password);
    return res;
  };

  const logout = async () => {
    await getNexusClient().auth.logout();
  };

  const createCheckout = async (variantId: number) => {
    return await getNexusClient().orders.createCheckout(variantId);
  };

  const loginWithToken = async (token: string) => {
    const res = await getNexusClient().auth.loginWithToken(token);
    return res;
  };

  return {
    user,
    isLoggedIn: !!user,
    licenseStatus,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    createCheckout,
  };
}
