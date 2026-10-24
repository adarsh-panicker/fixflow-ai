// src/app/monitoring/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  Radio,
  Server,
  Terminal,
  ShieldAlert,
  Play,
  Search,
  ExternalLink,
  Sliders,
  Check,
  Zap,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/NotificationToast';
import {
  MonitoringDashboardSummary,
  MonitoredAssetRowDTO,
  MonitoringAgentDTO,
} from '@/types/monitoring';

export default function MonitoringDashboardPage() {
  const [summary, setSummary] = useState<MonitoringDashboardSummary | null>(null);
  const [rows, setRows] = useState<MonitoredAssetRowDTO[]>([]);
  const [agents, setAgents] = useState<MonitoringAgentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState('ALL');

  // Modals
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedAssetForConfig, setSelectedAssetForConfig] = useState<MonitoredAssetRowDTO | null>(null);

  // Simulation form
  const [simMode, setSimMode] = useState<'HEALTHY' | 'DEGRADED_LATENCY' | 'PACKET_LOSS' | 'OFFLINE_OUTAGE' | 'RANDOM_CHAOS'>('HEALTHY');
  const [isSimulating, setIsSimulating] = useState(false);

  // Agent registration form
  const [newAgentName, setNewAgentName] = useState('Ops-LAN-Prober-02');
  const [newAgentPlatform, setNewAgentPlatform] = useState<'win32' | 'linux'>('win32');
  const [registeredAgentKey, setRegisteredAgentKey] = useState<string | null>(null);
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null);
  const [isRegisteringAgent, setIsRegisteringAgent] = useState(false);

  // Config edit form
  const [cfgIp, setCfgIp] = useState('');
  const [cfgInterval, setCfgInterval] = useState('60');
  const [cfgTimeout, setCfgTimeout] = useState('2');
  const [cfgPackets, setCfgPackets] = useState('3');
  const [cfgFailThreshold, setCfgFailThreshold] = useState('3');
  const [cfgRecovThreshold, setCfgRecovThreshold] = useState('2');
  const [cfgLatencyWarn, setCfgLatencyWarn] = useState('100');
  const [cfgLossWarn, setCfgLossWarn] = useState('20');
  const [cfgEnabled, setCfgEnabled] = useState(true);
  const [cfgSuppress, setCfgSuppress] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (statusFilter !== 'ALL') q.set('status', statusFilter);
      if (agentFilter !== 'ALL') q.set('agentId', agentFilter);

      const [dashRes, agentsRes] = await Promise.all([
        fetch(`/api/monitoring/dashboard?${q.toString()}`),
        fetch('/api/monitoring/agents'),
      ]);

      const dashData = await dashRes.json();
      const agentsData = await agentsRes.json();

      if (dashData.success) {
        setSummary(dashData.summary);
        setRows(dashData.rows);
      }
      if (agentsData.success) {
        setAgents(agentsData.agents);
      }
    } catch (err: any) {
      toast({ title: 'Error Loading Monitoring Data', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, agentFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Simulation Run
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/monitoring/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: simMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({
        title: 'Simulation Probe Ingested',
        message: `Executed synthetic probe cycle in '${simMode}' mode across ${data.result.ingestedCount} assets.`,
        type: 'success',
      });
      setIsSimModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Simulation Error', message: err.message, type: 'error' });
    } finally {
      setIsSimulating(false);
    }
  };

  // Handle Register Agent
  const handleRegisterAgent = async () => {
    setIsRegisteringAgent(true);
    try {
      const res = await fetch('/api/monitoring/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          platform: newAgentPlatform,
          version: '1.0.0',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setRegisteredAgentKey(data.agentKey);
      setRegisteredAgentId(data.agent.id);
      toast({
        title: 'Agent Credential Provisioned',
        message: `Successfully provisioned ${data.agent.name}. Copy the token below.`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Registration Failed', message: err.message, type: 'error' });
    } finally {
      setIsRegisteringAgent(false);
    }
  };

  // Open config modal
  const openConfigModal = (assetRow: MonitoredAssetRowDTO) => {
    setSelectedAssetForConfig(assetRow);
    setCfgIp(assetRow.targetIp);
    setCfgEnabled(assetRow.configEnabled);
    setIsConfigModalOpen(true);
  };

  // Save Config
  const handleSaveConfig = async () => {
    if (!selectedAssetForConfig) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`/api/monitoring/config/${selectedAssetForConfig.assetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIp: cfgIp.trim(),
          pollingIntervalSeconds: parseInt(cfgInterval, 10),
          timeoutSeconds: parseInt(cfgTimeout, 10),
          packetCount: parseInt(cfgPackets, 10),
          failureThreshold: parseInt(cfgFailThreshold, 10),
          recoveryThreshold: parseInt(cfgRecovThreshold, 10),
          latencyWarningMs: cfgLatencyWarn ? parseFloat(cfgLatencyWarn) : null,
          packetLossWarningPercent: cfgLossWarn ? parseFloat(cfgLossWarn) : null,
          enabled: cfgEnabled,
          suppressAlerts: cfgSuppress,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({
        title: 'Monitoring Configuration Updated',
        message: `Updated ICMP parameters for ${selectedAssetForConfig.assetTag}.`,
        type: 'success',
      });
      setIsConfigModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save Config Failed', message: err.message, type: 'error' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Acknowledge Incident
  const handleAcknowledgeIncident = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/monitoring/incidents/${incidentId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy: 'Lead Infrastructure Engineer' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Alert Acknowledged', message: 'Marked outage alert acknowledged.', type: 'info' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Action Failed', message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-100">
                  Infrastructure Availability Monitoring
                </h1>
                <Badge variant="cyan" size="sm">ICMP Echo</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                On-premises probers report reachability, latency, and packet loss for registered assets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => loadData()}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5 text-amber-400" />}
            onClick={() => setIsSimModalOpen(true)}
          >
            Synthetic Simulation (Demo)
          </Button>

          <Button
            variant="cyan"
            size="sm"
            leftIcon={<Terminal className="w-3.5 h-3.5" />}
            onClick={() => setIsAgentModalOpen(true)}
          >
            Deploy Local Agent
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Monitored Assets</span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-slate-100">{summary.totalMonitoredAssets}</span>
              <Server className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Configured for ICMP</p>
          </Card>

          <Card className="p-3.5 border-emerald-900/40 bg-emerald-950/10">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Online
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-400">{summary.onlineAssets}</span>
              <span className="text-[10px] font-mono text-emerald-500">
                {summary.totalMonitoredAssets > 0 ? Math.round((summary.onlineAssets / summary.totalMonitoredAssets) * 100) : 0}%
              </span>
            </div>
            <p className="text-[10px] text-emerald-500/80 mt-1">Responding normally</p>
          </Card>

          <Card className="p-3.5 border-amber-900/40 bg-amber-950/10">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Degraded
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-amber-400">{summary.degradedAssets}</span>
              <span className="text-[10px] font-mono text-amber-500">High Latency/Loss</span>
            </div>
            <p className="text-[10px] text-amber-500/80 mt-1">Warning threshold exceeded</p>
          </Card>

          <Card className="p-3.5 border-rose-900/40 bg-rose-950/10">
            <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Offline
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-rose-400">{summary.offlineAssets}</span>
              <span className="text-[10px] font-mono text-rose-500">{summary.activeIncidentsCount} Outages</span>
            </div>
            <p className="text-[10px] text-rose-500/80 mt-1">Threshold consecutive failures</p>
          </Card>

          <Card className="p-3.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              Unknown / Maint
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-slate-300">{summary.unknownAssets + summary.maintenanceAssets}</span>
              <span className="text-[10px] font-mono text-slate-500">M: {summary.maintenanceAssets}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Stale or suppressed</p>
          </Card>

          <Card className="p-3.5">
            <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Monitoring Agents
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold font-mono text-cyan-400">{summary.connectedAgents}</span>
              <span className="text-[10px] font-mono text-slate-500">/ {summary.connectedAgents + summary.disconnectedAgents} Active</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {summary.disconnectedAgents > 0 ? `${summary.disconnectedAgents} agent(s) disconnected` : 'All agents healthy'}
            </p>
          </Card>
        </div>
      )}

      {/* Provider Transparency Banner */}
      {summary && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-slate-100 font-semibold">Measurement Provenance: </strong>
              {summary.providerBreakdown.realAgentCount} checks from Local Agents, {summary.providerBreakdown.simulationCount} checks from Synthetic Simulation.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-slate-400">
              Avg Latency: <strong className="text-slate-200 font-mono">{summary.averageLatencyMs != null ? `${summary.averageLatencyMs}ms` : 'N/A'}</strong>
            </span>
            <span className="text-slate-400">
              Avg Loss: <strong className="text-slate-200 font-mono">{summary.averagePacketLossPercent != null ? `${summary.averagePacketLossPercent}%` : 'N/A'}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Active Availability Incidents Alert Strip */}
      {summary && summary.recentIncidents.length > 0 && (
        <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Availability Incidents</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                {summary.recentIncidents.length} Unresolved
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Derived from consecutive threshold crossing</span>
          </div>

          <div className="space-y-2">
            {summary.recentIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 rounded-lg border border-rose-900/40 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-300">{inc.assetTag}</span>
                    <Badge variant={inc.severity === 'P1_CRITICAL' ? 'rose' : 'amber'} size="sm">
                      {inc.severity}
                    </Badge>
                    <span className="text-slate-200 font-medium">{inc.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{inc.failureSummary}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/incident/new?asset=${inc.assetId}&title=${encodeURIComponent(inc.title)}`}>
                    <Button variant="cyan" size="sm" leftIcon={<Zap className="w-3 h-3" />}>
                      Triage with AI
                    </Button>
                  </Link>

                  {inc.status === 'TRIGGERED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAcknowledgeIncident(inc.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitored Assets Table Section */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Monitored Assets & Live Reachability</CardTitle>
            <CardDescription>
              Real-time availability status computed by monitoring engine based on configured thresholds.
            </CardDescription>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tag, IP, name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ONLINE">Online</option>
              <option value="DEGRADED">Degraded</option>
              <option value="OFFLINE">Offline</option>
              <option value="UNKNOWN">Unknown</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Agents</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Target IP</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Latest Latency</th>
                <th className="py-3 px-4">Packet Loss</th>
                <th className="py-3 px-4">Last Check</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No monitored assets matched the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.assetId} className="hover:bg-slate-900/30 transition-colors">
                    {/* Asset Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/assets/${row.assetId}`}
                          className="font-mono font-bold text-slate-200 hover:text-cyan-400 transition-colors"
                        >
                          {row.assetTag}
                        </Link>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {row.assetType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{row.assetName}</p>
                    </td>

                    {/* Target IP */}
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {row.targetIp}
                    </td>

                    {/* Status with accessible text + icon */}
                    <td className="py-3 px-4">
                      {row.status === 'ONLINE' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Online
                        </span>
                      )}
                      {row.status === 'DEGRADED' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Degraded
                        </span>
                      )}
                      {row.status === 'OFFLINE' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          Offline
                        </span>
                      )}
                      {row.status === 'MAINTENANCE' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Clock className="w-3 h-3 text-purple-400" />
                          Maintenance
                        </span>
                      )}
                      {row.status === 'UNKNOWN' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <HelpCircle className="w-3 h-3 text-slate-400" />
                          Unknown
                        </span>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-4 font-mono">
                      {row.latestLatencyMs != null ? (
                        <span className={row.latestLatencyMs > 100 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {row.latestLatencyMs.toFixed(1)}ms
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Packet Loss */}
                    <td className="py-3 px-4 font-mono">
                      {row.latestPacketLoss != null ? (
                        <span className={row.latestPacketLoss > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {row.latestPacketLoss}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Last Check */}
                    <td className="py-3 px-4 text-slate-400">
                      {row.lastCheckTime ? (
                        <div className="space-y-0.5">
                          <p>{new Date(row.lastCheckTime).toLocaleTimeString()}</p>
                          <p className="text-[10px] text-slate-500">
                            {Math.round(row.statusDurationSeconds / 60)}m ago
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-600">Never</span>
                      )}
                    </td>

                    {/* Assigned Agent */}
                    <td className="py-3 px-4 text-slate-300">
                      <span className="truncate max-w-[140px] block" title={row.agentName || 'Unassigned'}>
                        {row.agentName || 'Auto-Prober'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfigModal(row)}
                          title="Configure Monitoring"
                        >
                          <Sliders className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" />
                        </Button>

                        <Link href={`/assets/${row.assetId}?tab=monitoring`}>
                          <Button variant="ghost" size="sm" title="View History & Metrics">
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-cyan-400" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Simulation Modal */}
      <Modal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        title="Synthetic Monitoring Simulation (Demo Sandbox)"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            FixFlow AI provides a built-in simulation provider to verify threshold triggers, status transitions, and AI triage without needing active physical network devices.
          </p>

          <div className="space-y-2">
            <label className="font-semibold text-slate-300 block">Simulation Test Profile:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'HEALTHY', label: '100% Healthy Online', desc: 'Low latency (1-8ms), 0% loss.' },
                { id: 'DEGRADED_LATENCY', label: 'High Latency Spike', desc: 'Exceeds warning threshold (120-250ms).' },
                { id: 'PACKET_LOSS', label: 'Intermittent Drop (33-66%)', desc: 'Packet loss exceeds warning.' },
                { id: 'OFFLINE_OUTAGE', label: 'Complete Outage (Timeout)', desc: '100% loss. Triggers availability incident.' },
                { id: 'RANDOM_CHAOS', label: 'Mixed Enterprise Chaos', desc: 'Probabilistic spread of states.' },
              ].map((prof) => (
                <div
                  key={prof.id}
                  onClick={() => setSimMode(prof.id as any)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    simMode === prof.id
                      ? 'border-cyan-500 bg-cyan-950/30 text-slate-100'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <p className="font-semibold text-slate-200">{prof.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{prof.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <strong>Note:</strong> All results generated by this tool are explicitly tagged with <code className="bg-slate-900 px-1 py-0.5 rounded font-mono">provider: SIMULATION</code> for complete audit transparency.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsSimModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="cyan"
              onClick={handleRunSimulation}
              isLoading={isSimulating}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Run Synthetic Cycle
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deploy Agent Modal */}
      <Modal
        isOpen={isAgentModalOpen}
        onClose={() => {
          setIsAgentModalOpen(false);
          setRegisteredAgentKey(null);
        }}
        title="Deploy Dedicated Local Monitoring Agent"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            To monitor private on-premises LAN assets without opening inbound firewall ports, deploy the lightweight FixFlow AI local agent on an administrator machine inside your network.
          </p>

          {!registeredAgentKey ? (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Agent Friendly Name:</label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Host Platform:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="platform"
                      value="win32"
                      checked={newAgentPlatform === 'win32'}
                      onChange={() => setNewAgentPlatform('win32')}
                    />
                    <span>Windows (ping.exe)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="platform"
                      value="linux"
                      checked={newAgentPlatform === 'linux'}
                      onChange={() => setNewAgentPlatform('linux')}
                    />
                    <span>Linux / Unix (ping)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button variant="secondary" onClick={() => setIsAgentModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="cyan"
                  onClick={handleRegisterAgent}
                  isLoading={isRegisteringAgent}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Generate Agent Key
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/60 text-emerald-300">
                <p className="font-bold">Agent Credential Provisioned Successfully!</p>
                <p className="text-[11px] mt-1">Copy this command. The secret token is shown once.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 select-all overflow-x-auto">
                {`npx tsx agent/index.ts --agent-id ${registeredAgentId} --key ${registeredAgentKey} --server http://localhost:3000`}
              </div>

              <div className="space-y-1 text-slate-400 text-[11px]">
                <p>• <strong>Windows:</strong> Runs without elevated privileges using native Windows ICMP.</p>
                <p>• <strong>Least Privilege:</strong> Agent only accepts approved assignments and cannot execute arbitrary commands.</p>
              </div>

              <div className="flex justify-end">
                <Button variant="cyan" onClick={() => setIsAgentModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Config Edit Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={`Configure Monitoring: ${selectedAssetForConfig?.assetTag || ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Target IP Address:</label>
              <input
                type="text"
                value={cfgIp}
                onChange={(e) => setCfgIp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Polling Interval (seconds):</label>
              <input
                type="number"
                value={cfgInterval}
                min="10"
                max="3600"
                onChange={(e) => setCfgInterval(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Per-Check Timeout (seconds):</label>
              <input
                type="number"
                value={cfgTimeout}
                min="1"
                max="10"
                onChange={(e) => setCfgTimeout(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Echo Packets / Probe:</label>
              <input
                type="number"
                value={cfgPackets}
                min="1"
                max="10"
                onChange={(e) => setCfgPackets(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Failure Threshold (consecutive):</label>
              <input
                type="number"
                value={cfgFailThreshold}
                min="1"
                max="10"
                onChange={(e) => setCfgFailThreshold(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Recovery Threshold (consecutive):</label>
              <input
                type="number"
                value={cfgRecovThreshold}
                min="1"
                max="10"
                onChange={(e) => setCfgRecovThreshold(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Latency Warning (ms):</label>
              <input
                type="number"
                value={cfgLatencyWarn}
                onChange={(e) => setCfgLatencyWarn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Packet Loss Warning (%):</label>
              <input
                type="number"
                value={cfgLossWarn}
                onChange={(e) => setCfgLossWarn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cfgEnabled}
                onChange={(e) => setCfgEnabled(e.target.checked)}
              />
              <span className="font-medium text-slate-200">Enable Active Monitoring</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cfgSuppress}
                onChange={(e) => setCfgSuppress(e.target.checked)}
              />
              <span className="font-medium text-slate-200">Suppress Outage Alerts (Maintenance)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="cyan"
              onClick={handleSaveConfig}
              isLoading={isSavingConfig}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
