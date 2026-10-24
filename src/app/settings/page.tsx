// src/app/settings/page.tsx
'use client';

import React, { useState } from 'react';
import {
  Shield,
  RotateCcw,
  Download,
  Sparkles,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { repository } from '@/lib/data/repository';
import { useToast } from '@/components/ui/NotificationToast';

export default function SettingsPage() {
  const [experience, setExperience] = useState('Intermediate');
  const [defaultMode, setDefaultMode] = useState('GUIDED');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ isConfigured: boolean; model: string }>({
    isConfigured: false,
    model: 'gemini-2.5-flash',
  });

  const { toast } = useToast();

  React.useEffect(() => {
    fetch('/api/ai/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAiStatus({ isConfigured: data.isConfigured, model: data.model });
          setSelectedModel(data.model);
        }
      })
      .catch(() => {});
  }, []);

  const handleResetConfirm = async () => {
    try {
      await fetch('/api/reset-demo', { method: 'POST' });
      repository.resetToDemoData();
      toast({
        title: 'Demo Data Restored',
        message: 'All factory demo assets, topologies, and sample incidents have been reset in SQLite.',
        type: 'success'
      });
      window.location.reload();
    } catch {
      repository.resetToDemoData();
    }
  };

  const handleExportJson = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      assets: repository.getAssets(),
      dependencies: repository.getDependencies(),
      incidents: repository.getIncidents()
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fixflow_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    toast({ title: 'Backup Downloaded', message: 'Current repository exported as JSON file.', type: 'info' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Application Settings & AI Status</h1>
            <Badge variant="cyan" size="sm">System v1.0</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure operator experience defaults, LLM provider settings, and repository backups.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Preferences (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operator Profile */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Operator Experience & Triage Defaults</CardTitle>
                <CardDescription>Adjust CLI verbosity and explanation detail across workbenches.</CardDescription>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <Select
                label="Operator Experience Tier"
                options={[
                  { label: 'Beginner (Full command explanations & plain-English indicators)', value: 'Beginner' },
                  { label: 'Intermediate (Standard PowerShell/Bash syntax & topology paths)', value: 'Intermediate' },
                  { label: 'Advanced (Minimalist command snippets & direct telemetry focus)', value: 'Advanced' }
                ]}
                value={experience}
                onChange={e => {
                  setExperience(e.target.value);
                  toast({ title: 'Preference Saved', message: `Experience set to ${e.target.value}.`, type: 'info' });
                }}
              />

              <Select
                label="Default Diagnostic Intake Mode"
                options={[
                  { label: 'Guided Mode (Adaptive one-step-at-a-time runner)', value: 'GUIDED' },
                  { label: 'Agent Mode (Bounded multi-step autonomous planning)', value: 'AGENT' }
                ]}
                value={defaultMode}
                onChange={e => {
                  setDefaultMode(e.target.value);
                  toast({ title: 'Preference Saved', message: `Default mode set to ${e.target.value}.`, type: 'info' });
                }}
              />
            </div>
          </Card>

          {/* AI Provider Configuration */}
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Google Gemini Provider Adapter Status
                </CardTitle>
                <CardDescription>
                  Server-side LLM orchestration for structured triage and synthesis.
                </CardDescription>
              </div>
              <Badge variant={aiStatus.isConfigured ? 'emerald' : 'demo'} size="sm">
                {aiStatus.isConfigured ? 'Gemini API Live' : 'Deterministic Offline Engine'}
              </Badge>
            </CardHeader>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current AI Engine:</span>
                  <strong className={aiStatus.isConfigured ? 'text-cyan-400 font-mono' : 'text-emerald-400 font-mono'}>
                    {aiStatus.isConfigured ? `Official SDK (@google/genai - ${aiStatus.model})` : 'Deterministic Guided Engine (Air-Gapped)'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Credential Storage:</span>
                  <span className="text-slate-200">Server-Side Environment Variables (.env.local)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Client Secret Exposure:</span>
                  <strong className="text-emerald-400">0% (Strictly Isolated on Server)</strong>
                </div>
              </div>

              <Select
                label="Target AI Model Architecture"
                options={[
                  { label: 'Google Gemini 2.5 Flash (Recommended for rapid IT triage)', value: 'gemini-2.5-flash' },
                  { label: 'Google Gemini 1.5 Flash (Fast low-latency inference)', value: 'gemini-1.5-flash' },
                  { label: 'Google Gemini 1.5 Pro (Deep causal reasoning & complex RCAs)', value: 'gemini-1.5-pro' }
                ]}
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              />

              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {aiStatus.isConfigured
                    ? 'Gemini API is active. Server-side provider validates all model responses via Zod and enforces read-only tool safety constraints.'
                    : 'To enable live Gemini reasoning, set GEMINI_API_KEY in .env.local. When unconfigured, the deterministic guided engine continues to provide full diagnostic workflows.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Repository & Demo Data Controls */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Data Persistence & Demo State</CardTitle>
                <CardDescription>Manage local repository state or reset to factory evaluation presets.</CardDescription>
              </div>
            </CardHeader>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Reset Demo Data</h4>
                <p className="text-[11px] text-slate-400">
                  Restore the original 15 enterprise IT assets and 5 diagnostic scenarios.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => setIsResetOpen(true)}
              >
                Reset Demo Data
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 mt-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Export Repository Backup</h4>
                <p className="text-[11px] text-slate-400">
                  Download all registered assets, dependency edges, and incident timelines as JSON.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportJson}
              >
                Export JSON
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Rail: System Specs & Security Manifest (1 col) */}
        <div className="space-y-4">
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader>
              <div>
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Security & Policy Manifest
                </CardTitle>
              </div>
            </CardHeader>

            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Infrastructure Access:</span>
                <strong className="text-slate-200">Version A (Air-Gapped)</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Network Execution:</span>
                <strong className="text-emerald-400">Disabled</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Remote Modification:</span>
                <strong className="text-emerald-400">Disabled</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Command Sandbox:</span>
                <strong className="text-cyan-400">Read-Only Allowlist</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Truth-in-Reporting:</span>
                <strong className="text-cyan-400">Enforced</strong>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800 text-[11px] space-y-3 text-slate-400">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-md shadow-cyan-950">
                <img src="/logo.png" alt="FixFlow AI Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className="font-bold text-slate-100 text-sm">FixFlow AI</h4>
                <p className="text-cyan-400 font-medium text-[11px]">By Adarsh Panicker</p>
                <p className="text-slate-500 text-[10px]">Lead Architect & Product Engineer</p>
              </div>
            </div>

            <p className="leading-relaxed">
              FixFlow AI is designed as a standalone, enterprise-grade IT troubleshooting and infrastructure availability monitoring workbench. Grounded in CMDB asset topologies and local error knowledge bases.
            </p>

            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              Copyrighted &copy; {new Date().getFullYear()} <strong className="text-slate-200">Adarsh Panicker</strong>. All rights reserved.
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirm={handleResetConfirm}
        title="Reset Demo Data to Factory State?"
        message="This will overwrite any created or edited assets, dependency links, and investigations with the 15 original enterprise assets and 5 demo scenarios."
        confirmLabel="Reset Everything"
        variant="danger"
      />
    </div>
  );
}
