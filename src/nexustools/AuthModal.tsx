import React, { useState } from 'react';
import { useNexusAuth } from './useNexusAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useNexusAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || '登录失败，请检查邮箱和密码');
        } else {
          onClose();
        }
      } else {
        if (!username.trim()) {
          setError('用户名不能为空');
          setLoading(false);
          return;
        }
        const res = await register(email, username, password);
        if (!res.success) {
          setError(res.error || '注册失败');
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || '发生未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-8 text-white shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          &times;
        </button>

        <h2 className="mb-2 text-2xl font-bold text-center tracking-tight">
          {isLogin ? '登录 NexusTools 账户' : '创建 NexusTools 账户'}
        </h2>
        <p className="mb-6 text-sm text-slate-400 text-center">
          {isLogin ? '登录以激活软件授权并同步数据' : '创建一个新账户来激活和管理授权'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-500/15 border border-rose-500/25 p-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              电子邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:outline-none transition"
              placeholder="name@example.com"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                用户名
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:outline-none transition"
                placeholder="myusername"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              密码
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition duration-200 mt-2 shadow-lg shadow-indigo-600/20"
          >
            {loading ? '请稍候...' : isLogin ? '立 即 登 录' : '注 册 账 户'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {isLogin ? '还没有 NexusTools 账户？' : '已经有账户了？'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="ml-1 font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
