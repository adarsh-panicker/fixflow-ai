// src/components/layout/Header.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, RotateCcw, Sparkles, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CommandPalette } from './CommandPalette';
import { repository } from '@/lib/data/repository';
import { useToast } from '../ui/NotificationToast';

export interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { toast } = useToast();

  // Global Ctrl+K listener for header
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResetConfirm = async () => {
    try {
      await fetch('/api/reset-demo', { method: 'POST' });
      repository.resetToDemoData();
      toast({
        title: 'Demo Data Reset',
        message: 'All assets, relationships, and sample incidents restored to factory demo state in SQLite.',
        type: 'success',
      });
      window.location.reload();
    } catch {
      repository.resetToDemoData();
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            className="lg:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Brand */}
          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded overflow-hidden border border-cyan-500/40 bg-black flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="FixFlow AI" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xs text-white">FixFlow AI</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="demo" size="sm">
              Demo Data Active
            </Badge>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400 font-mono">
              SQLite Mock Repository
            </span>
          </div>
        </div>

        {/* Global Command Palette Trigger Bar */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="hidden md:flex items-center justify-between w-64 lg:w-80 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Search assets, codes, incidents...</span>
          </div>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
            <span>Ctrl</span>
            <span>K</span>
          </kbd>
        </button>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            <span>Copyrighted</span>
            <strong className="text-slate-200 font-medium">Adarsh Panicker</strong>
          </div>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
            onClick={() => setIsResetOpen(true)}
            title="Restore factory sample assets and incidents"
          >
            <span className="hidden sm:inline">Reset Demo Data</span>
            <span className="sm:hidden">Reset</span>
          </Button>

          <Link href="/incident/new">
            <Button variant="cyan" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              New Triage
            </Button>
          </Link>
        </div>

        <ConfirmDialog
          isOpen={isResetOpen}
          onClose={() => setIsResetOpen(false)}
          onConfirm={handleResetConfirm}
          title="Reset Demo Data to Initial State?"
          message="This will overwrite any newly created or modified assets, infrastructure dependencies, and investigation sessions with the original 15 enterprise demo assets and 5 diagnostic scenarios. This action cannot be undone."
          confirmLabel="Reset Everything"
          variant="danger"
        />
      </header>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
};
