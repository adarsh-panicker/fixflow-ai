// src/app/assets/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Network,
  Trash2,
  Plus,
  ArrowRight,
  Activity,
  Edit2,
  CheckCircle2,
  Tag,
  Loader2,
  AlertTriangle,
  XCircle,
  Clock,
  Sliders,
  HelpCircle,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/NotificationToast';

export default function AssetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = params?.id as string;

  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'specs');
  const [asset, setAsset] = useState<any>(null);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Monitoring config form states
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

  // Relationship form
  const [targetAssetId, setTargetAssetId] = useState('');
  const [relType, setRelType] = useState('DEPENDS_ON');
  const [relProvenance, setRelProvenance] = useState('USER_CONFIRMED');
  const [depDesc, setDepDesc] = useState('');

  // Edit asset form
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editHostname, setEditHostname] = useState('');
  const [editIp, setEditIp] = useState('');
  const [editOs, setEditOs] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editCriticality, setEditCriticality] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!assetId) return;
    setIsLoading(true);
    try {
      const [assetRes, allRes, monRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch('/api/assets'),
        fetch(`/api/monitoring/assets/${assetId}/history`),
      ]);

      const assetData = await assetRes.json();
      const allData = await allRes.json();
      const monData = await monRes.json();

      if (assetData.success && assetData.asset) {
        setAsset(assetData.asset);
        // Pre-populate edit form
        const a = assetData.asset;
        setEditName(a.name);
        setEditType(a.assetType);
        setEditManufacturer(a.manufacturer || '');
        setEditModel(a.model || '');
        setEditHostname(a.hostname || '');
        setEditIp(a.ipAddress || '');
        setEditOs(a.operatingSystem || '');
        setEditLocation(a.location || '');
        setEditOwner(a.owner || '');
        setEditTags(a.tags || '');
        setEditCriticality(a.criticality);
        setEditStatus(a.status);
        setEditNotes(a.notes || '');

        setCfgIp(a.ipAddress || '');
      }

      if (monData.success) {
        setMonitoringData(monData);
        if (monData.config) {
          const c = monData.config;
          setCfgIp(c.targetIp);
          setCfgInterval(String(c.pollingIntervalSeconds));
          setCfgTimeout(String(c.timeoutSeconds));
          setCfgPackets(String(c.packetCount));
          setCfgFailThreshold(String(c.failureThreshold));
          setCfgRecovThreshold(String(c.recoveryThreshold));
          setCfgLatencyWarn(String(c.latencyWarningMs || '100'));
          setCfgLossWarn(String(c.packetLossWarningPercent || '20'));
          setCfgEnabled(c.enabled);
          setCfgSuppress(c.suppressAlerts);
        }
      }

      if (allData.success && Array.isArray(allData.assets)) {
        setAllAssets(allData.assets);
      }
    } catch (err: any) {
      toast({ title: 'Fetch Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [assetId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !asset) {
    return (
      <div className="py-16 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
        <p className="text-xs text-slate-400">Loading asset specification from persistent database...</p>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setAsset(data.asset);
      toast({
        title: 'Status Updated',
        message: `${asset.assetTag} operational status changed to ${newStatus}.`,
        type: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Update Error', message: err.message, type: 'error' });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          assetType: editType,
          manufacturer: editManufacturer.trim() || null,
          model: editModel.trim() || null,
          hostname: editHostname.trim().toLowerCase() || null,
          ipAddress: editIp.trim() || null,
          operatingSystem: editOs.trim() || null,
          location: editLocation.trim() || null,
          owner: editOwner.trim() || null,
          tags: editTags.trim() || null,
          criticality: editCriticality,
          status: editStatus,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Asset Updated', message: `${asset.assetTag} updated successfully.`, type: 'success' });
      setIsEditOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save Error', message: err.message, type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Asset Deleted', message: `${asset.assetTag} removed from inventory.`, type: 'info' });
      router.push('/assets');
    } catch (err: any) {
      toast({ title: 'Delete Error', message: err.message, type: 'error' });
    }
  };

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssetId) {
      toast({ title: 'Validation Error', message: 'Target asset is required.', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws-default',
          sourceAssetId: asset.id,
          targetAssetId,
          relationshipType: relType,
          provenance: relProvenance,
          description: depDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Relationship Created', message: 'Infrastructure link saved to persistent database.', type: 'success' });
      setIsAddDepOpen(false);
      setTargetAssetId('');
      setDepDesc('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Relationship Error', message: err.message, type: 'error' });
    }
  };

  const handleConfirmSuggestedRel = async (relId: string) => {
    try {
      const res = await fetch(`/api/relationships/${relId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provenance: 'USER_CONFIRMED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Relationship Confirmed', message: 'Marked as user-confirmed in topology.', type: 'success' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleDeleteRelationship = async (relId: string) => {
    try {
      const res = await fetch(`/api/relationships/${relId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({ title: 'Relationship Detached', type: 'info' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Detach Error', message: err.message, type: 'error' });
    }
  };

  const handleSaveMonitoringConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch(`/api/monitoring/config/${asset.id}`, {
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

      toast({ title: 'Monitoring Configuration Saved', type: 'success' });
      setIsConfigModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save Config Failed', message: err.message, type: 'error' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link href="/assets">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Inventory
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono">
                {asset.assetTag}
              </h1>
              {asset.isDemo && <Badge variant="demo" size="sm">Demo</Badge>}
              {asset.status === 'OPERATIONAL' && <Badge variant="emerald" size="sm">Operational</Badge>}
              {asset.status === 'DEGRADED' && <Badge variant="amber" size="sm">Degraded</Badge>}
              {asset.status === 'OFFLINE' && <Badge variant="rose" size="sm">Offline</Badge>}
              {asset.status === 'MAINTENANCE' && <Badge variant="slate" size="sm">Maintenance</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{asset.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => setIsEditOpen(true)}
          >
            Edit Specifications
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}
            onClick={() => {
              setActiveTab('monitoring');
              setIsConfigModalOpen(true);
            }}
          >
            Configure ICMP
          </Button>

          <Link href={`/incident/new?asset=${asset.id}`}>
            <Button variant="cyan" size="sm" leftIcon={<Activity className="w-3.5 h-3.5" />}>
              Triage Incident
            </Button>
          </Link>

          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('specs')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'specs'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Technical Specs & Links
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'monitoring'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>ICMP Availability Monitoring</span>
          {monitoringData?.state?.currentStatus && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                monitoringData.state.currentStatus === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : monitoringData.state.currentStatus === 'DEGRADED'
                  ? 'bg-amber-500/20 text-amber-300'
                  : monitoringData.state.currentStatus === 'OFFLINE'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {monitoringData.state.currentStatus}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'monitoring' ? (
        <div className="space-y-6">
          {/* Top Live Health & State Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>ICMP Availability & Probe Telemetry</CardTitle>
                <CardDescription>
                  Empirical reachability measurements reported by authorized monitoring probers.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sliders className="w-3.5 h-3.5" />}
                  onClick={() => setIsConfigModalOpen(true)}
                >
                  Configure Parameters
                </Button>
              </div>
            </CardHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Current State</span>
                <div>
                  {monitoringData?.state?.currentStatus === 'ONLINE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Online
                    </span>
                  )}
                  {monitoringData?.state?.currentStatus === 'DEGRADED' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" /> Degraded
                    </span>
                  )}
                  {monitoringData?.state?.currentStatus === 'OFFLINE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" /> Offline
                    </span>
                  )}
                  {monitoringData?.state?.currentStatus === 'MAINTENANCE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Clock className="w-3.5 h-3.5" /> Maintenance
                    </span>
                  )}
                  {(!monitoringData?.state || monitoringData?.state?.currentStatus === 'UNKNOWN') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      <HelpCircle className="w-3.5 h-3.5" /> Unknown
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Latest Latency</span>
                <p className="text-sm font-mono font-bold text-cyan-400">
                  {monitoringData?.state?.latestLatencyMs != null ? `${monitoringData.state.latestLatencyMs.toFixed(1)}ms` : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Threshold: {monitoringData?.config?.latencyWarningMs || 100}ms</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Packet Loss</span>
                <p className="text-sm font-mono font-bold text-slate-200">
                  {monitoringData?.state?.latestPacketLoss != null ? `${monitoringData.state.latestPacketLoss}%` : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Threshold: {monitoringData?.config?.packetLossWarningPercent || 20}%</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Monitoring Agent</span>
                <p className="text-xs font-medium text-slate-200 truncate">
                  {monitoringData?.config?.agent?.name || 'Auto-Assigned Prober'}
                </p>
                <span className="text-[10px] text-slate-500 font-mono">Target: {monitoringData?.config?.targetIp || asset.ipAddress || 'None'}</span>
              </div>
            </div>

            {monitoringData?.state?.transitionReason && (
              <div className="mt-4 p-3 rounded-lg border border-slate-800 bg-slate-950/80 flex items-center gap-2 text-xs text-slate-300">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong className="text-slate-200">State Transition Context: </strong>
                  {monitoringData.state.transitionReason}
                </span>
              </div>
            )}
          </Card>

          {/* Latency Visualizer & Recent Check History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visualizer Card */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent Latency & Loss Trend</CardTitle>
                  <CardDescription>Last 20 ICMP Echo responses recorded.</CardDescription>
                </div>
              </CardHeader>

              <div className="p-4 space-y-4">
                {monitoringData?.checks && monitoringData.checks.length > 0 ? (
                  <div>
                    {/* Visual bar chart */}
                    <div className="h-32 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-800">
                      {[...monitoringData.checks].reverse().map((c: any) => {
                        const isTimeout = c.result === 'TIMEOUT' || c.result === 'UNREACHABLE';
                        const isHigh = c.averageLatencyMs > 100;
                        const heightPercent = isTimeout
                          ? 100
                          : Math.min(100, Math.max(10, Math.round((c.averageLatencyMs || 5) * 1.5)));

                        return (
                          <div
                            key={c.id}
                            className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                          >
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full rounded-t transition-all ${
                                isTimeout
                                  ? 'bg-rose-500/80'
                                  : isHigh
                                  ? 'bg-amber-500/80'
                                  : 'bg-cyan-500/80'
                              }`}
                            />
                            {/* Hover tooltip */}
                            <div className="hidden group-hover:block absolute bottom-full mb-1 z-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200 whitespace-nowrap shadow-lg">
                              {c.averageLatencyMs ? `${c.averageLatencyMs}ms` : c.result} ({c.packetLossPercent}% loss)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>Older checks</span>
                      <span>Latest probe</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No probe measurements recorded for this asset yet.
                  </p>
                )}
              </div>
            </Card>

            {/* Check Records Table */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Telemetry Log</CardTitle>
                  <CardDescription>Individual probe results and packet statistics.</CardDescription>
                </div>
              </CardHeader>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                {monitoringData?.checks && monitoringData.checks.length > 0 ? (
                  monitoringData.checks.map((c: any) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {c.result === 'SUCCESS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className="font-mono text-slate-200">{new Date(c.checkedAt).toLocaleTimeString()}</span>
                        <Badge variant={c.provider === 'SIMULATION' ? 'amber' : 'slate'} size="sm">
                          {c.provider === 'SIMULATION' ? 'Sim' : 'Agent'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        <span className={c.averageLatencyMs > 100 ? 'text-amber-400' : 'text-slate-300'}>
                          {c.averageLatencyMs != null ? `${c.averageLatencyMs.toFixed(1)}ms` : '—'}
                        </span>
                        <span className={c.packetLossPercent > 0 ? 'text-rose-400' : 'text-slate-400'}>
                          {c.packetLossPercent}% loss
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">No telemetry entries.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Availability Incident Outage History */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Availability Outage History</CardTitle>
                <CardDescription>
                  Incidents triggered when consecutive probe failures exceeded the threshold.
                </CardDescription>
              </div>
            </CardHeader>

            <div className="divide-y divide-slate-800/60 text-xs">
              {monitoringData?.incidents && monitoringData.incidents.length > 0 ? (
                monitoringData.incidents.map((inc: any) => (
                  <div key={inc.id} className="p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={inc.status === 'RECOVERED' ? 'emerald' : 'rose'} size="sm">
                          {inc.status}
                        </Badge>
                        <span className="font-semibold text-slate-200">{inc.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(inc.thresholdCrossedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{inc.failureSummary}</p>
                    {inc.recoveredAt && (
                      <p className="text-[11px] text-emerald-400/90">
                        <strong>Recovery: </strong>{inc.recoverySummary} (Outage duration: {inc.outageDurationSeconds}s)
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">
                  No availability outages recorded. Device has remained within operational parameters.
                </p>
              )}
            </div>
          </Card>
        </div>
      ) : (
        /* Main Details Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specification Card (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Technical & Network Specifications</CardTitle>
                <CardDescription>Persistent attributes stored in SQLite database.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <select
                  value={asset.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="OPERATIONAL">Operational</option>
                  <option value="DEGRADED">Degraded</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Asset Type</span>
                <p className="text-sm font-semibold text-slate-200">{asset.assetType}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Criticality Tier</span>
                <p className="text-sm font-semibold text-cyan-400">{asset.criticality}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Hardware Platform</span>
                <p className="text-sm text-slate-200">
                  {asset.manufacturer ? `${asset.manufacturer} ${asset.model || ''}` : 'Unspecified'}
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Operating System</span>
                <p className="text-sm text-slate-200">{asset.operatingSystem || 'Not Specified'}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">IP Address</span>
                <p className="text-sm font-mono font-bold text-cyan-400">{asset.ipAddress || 'Not Assigned'}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Hostname / FQDN</span>
                <p className="text-sm font-mono text-slate-200">{asset.hostname || 'None'}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Physical / Virtual Location</span>
                <p className="text-sm text-slate-300">{asset.location || 'Unspecified'}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Owner / Custodian</span>
                <p className="text-sm text-slate-300">{asset.owner || 'Unassigned'}</p>
              </div>

              {asset.tags && (
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5 sm:col-span-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-cyan-400" />
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {asset.tags.split(/[;,]/).map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {asset.notes && (
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1 sm:col-span-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Operational Notes</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{asset.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Infrastructure Relationships */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  Infrastructure Relationships
                </CardTitle>
                <CardDescription>
                  Confirmed dependencies and AI-suggested topology connections.
                </CardDescription>
              </div>
              <Button
                variant="cyan"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsAddDepOpen(true)}
              >
                Add Link
              </Button>
            </CardHeader>

            <div className="space-y-4">
              {/* Outgoing Relationships */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider text-[10px]">
                  Outgoing Relationships (This asset $\rightarrow$ Target):
                </h4>
                {asset.outgoingRels && asset.outgoingRels.length > 0 ? (
                  <div className="space-y-2">
                    {asset.outgoingRels.map((rel: any) => (
                      <div
                        key={rel.id}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                          rel.provenance === 'AI_SUGGESTED'
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={rel.provenance === 'AI_SUGGESTED' ? 'amber' : 'cyan'} size="sm">
                              {rel.relationshipType}
                            </Badge>
                            <span className="text-slate-400 font-mono">$\rightarrow$</span>
                            <Link href={`/assets/${rel.targetAsset.id}`} className="font-mono text-cyan-400 font-bold hover:underline">
                              {rel.targetAsset.assetTag}
                            </Link>
                            <span className="text-slate-300">({rel.targetAsset.name})</span>
                            {rel.provenance === 'AI_SUGGESTED' && (
                              <Badge variant="amber" size="sm">
                                AI Suggested
                              </Badge>
                            )}
                          </div>
                          {rel.description && (
                            <p className="text-[11px] text-slate-400 leading-snug">{rel.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {rel.provenance === 'AI_SUGGESTED' && (
                            <Button
                              variant="cyan"
                              size="sm"
                              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onClick={() => handleConfirmSuggestedRel(rel.id)}
                            >
                              Confirm
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRelationship(rel.id)}
                            aria-label="Detach relationship"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded border border-slate-900">
                    No outgoing relationships recorded.
                  </p>
                )}
              </div>

              {/* Incoming Relationships */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider text-[10px]">
                  Incoming Relationships (Source $\rightarrow$ This asset):
                </h4>
                {asset.incomingRels && asset.incomingRels.length > 0 ? (
                  <div className="space-y-2">
                    {asset.incomingRels.map((rel: any) => (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Link href={`/assets/${rel.sourceAsset.id}`} className="font-mono text-cyan-400 font-bold hover:underline">
                            {rel.sourceAsset.assetTag}
                          </Link>
                          <span className="text-slate-400 font-mono">$\rightarrow$</span>
                          <Badge variant="slate" size="sm">{rel.relationshipType}</Badge>
                          <span className="text-slate-300">({rel.sourceAsset.name})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded border border-slate-900">
                    No downstream dependencies point to this asset.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Rail: Incidents & Topology Context */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Linked Incidents</CardTitle>
                <CardDescription>Investigations involving this asset.</CardDescription>
              </div>
            </CardHeader>

            {!asset.incidentLinks || asset.incidentLinks.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">
                No active incidents linked to this asset.
              </p>
            ) : (
              <div className="space-y-3">
                {asset.incidentLinks.map((link: any) => (
                  <div key={link.id} className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {link.incident?.ticketNumber || 'TICKET'}
                      </span>
                      <Badge variant="cyan" size="sm">{link.role}</Badge>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2">{link.incident?.title}</p>
                    <div className="pt-1 text-right">
                      <Link href={`/incident/${link.incidentId}`} className="text-cyan-400 hover:underline text-xs flex items-center justify-end gap-1">
                        <span>Open Workbench</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      )}

      {/* Add Relationship Modal */}
      <Modal
        isOpen={isAddDepOpen}
        onClose={() => setIsAddDepOpen(false)}
        title="Add Infrastructure Relationship"
        description={`Define how ${asset.assetTag} connects to or depends on another asset in this workspace.`}
        maxWidth="md"
      >
        <form onSubmit={handleAddRelationship} className="space-y-4">
          <Select
            label="Target Asset (Self-links blocked) *"
            options={[
              { label: '-- Select Target Asset --', value: '' },
              ...allAssets
                .filter(a => a.id !== asset.id)
                .map(a => ({ label: `${a.assetTag} — ${a.name} (${a.assetType})`, value: a.id }))
            ]}
            value={targetAssetId}
            onChange={e => setTargetAssetId(e.target.value)}
            required
          />

          <Select
            label="Explicit Relationship Type *"
            options={[
              { label: 'DEPENDS_ON (Upstream Functional Dependency)', value: 'DEPENDS_ON' },
              { label: 'HOSTED_ON (Virtual Machine Host or Container Engine)', value: 'HOSTED_ON' },
              { label: 'CONNECTED_TO (Direct Network Cable, Port or Trunk)', value: 'CONNECTED_TO' },
              { label: 'MANAGED_BY (Administrative / Management Server)', value: 'MANAGED_BY' },
              { label: 'PROVIDES_SERVICE_TO (DNS, Authentication, Proxy, API)', value: 'PROVIDES_SERVICE_TO' },
              { label: 'SHARES_DATA_WITH (Database / Storage / File Sync)', value: 'SHARES_DATA_WITH' },
            ]}
            value={relType}
            onChange={e => setRelType(e.target.value)}
          />

          <Select
            label="Relationship Provenance"
            options={[
              { label: 'USER_CONFIRMED (Explicitly Verified by Engineer)', value: 'USER_CONFIRMED' },
              { label: 'AI_SUGGESTED (Inferred Candidate Connection)', value: 'AI_SUGGESTED' },
            ]}
            value={relProvenance}
            onChange={e => setRelProvenance(e.target.value)}
          />

          <Input
            label="Relationship Description (Optional)"
            placeholder="e.g. Connected via 10GbE fiber trunk port 24"
            value={depDesc}
            onChange={e => setDepDesc(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsAddDepOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Relationship
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Asset: ${asset.assetTag}`}
        description="Update asset specifications and persistent attributes."
        maxWidth="xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Asset Name *"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Asset Type"
              options={[
                { label: 'Server', value: 'SERVER' },
                { label: 'Workstation', value: 'WORKSTATION' },
                { label: 'Laptop', value: 'LAPTOP' },
                { label: 'Router', value: 'ROUTER' },
                { label: 'Switch', value: 'SWITCH' },
                { label: 'Firewall', value: 'FIREWALL' },
                { label: 'Virtual Machine', value: 'VIRTUAL_MACHINE' },
                { label: 'Application', value: 'APPLICATION' },
                { label: 'Service', value: 'SERVICE' },
                { label: 'Storage Array', value: 'STORAGE' },
                { label: 'Shared Folder', value: 'SHARED_FOLDER' },
                { label: 'Printer', value: 'PRINTER' },
              ]}
              value={editType}
              onChange={e => setEditType(e.target.value)}
            />
            <Select
              label="Criticality Tier"
              options={[
                { label: 'Tier 1 Critical', value: 'TIER_1_CRITICAL' },
                { label: 'Tier 2 High', value: 'TIER_2_HIGH' },
                { label: 'Tier 3 Medium', value: 'TIER_3_MEDIUM' },
                { label: 'Tier 4 Low', value: 'TIER_4_LOW' },
              ]}
              value={editCriticality}
              onChange={e => setEditCriticality(e.target.value)}
            />
            <Select
              label="Operational Status"
              options={[
                { label: 'Operational', value: 'OPERATIONAL' },
                { label: 'Degraded', value: 'DEGRADED' },
                { label: 'Offline', value: 'OFFLINE' },
                { label: 'Maintenance', value: 'MAINTENANCE' },
              ]}
              value={editStatus}
              onChange={e => setEditStatus(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Manufacturer / Vendor"
              value={editManufacturer}
              onChange={e => setEditManufacturer(e.target.value)}
            />
            <Input
              label="Model Number / Platform"
              value={editModel}
              onChange={e => setEditModel(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Hostname / FQDN"
              value={editHostname}
              onChange={e => setEditHostname(e.target.value)}
            />
            <Input
              label="IP Address"
              value={editIp}
              onChange={e => setEditIp(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Operating System / Firmware"
              value={editOs}
              onChange={e => setEditOs(e.target.value)}
            />
            <Input
              label="Location"
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
            />
            <Input
              label="Owner / Custodian"
              value={editOwner}
              onChange={e => setEditOwner(e.target.value)}
            />
          </div>

          <Input
            label="Tags"
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
          />

          <Textarea
            label="Operational Notes"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Configure Monitoring Parameters Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={`Configure ICMP Monitoring: ${asset.assetTag}`}
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
              onClick={handleSaveMonitoringConfig}
              isLoading={isSavingConfig}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={`Permanently Delete ${asset.assetTag}?`}
        message={`Are you sure you want to permanently delete "${asset.name}"? All associated infrastructure dependency records will also be removed.`}
        confirmLabel="Confirm Delete"
        variant="danger"
      />
    </div>
  );
}
