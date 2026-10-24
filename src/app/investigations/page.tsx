// src/app/investigations/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  Search,
  Plus,
  ArrowRight,
  FileText,
  RotateCcw,
  PlayCircle,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { repository } from '@/lib/data/repository';
import { Incident } from '@/types/incident';
import { Asset } from '@/types/asset';
import { useToast } from '@/components/ui/NotificationToast';

export default function InvestigationsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');

  const { toast } = useToast();

  const loadData = () => {
    setIncidents(repository.getIncidents());
    setAssets(repository.getAssets());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('fixflow-data-changed', loadData);
    return () => window.removeEventListener('fixflow-data-changed', loadData);
  }, []);

  const handleReopen = (incidentId: string) => {
    const reopened = repository.reopenIncident(incidentId);
    if (reopened) {
      toast({
        title: 'Incident Reopened',
        message: `${reopened.ticketNumber} is active again. Session diagnostics resumed.`,
        type: 'info',
      });
      loadData();
    }
  };

  const filteredIncidents = useMemo(() => {
    return repository.searchAndFilterIncidents({
      searchTerm,
      status: statusFilter,
      severity: severityFilter,
      assetId: assetFilter,
      dateRange: dateFilter,
    });
  }, [incidents, searchTerm, statusFilter, severityFilter, assetFilter, dateFilter]);

  // Lifecycle Metrics
  const activeCount = incidents.filter(i => i.status === 'INVESTIGATING' || i.status === 'OPEN').length;
  const rootCauseCount = incidents.filter(i => i.status === 'ROOT_CAUSE_IDENTIFIED').length;
  const resolvedCount = incidents.filter(i => i.status === 'RESOLVED').length;
  const escalatedCount = incidents.filter(i => i.session?.status === 'ESCALATED').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Incident Investigation History</h1>
            <Badge variant="cyan" size="sm">{incidents.length} Investigations</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Searchable historical archive of diagnostic sessions, recorded evidence, and post-mortem RCAs.
          </p>
        </div>

        <Link href="/incident/new">
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            New Incident Intake
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px] font-medium">Active Investigations</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-cyan-400">{activeCount}</span>
            <Badge variant="cyan" size="sm">Active</Badge>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px] font-medium">Root Causes Isolated</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-emerald-400">{rootCauseCount}</span>
            <Badge variant="emerald" size="sm">RCA Ready</Badge>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px] font-medium">Resolved & Preserved</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-slate-200">{resolvedCount}</span>
            <Badge variant="slate" size="sm">Archived</Badge>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px] font-medium">Escalated to Tier 3</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-amber-400">{escalatedCount}</span>
            <Badge variant="amber" size="sm">Tier 3</Badge>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/90 border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Free Text Search */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Input
              placeholder="Search by ticket, title, symptom, or asset tag..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Status Filter */}
          <Select
            options={[
              { label: 'All Lifecycle Statuses', value: 'ALL' },
              { label: 'Under Investigation', value: 'INVESTIGATING' },
              { label: 'Root Cause Identified', value: 'ROOT_CAUSE_IDENTIFIED' },
              { label: 'Resolved & Closed', value: 'RESOLVED' },
              { label: 'Open / Triaged', value: 'OPEN' }
            ]}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          />

          {/* Severity Filter */}
          <Select
            options={[
              { label: 'All Severities', value: 'ALL' },
              { label: 'P1 Critical', value: 'P1_CRITICAL' },
              { label: 'P2 High', value: 'P2_HIGH' },
              { label: 'P3 Medium', value: 'P3_MEDIUM' },
              { label: 'P4 Low', value: 'P4_LOW' }
            ]}
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          />

          {/* Date Filter */}
          <Select
            options={[
              { label: 'All Dates', value: 'ALL' },
              { label: 'Created Today', value: 'TODAY' },
              { label: 'Past 7 Days', value: '7DAYS' },
              { label: 'Past 30 Days', value: '30DAYS' }
            ]}
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        {/* Second Filter Row: Asset Specific Filter & Clear Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] text-slate-400 shrink-0 font-medium">Filter by Target Asset:</span>
            <select
              value={assetFilter}
              onChange={e => setAssetFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="ALL">All IT Assets ({assets.length})</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.assetTag} — {a.name}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || statusFilter !== 'ALL' || severityFilter !== 'ALL' || assetFilter !== 'ALL' || dateFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setAssetFilter('ALL');
                setDateFilter('ALL');
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 self-end sm:self-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </Card>

      {/* Incident List */}
      {filteredIncidents.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8" />}
          title="No incident records found"
          description="Try broadening your search query or reset your filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setStatusFilter('ALL');
            setSeverityFilter('ALL');
            setAssetFilter('ALL');
            setDateFilter('ALL');
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map(inc => {
            const isResolved = inc.status === 'RESOLVED';
            const isEscalated = inc.session?.status === 'ESCALATED';

            return (
              <Card key={inc.id} hover className="transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-cyan-400">{inc.ticketNumber}</span>
                      {inc.severity === 'P1_CRITICAL' && <Badge variant="rose" size="sm">P1 Critical</Badge>}
                      {inc.severity === 'P2_HIGH' && <Badge variant="amber" size="sm">P2 High</Badge>}
                      {inc.severity === 'P3_MEDIUM' && <Badge variant="cyan" size="sm">P3 Medium</Badge>}
                      <Badge variant="slate" size="sm">{inc.category}</Badge>
                      {inc.isDemo && <Badge variant="demo" size="sm">Demo Record</Badge>}

                      <Badge
                        variant={
                          isResolved
                            ? 'emerald'
                            : isEscalated
                            ? 'amber'
                            : inc.status === 'ROOT_CAUSE_IDENTIFIED'
                            ? 'emerald'
                            : 'cyan'
                        }
                        size="sm"
                      >
                        {isResolved ? 'RESOLVED' : isEscalated ? 'ESCALATED' : inc.status}
                      </Badge>
                    </div>

                    <Link
                      href={`/incident/${inc.id}`}
                      className="text-sm font-semibold text-slate-100 hover:text-cyan-400 transition-colors block line-clamp-1"
                    >
                      {inc.title}
                    </Link>

                    {/* Metadata Context Badges */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      {inc.targetAsset && (
                        <span className="flex items-center gap-1 font-mono text-slate-300">
                          <Server className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{inc.targetAsset.assetTag}</span>
                          {inc.targetAsset.ipAddress && (
                            <span className="text-slate-500 text-[11px]">({inc.targetAsset.ipAddress})</span>
                          )}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Mode: <strong className="text-slate-200">{inc.diagnosticMode}</strong></span>
                      </span>

                      {inc.session && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inc.session.steps.filter(s => s.outcome !== 'NOT_TESTED').length} Tests Executed</span>
                        </span>
                      )}

                      {inc.session?.evidence && (
                        <span>
                          Evidence: <strong className="text-slate-200">{inc.session.evidence.length}</strong> facts
                        </span>
                      )}

                      <span>
                        Created: {new Date(inc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Resume / Workbench Button */}
                    {!isResolved ? (
                      <Link href={`/incident/${inc.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<PlayCircle className="w-3.5 h-3.5 text-cyan-400" />}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          {inc.status === 'INVESTIGATING' ? 'Resume Session' : 'Workbench'}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReopen(inc.id)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                      >
                        Reopen
                      </Button>
                    )}

                    {/* Report Button */}
                    <Link href={`/incident/${inc.id}/report`}>
                      <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                        {isResolved ? 'Post-Mortem RCA' : 'Report'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}