// src/app/login/page.tsx
'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!usernameOrEmail.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: usernameOrEmail.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Successful login -> redirect
      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (user: string, pass: string) => {
    setUsernameOrEmail(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Brand bar */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto pb-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/40 bg-black flex items-center justify-center shrink-0 group-hover:border-cyan-400 transition-colors shadow-md shadow-cyan-950">
            <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">
              FixFlow AI
            </span>
            <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40 font-mono">
              v1.0
            </span>
          </div>
        </Link>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span>Copyrighted</span>
          <strong className="text-slate-200">Adarsh Panicker</strong>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto animate-in fade-in duration-300">
        <Card className="border-slate-800/90 bg-slate-900/90 backdrop-blur shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Operations Console Login
            </h1>
            <p className="text-xs text-slate-400">
              Authenticate to access isolated workspaces and diagnostic telemetry
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. Admin or admin@fixflow.ai"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  required
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-cyan-500 h-3.5 w-3.5"
                />
                <span>Remember session (30 days)</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="cyan"
              className="w-full py-2.5 text-xs font-semibold justify-center shadow-md shadow-cyan-950"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Workspace
            </Button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Default Local Accounts:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">SQLite Local DB</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickCredentials('Admin', 'Flexflow@i')}
                className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors group"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-300">
                  Admin
                </div>
                <div className="text-[9px] text-emerald-400">Owner</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials('Technician', 'Flexflow@i')}
                className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors group"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-300">
                  Technician
                </div>
                <div className="text-[9px] text-cyan-400">Support</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials('Auditor', 'Flexflow@i')}
                className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors group"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-300">
                  Auditor
                </div>
                <div className="text-[9px] text-slate-400">Viewer</div>
              </button>
            </div>

            <div className="text-[10px] text-slate-500 text-center pt-1 font-mono">
              Password: <span className="text-slate-300 font-bold">Flexflow@i</span>
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-slate-400">
            <span>Need an isolated workspace for a new team? </span>
            <Link href="/register" className="text-cyan-400 hover:underline font-medium">
              Create Team Workspace
            </Link>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 py-4 max-w-6xl w-full mx-auto">
        Copyrighted &copy; {new Date().getFullYear()} <strong className="text-slate-400">Adarsh Panicker</strong>. All rights reserved.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading Console...</div>}>
      <LoginForm />
    </Suspense>
  );
}
