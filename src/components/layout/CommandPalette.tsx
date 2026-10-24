// src/components/layout/CommandPalette.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  Server,
  Network,
  History,
  Activity,
  BookOpen,
  Settings,
  ChevronRight,
  X
} from 'lucide-react';
import { repository } from '@/lib/data/repository';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setSelectedIndex(0);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const assets = repository.getAssets();
  const incidents = repository.getIncidents();

  // Navigation Items
  const navigationItems = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      subtitle: 'Overview metrics and operational state',
      category: 'Navigation',
      icon: Server,
      action: () => router.push('/'),
    },
    {
      id: 'nav-troubleshooter',
      title: 'AI Troubleshooter',
      subtitle: 'New guided or agent investigation intake',
      category: 'Navigation',
      icon: Sparkles,
      action: () => router.push('/incident/new'),
    },
    {
      id: 'nav-kb',
      title: 'Knowledge Base',
      subtitle: 'Local-first verified solutions repository',
      category: 'Navigation',
      icon: BookOpen,
      action: () => router.push('/knowledge-base'),
    },
    {
      id: 'nav-monitoring',
      title: 'Infrastructure Availability Monitoring',
      subtitle: 'ICMP availability checks and outage incidents',
      category: 'Navigation',
      icon: Activity,
      action: () => router.push('/monitoring'),
    },
    {
      id: 'nav-assets',
      title: 'Asset Inventory',
      subtitle: 'Registered CMDB servers, switches, workstations',
      category: 'Navigation',
      icon: Server,
      action: () => router.push('/assets'),
    },
    {
      id: 'nav-depmap',
      title: 'Infrastructure Dependency Map',
      subtitle: 'Topology graph and upstream/downstream blast radius',
      category: 'Navigation',
      icon: Network,
      action: () => router.push('/dependency-map'),
    },
    {
      id: 'nav-history',
      title: 'Incident History',
      subtitle: 'Historical sessions and post-mortem RCA reports',
      category: 'Navigation',
      icon: History,
      action: () => router.push('/investigations'),
    },
    {
      id: 'nav-settings',
      title: 'Settings & AI Status',
      subtitle: 'Experience profile, LLM adapter, and backups',
      category: 'Navigation',
      icon: Settings,
      action: () => router.push('/settings'),
    },
  ];

  // Asset Items
  const assetItems = assets.map(a => ({
    id: `asset-${a.id}`,
    title: `${a.assetTag} — ${a.name}`,
    subtitle: `${a.assetType} • ${a.ipAddress || 'No IP'} • ${a.operatingSystem || ''}`,
    category: 'IT Assets',
    icon: Server,
    action: () => router.push(`/assets/${a.id}`),
  }));

  // Incident Items
  const incidentItems = incidents.map(inc => ({
    id: `inc-${inc.id}`,
    title: `${inc.ticketNumber}: ${inc.title}`,
    subtitle: `Status: ${inc.status} • Severity: ${inc.severity} • ${inc.category}`,
    category: 'Incidents',
    icon: History,
    action: () => router.push(`/incident/${inc.id}`),
  }));

  // Knowledge Base Quick Codes
  const kbItems = [
    {
      id: 'kb-smb',
      title: '0x80070035 — SMB Network Path Not Found',
      subtitle: 'File sharing & port 445 connectivity remediation',
      category: 'Knowledge Base',
      icon: BookOpen,
      action: () => router.push('/knowledge-base?search=0x80070035'),
    },
    {
      id: 'kb-dns',
      title: 'NXDOMAIN — Internal DNS Name Resolution Failure',
      subtitle: 'Domain controller DNS cache flush & client configuration',
      category: 'Knowledge Base',
      icon: BookOpen,
      action: () => router.push('/knowledge-base?search=NXDOMAIN'),
    },
    {
      id: 'kb-spooler',
      title: 'PRT_SPOOL_DEADLOCK — Print Spooler Stuck',
      subtitle: 'Corrupted SPL payload purge and service restart',
      category: 'Knowledge Base',
      icon: BookOpen,
      action: () => router.push('/knowledge-base?search=PRT_SPOOL_DEADLOCK'),
    },
    {
      id: 'kb-event7000',
      title: 'EVENT_7000 — Windows Service Start Failure',
      subtitle: 'Service account logon rights and timeout adjustments',
      category: 'Knowledge Base',
      icon: BookOpen,
      action: () => router.push('/knowledge-base?search=EVENT_7000'),
    },
    {
      id: 'kb-gateway',
      title: 'ERR_GATEWAY_TIMEOUT — Default Gateway Ping Timeout',
      subtitle: 'ARP cache purge and switch port VLAN check',
      category: 'Knowledge Base',
      icon: BookOpen,
      action: () => router.push('/knowledge-base?search=ERR_GATEWAY_TIMEOUT'),
    },
  ];

  // Combined pool
  const allItems = [...navigationItems, ...kbItems, ...assetItems, ...incidentItems];

  const filteredItems = query.trim()
    ? allItems.filter(
        item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : navigationItems;

  const handleSelect = (item: typeof filteredItems[0]) => {
    item.action();
    onClose();
  };

  // Handle arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl shadow-cyan-950/30 overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-900/50">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search assets, incidents, error codes (e.g. 0x80070035, dc-dns-01)..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No matching commands, assets, or solutions found for &quot;{query}&quot;.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-200'
                      : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`p-1.5 rounded-md ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate flex items-center gap-2">
                        <span>{item.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 font-mono">
                      {item.category}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/80 bg-slate-950 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">FixFlow AI</span>
            <span>•</span>
            <span>Copyrighted &copy; {new Date().getFullYear()} Adarsh Panicker</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">Enter</kbd> Select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
