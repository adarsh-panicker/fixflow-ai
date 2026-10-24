// src/components/layout/Footer.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/80 backdrop-blur px-4 lg:px-6 py-4 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Copyright Info */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded overflow-hidden border border-cyan-500/40 bg-black flex items-center justify-center shrink-0 group-hover:border-cyan-400 transition-colors shadow-sm shadow-cyan-950">
              <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
              FixFlow AI
            </span>
          </Link>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <div className="text-slate-400 flex items-center gap-1.5 flex-wrap">
            <span>Copyrighted &copy; {new Date().getFullYear()}</span>
            <span className="font-semibold text-slate-200 hover:text-cyan-400 transition-colors">
              Adarsh Panicker
            </span>
            <span className="text-slate-500 hidden sm:inline">| All rights reserved.</span>
          </div>
        </div>

        {/* Feature Badges & Quick Navigation */}
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <Link
            href="/knowledge-base"
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
          >
            <BookOpen className="w-3 h-3 text-emerald-400" />
            <span>Local KB</span>
          </Link>

          <Link
            href="/monitoring"
            className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>ICMP Health</span>
          </Link>

          <span className="px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-300 border border-cyan-800/40 font-mono">
            Version A • Air-Gapped CMDB Grounding
          </span>

          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>System Operational</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
