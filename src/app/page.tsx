// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  Network,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Shield,
  Sparkles,
  BookOpen,
  Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { repository } from '@/lib/data/repository';
import { Incident } from '@/types/incident';
import { Asset } from '@/types/asset';

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [kbStats, setKbStats] = useState<any>(null);

  const loadData = () => {
    setIncidents(repository.getIncidents());
    setAssets(repository.getAssets());
    fetch('/api/knowledge-base/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) setKbStats(data.stats);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    window.addEventListener('fixflow-data-changed', loadData);
    return () => window.removeEventListener('fixflow-data-changed', loadData);
  }, []);

  const activeIncidents = incidents.filter(
    i => i.status === 'OPEN' || i.status === 'INVESTIGATING' || i.status === 'TRIAGED'
  );
  const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED');
  const criticalCount = incidents.filter(i => i.severity === 'P1_CRITICAL').length;
  const highCount = incidents.filter(i => i.severity === 'P2_HIGH').length;

  const operationalAssets = assets.filter(a => a.status === 'OPERATIONAL').length;
  const degradedAssets = assets.filter(a => a.status === 'DEGRADED' || a.status === 'OFFLINE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Hero Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-500/10 via-cyan-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950/50">
              <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-white">FixFlow AI</h2>
                <Badge variant="cyan" size="sm">Autonomous IT Support Engineer</Badge>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  By Adarsh Panicker
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Inventory-grounded autonomous diagnostics, ICMP infrastructure availability monitoring, and local error solution knowledge base.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Link href="/knowledge-base">
              <Button variant="outline" size="sm" leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}>
                Local KB ({kbStats ? kbStats.totalArticles : 6})
              </Button>
            </Link>
            <Link href="/monitoring">
              <Button variant="outline" size="sm" leftIcon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}>
                ICMP Monitoring
              </Button>
            </Link>
            <Link href="/incident/new">
              <Button variant="cyan" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                Start New Triage
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">IT Operations Dashboard</h1>
            <Badge variant="cyan" size="sm">Air-Gapped v1.0</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time incident state and inventory grounding. Showing current repository records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/assets">
            <Button variant="secondary" size="sm" leftIcon={<Server className="w-3.5 h-3.5 text-slate-400" />}>
              Manage Assets ({assets.length})
            </Button>
          </Link>
          <Link href="/incident/new">
            <Button variant="primary" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              New Triage Session
            </Button>
          </Link>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-cyan-500/20 bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Investigations</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{activeIncidents.length}</h3>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-rose-400 font-semibold">{criticalCount} Critical (P1)</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{highCount} High (P2)</span>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Registered Assets</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{assets.length}</h3>
            </div>
            <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-medium">{operationalAssets} Healthy</span>
            <span>•</span>
            <span className="text-amber-400 font-medium">{degradedAssets} Degraded / Offline</span>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolved Tickets</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{resolvedIncidents.length}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            With verified post-mortem documentation
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Infrastructure Topologies</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">13</h3>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
              <Network className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            <Link href="/dependency-map" className="text-cyan-400 hover:underline flex items-center gap-1">
              <span>View Dependency Graph</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Main Grid: Active Incidents & Quick Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Incident Queue (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Active Incident Queue</CardTitle>
                <CardDescription>
                  Click any ticket to enter its diagnostic workbench or post-mortem report.
                </CardDescription>
              </div>
              <Link href="/investigations">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  View All ({incidents.length})
                </Button>
              </Link>
            </CardHeader>

            <div className="divide-y divide-slate-800/80">
              {incidents.slice(0, 5).map(inc => (
                <div
                  key={inc.id}
                  className="py-3.5 px-2 hover:bg-slate-800/40 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-cyan-400">
                        {inc.ticketNumber}
                      </span>
                      {inc.severity === 'P1_CRITICAL' && (
                        <Badge variant="rose" size="sm">P1 Critical</Badge>
                      )}
                      {inc.severity === 'P2_HIGH' && (
                        <Badge variant="amber" size="sm">P2 High</Badge>
                      )}
                      {inc.severity === 'P3_MEDIUM' && (
                        <Badge variant="slate" size="sm">P3 Medium</Badge>
                      )}
                      <Badge variant="cyan" size="sm">{inc.category}</Badge>
                      {inc.isDemo && <Badge variant="demo" size="sm">Demo</Badge>}
                    </div>

                    <Link
                      href={`/incident/${inc.id}`}
                      className="text-xs font-medium text-slate-200 hover:text-cyan-400 transition-colors block line-clamp-1"
                    >
                      {inc.title}
                    </Link>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {inc.targetAsset && (
                        <span>Asset: <strong className="text-slate-300 font-mono">{inc.targetAsset.assetTag}</strong></span>
                      )}
                      <span>Mode: <strong className="text-slate-300">{inc.diagnosticMode}</strong></span>
                      <span>Status: <strong className="text-slate-300">{inc.status}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/incident/${inc.id}`}>
                      <Button variant="secondary" size="sm">
                        Workbench
                      </Button>
                    </Link>
                    <Link href={`/incident/${inc.id}/report`}>
                      <Button variant="outline" size="sm">
                        Report
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Rail: Quick Diagnostic Launcher */}
        <div className="space-y-4">
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div>
                <CardTitle className="text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Quick Triage Presets
                </CardTitle>
                <CardDescription>
                  Instantly launch verified deterministic troubleshooting playbooks.
                </CardDescription>
              </div>
            </CardHeader>

            <div className="space-y-2.5">
              <Link href="/incident/INC-2026-0842" className="block">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">VPN / File Share Outage</span>
                    <Badge variant="amber" size="sm">Guided</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    MTU fragmentation black hole vs missing route push on FW-EDGE-01.
                  </p>
                </div>
              </Link>

              <Link href="/incident/INC-2026-0843" className="block">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">DNS Resolution Failure</span>
                    <Badge variant="rose" size="sm">P1 Critical</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Internal zone delegation timeout between DC-DNS-01 and DC-DNS-02.
                  </p>
                </div>
              </Link>

              <Link href="/incident/INC-2026-0844" className="block">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">Print Spooler Crash Loop</span>
                    <Badge variant="cyan" size="sm">Service</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Corrupted spool queue file causing heap crash on SRV-PRINT-01.
                  </p>
                </div>
              </Link>

              <Link href="/incident/INC-2026-0846" className="block">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">VSS Backup Job Abort</span>
                    <Badge variant="violet" size="sm">Agent Mode</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Volume shadow storage limit reached on database VM SRV-SQL-01.
                  </p>
                </div>
              </Link>
            </div>
          </Card>

          {/* Safety Sandbox Status */}
          <Card className="bg-slate-950/50 border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <h4 className="font-semibold text-slate-200">Safety Policy Active</h4>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  All generated commands are strictly read-only. Shell chaining, subshells, and write operations are blocked.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
