// src/app/unauthorized/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function UnauthorizedPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
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

      <div className="w-full max-w-lg mx-auto my-auto animate-in fade-in duration-300">
        <Card className="border-slate-800/90 bg-slate-900/90 backdrop-blur shadow-2xl p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Access Restricted — Insufficient Permissions
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Your active workspace membership does not grant the required role permissions to access this resource or perform this administrative operation.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2 text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Security Invariant:</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              FixFlow AI enforces server-side role-based access control and strict workspace tenancy. If you believe this is in error, request an updated role assignment from your Workspace Owner or Administrator.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center text-xs"
              leftIcon={<LayoutDashboard className="w-3.5 h-3.5" />}
              onClick={() => router.push('/')}
            >
              Return to Dashboard
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="flex-1 justify-center text-xs text-rose-300 hover:text-rose-200 border-rose-900/40"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              onClick={handleLogout}
            >
              Sign In as Another User
            </Button>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-500 py-4 max-w-6xl w-full mx-auto">
        Copyrighted &copy; {new Date().getFullYear()} <strong className="text-slate-400">Adarsh Panicker</strong>. All rights reserved.
      </div>
    </div>
  );
}
