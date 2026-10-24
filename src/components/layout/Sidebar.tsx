// src/components/layout/Sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sparkles,
  Server,
  Network,
  History,
  Settings,
  PlusCircle,
  Activity,
  BookOpen,
  Users
} from 'lucide-react';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      label: 'AI Troubleshooter',
      href: '/incident/new',
      icon: Sparkles,
      active: pathname.startsWith('/incident'),
      badge: 'Dual Mode',
    },
    {
      label: 'Infrastructure Health',
      href: '/monitoring',
      icon: Activity,
      active: pathname === '/monitoring',
      badge: 'ICMP',
    },
    {
      label: 'Asset Inventory',
      href: '/assets',
      icon: Server,
      active: pathname.startsWith('/assets'),
    },
    {
      label: 'Infrastructure Map',
      href: '/dependency-map',
      icon: Network,
      active: pathname === '/dependency-map',
    },
    {
      label: 'Knowledge Base',
      href: '/knowledge-base',
      icon: BookOpen,
      active: pathname.startsWith('/knowledge-base'),
      badge: 'Local-First',
    },
    {
      label: 'Incident History',
      href: '/investigations',
      icon: History,
      active: pathname === '/investigations',
    },
    {
      label: 'Workspace Members',
      href: '/members',
      icon: Users,
      active: pathname === '/members',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      active: pathname === '/settings',
    },
  ];

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-black border border-cyan-500/40 flex items-center justify-center shrink-0 group-hover:border-cyan-400 transition-colors shadow-md shadow-cyan-950/40">
            <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">FixFlow AI</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">v1.0</span>
            </div>
            <p className="text-[10px] text-cyan-400/90 font-medium tracking-tight">By Adarsh Panicker</p>
          </div>
        </Link>
      </div>

      {/* Quick Intake CTA */}
      <div className="p-4">
        <Link
          href="/incident/new"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-cyan-950 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Incident Intake</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        <div className="px-3 pb-2 pt-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                item.active
                  ? 'bg-slate-850 text-cyan-400 border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${item.active ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-normal">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Access Boundary & Copyright Banner */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Model: Version A</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Air-Gapped</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">
            Manual execution only. Zero autonomous network changes.
          </p>
        </div>

        <div className="text-[10px] text-slate-500 text-center font-medium pt-1">
          Copyrighted &copy; {new Date().getFullYear()} <strong className="text-slate-400">Adarsh Panicker</strong>
        </div>
      </div>
    </aside>
  );
};
