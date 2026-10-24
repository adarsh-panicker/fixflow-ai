// src/app/forgot-password/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetUrl(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate reset link');
      }

      if (data.debugResetUrl) {
        setResetUrl(data.debugResetUrl);
      } else {
        setResetUrl('/reset-password?demo=true');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while generating password reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (resetUrl) {
      const fullUrl = `${window.location.origin}${resetUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto pb-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/40 bg-black flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-100">FixFlow AI</span>
        </Link>
        <div className="text-[11px] text-slate-400">
          Copyrighted <strong className="text-slate-200">Adarsh Panicker</strong>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto my-auto animate-in fade-in duration-300">
        <Card className="border-slate-800/90 bg-slate-900/90 backdrop-blur shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Local Password Recovery
            </h1>
            <p className="text-xs text-slate-400">
              Generate a single-use password reset link for your local account
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resetUrl ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Single-Use Reset Token Generated</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Because FixFlow AI runs completely air-gapped and local-first with zero external email dependencies, your secure single-use reset link is ready immediately:
                </p>
                <div className="p-2 rounded bg-black/60 border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                  {resetUrl}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1 text-xs"
                  leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copied Link' : 'Copy Reset Link'}
                </Button>

                <Button
                  type="button"
                  variant="cyan"
                  size="sm"
                  onClick={() => router.push(resetUrl)}
                  className="flex-1 text-xs"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Proceed to Reset
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@fixflow.ai"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    required
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <Button
                type="submit"
                variant="cyan"
                className="w-full py-2.5 text-xs font-semibold justify-center shadow-md shadow-cyan-950"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Generate Local Reset Link
              </Button>
            </form>
          )}

          <div className="pt-2 text-center text-xs">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </Link>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-500 py-4 max-w-6xl w-full mx-auto">
        Copyrighted &copy; {new Date().getFullYear()} <strong className="text-slate-400">Adarsh Panicker</strong>. All rights reserved.
      </div>
    </div>
  );
}
