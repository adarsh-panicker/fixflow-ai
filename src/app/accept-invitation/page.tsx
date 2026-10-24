// src/app/accept-invitation/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  ArrowRight,
  AlertCircle,
  Lock,
  User,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMessage('Missing invitation token.');
      setIsLoading(false);
      return;
    }

    fetch(`/api/auth/accept-invitation?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || 'Invalid invitation');
        }
        setInvitationData(data.invitation);
        setName(data.invitation.email.split('@')[0]);
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Invitation is invalid or has expired.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password: password || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto pb-6">
        <Link href="/" className="flex items-center gap-2.5">
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
            <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Workspace Invitation
            </h1>
            <p className="text-xs text-slate-400">
              You have been invited to join an IT operations workspace
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Validating invitation token...
            </div>
          ) : invitationData ? (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Workspace:</span>
                  <strong className="text-slate-200">{invitationData.workspaceName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Invited Role:</span>
                  <Badge variant="cyan" size="sm">{invitationData.role}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Invited Email:</span>
                  <span className="font-mono text-slate-300">{invitationData.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    required
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Create Local Account Password (min. 8 chars)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (if new account)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Existing users may leave this blank or enter their current password.
                </p>
              </div>

              <Button
                type="submit"
                variant="cyan"
                className="w-full py-2.5 text-xs font-semibold justify-center shadow-md shadow-cyan-950"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Accept Invitation & Enter Workspace
              </Button>
            </form>
          ) : null}

          <div className="pt-2 text-center text-xs">
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign In to an Existing Account
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

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>}>
      <AcceptInvitationForm />
    </Suspense>
  );
}
