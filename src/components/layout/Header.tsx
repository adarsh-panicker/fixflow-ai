// src/components/layout/Header.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  RotateCcw,
  Search,
  Building,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CommandPalette } from './CommandPalette';
import { repository } from '@/lib/data/repository';
import { useToast } from '../ui/NotificationToast';
import { WorkspaceRole } from '@/types/auth';

export interface HeaderProps {
  onToggleSidebar?: () => void;
}

interface UserState {
  id: string;
  username?: string | null;
  name: string;
  email: string;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  activeRole: WorkspaceRole;
  availableWorkspaces: Array<{
    id: string;
    name: string;
    role: WorkspaceRole;
  }>;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const router = useRouter();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [user, setUser] = useState<UserState | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const { toast } = useToast();

  const loadSession = () => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  };

  useEffect(() => {
    loadSession();
  }, []);

  // Global Ctrl+K listener for header
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
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

  const handleSwitchWorkspace = async (workspaceId: string) => {
    try {
      const res = await fetch('/api/auth/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.success) {
        setIsWorkspaceMenuOpen(false);
        toast({
          title: 'Workspace Switched',
          message: `Active workspace changed to ${data.activeWorkspaceName}.`,
          type: 'info',
        });
        window.location.reload();
      }
    } catch (err: any) {
      toast({
        title: 'Error Switching Workspace',
        message: err.message,
        type: 'error',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      toast({
        title: 'Signed Out',
        message: 'You have been signed out successfully.',
        type: 'info',
      });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const getRoleBadgeVariant = (role?: WorkspaceRole) => {
    switch (role) {
      case 'OWNER':
        return 'rose';
      case 'ADMIN':
        return 'amber';
      case 'SUPPORT':
        return 'cyan';
      default:
        return 'slate';
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

          {/* Workspace Selector */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsWorkspaceMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors"
              >
                <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold max-w-[130px] sm:max-w-[200px] truncate">
                  {user.activeWorkspaceName}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {isWorkspaceMenuOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
                    Switch Workspace
                  </div>
                  {user.availableWorkspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-900 transition-colors ${
                        ws.id === user.activeWorkspaceId ? 'text-cyan-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{ws.name}</span>
                      <Badge variant={getRoleBadgeVariant(ws.role)} size="sm">
                        {ws.role}
                      </Badge>
                    </button>
                  ))}
                  <div className="border-t border-slate-800/60 mt-1 pt-1">
                    <Link
                      href="/register"
                      onClick={() => setIsWorkspaceMenuOpen(false)}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-cyan-400 hover:bg-slate-900 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Workspace</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="demo" size="sm">
                Local DB Active
              </Badge>
            </div>
          )}
        </div>

        {/* Global Command Palette Trigger Bar */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="hidden md:flex items-center justify-between w-56 lg:w-72 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors shadow-inner"
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
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
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
            <span className="hidden sm:inline">Reset Demo</span>
            <span className="sm:hidden">Reset</span>
          </Button>

          {/* User Profile / Auth State Pill */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-200 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                  {(user.username || user.name).charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-[11px] font-semibold text-slate-200 leading-none">
                    {user.username || user.name}
                  </div>
                  <div className="text-[9px] text-cyan-400 font-mono mt-0.5 leading-none">
                    {user.activeRole}
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in text-xs">
                  <div className="px-3 py-2 border-b border-slate-800/80">
                    <p className="font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                    <div className="mt-1">
                      <Badge variant={getRoleBadgeVariant(user.activeRole)} size="sm">
                        {user.activeRole}
                      </Badge>
                    </div>
                  </div>

                  <Link
                    href="/members"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-900 text-slate-300 hover:text-slate-100 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Workspace Members</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-900 text-slate-300 hover:text-slate-100 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Account & Settings</span>
                  </Link>

                  <div className="border-t border-slate-800/80 my-1"></div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login">
              <Button variant="cyan" size="sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>

        <ConfirmDialog
          isOpen={isResetOpen}
          onClose={() => setIsResetOpen(false)}
          onConfirm={handleResetConfirm}
          title="Reset Demo Data to Initial State?"
          message="This will restore the 16 demo assets, 15 relationships, and sample incidents in the local database."
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
