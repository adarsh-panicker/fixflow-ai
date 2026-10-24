// src/app/incident/new/page.tsx
'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Shield,
  Zap,
  FileText,
  Sparkles,
  HelpCircle,
  BookOpen,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { repository } from '@/lib/data/repository';
import { Asset } from '@/types/asset';
import { IncidentSeverity, DiagnosticMode, ExperienceLevel } from '@/types/incident';
import { useToast } from '@/components/ui/NotificationToast';
import { LocalSearchResponse, KnowledgeArticleDTO } from '@/types/knowledgeBase';

const CATEGORIES = [
  'VPN & Remote Access',
  'DNS & Name Resolution',
  'Windows & System Services',
  'Accounts & Permissions',
  'Backup & Storage',
  'Networking & Routing',
  'Firewall & Security',
  'Printers & Peripherals',
  'Virtualization & Cloud'
];

function NewIncidentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAssetId = searchParams?.get('asset');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [description, setDescription] = useState('');
  const [targetAssetId, setTargetAssetId] = useState(preselectedAssetId || '');
  const [category, setCategory] = useState('VPN & Remote Access');
  const [severity, setSeverity] = useState<IncidentSeverity>('P2_HIGH');
  const [mode, setMode] = useState<DiagnosticMode>('GUIDED');
  const [experience, setExperience] = useState<ExperienceLevel>('Intermediate');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzingWithAi, setIsAnalyzingWithAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);

  // Local-First Knowledge Base Search State
  const [localSearchResponse, setLocalSearchResponse] = useState<LocalSearchResponse | null>(null);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [dismissedArticleId, setDismissedArticleId] = useState<string | null>(null);
  const [stepOutcomes, setStepOutcomes] = useState<Record<number, 'PASSED' | 'FAILED' | 'INCONCLUSIVE'>>({});

  const { toast } = useToast();

  const searchLocalKnowledge = useCallback(async (text: string, assetId?: string) => {
    if (!text || text.trim().length < 8) {
      setLocalSearchResponse(null);
      return;
    }

    const currentAssetId = assetId || targetAssetId;
    const selectedAsset = assets.find(a => a.id === currentAssetId);

    setIsSearchingLocal(true);
    try {
      const res = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorInput: text.trim(),
          assetType: selectedAsset?.assetType,
          operatingSystem: selectedAsset?.operatingSystem,
          category,
          workspaceId: 'ws-default',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          setLocalSearchResponse(data.result);
        } else {
          setLocalSearchResponse(null);
        }
      }
    } catch (err) {
      console.error('Local knowledge search failed:', err);
    } finally {
      setIsSearchingLocal(false);
    }
  }, [targetAssetId, assets, category]);

  const handleAcceptLocalSolution = async (article: KnowledgeArticleDTO) => {
    try {
      const targetAsset = assets.find(a => a.id === targetAssetId);
      const title = description.split('\n')[0].slice(0, 90) + '...';

      // 1. Create incident marked RESOLVED in repository
      const newIncident = repository.createIncident({
        title,
        rawDescription: description.trim(),
        category,
        severity,
        status: 'RESOLVED',
        experienceLevel: experience,
        diagnosticMode: mode,
        targetAssetId: targetAssetId || undefined,
        targetAsset,
      });

      // Update resolution notes and applied article on incident
      repository.updateIncident(newIncident.id, {
        resolutionNotes: `Issue resolved immediately using verified local knowledge article: "${article.title}". All diagnostic checks confirmed operational state without needing external AI reasoning.`,
        appliedArticleId: article.id,
        articleOutcome: 'ACCEPTED',
      });

      // 2. Report outcome to Knowledge Base service
      await fetch('/api/knowledge-base/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          incidentId: newIncident.id,
          outcome: 'ACCEPTED',
        }),
      });

      toast({
        title: 'Resolved with Local Knowledge',
        message: `Issue verified and closed using article '${article.title}'. No external API calls made.`,
        type: 'success',
      });

      router.push(`/incident/${newIncident.id}`);
    } catch (err: any) {
      toast({
        title: 'Error Saving Resolution',
        message: err.message || 'Failed to record resolution.',
        type: 'error',
      });
    }
  };

  const handleEscalateFromLocalSolution = async (article: KnowledgeArticleDTO) => {
    try {
      // 1. Report outcome as unsuccessful to update KB telemetry
      await fetch('/api/knowledge-base/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          outcome: 'UNSUCCESSFUL',
          incidentId: 'INC-TRIAGE-LOCAL-FAIL',
        }),
      });

      setDismissedArticleId(article.id);

      toast({
        title: 'Local Steps Inconclusive',
        message: `Preserved diagnostic evidence. Escalating to Gemini AI troubleshooter...`,
        type: 'info',
      });

      // Enrich description with attempted local solution failure
      const enrichedDescription = `${description.trim()}\n\n[PRIOR LOCAL DIAGNOSTICS ATTEMPTED]:\nTechnician applied verified solution '${article.title}' (${article.errorCode || 'KB'}), but issue persisted. Step results: ${JSON.stringify(stepOutcomes)}. Avoid repeating these remediation actions.`;
      setDescription(enrichedDescription);

      // Trigger AI triage with enriched description
      setIsAnalyzingWithAi(true);
      const res = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: description.split('\n')[0].slice(0, 90),
          rawDescription: enrichedDescription,
          targetAssetId: targetAssetId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Failed to report local failure:', err);
    } finally {
      setIsAnalyzingWithAi(false);
    }
  };

  const handleAnalyzeWithAi = async () => {
    if (!description.trim() || description.length < 10) {
      toast({
        title: 'Input Too Brief',
        message: 'Please enter at least 10 characters before analyzing.',
        type: 'error',
      });
      return;
    }

    setIsAnalyzingWithAi(true);
    try {
      const res = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: description.split('\n')[0].slice(0, 90),
          rawDescription: description.trim(),
          targetAssetId: targetAssetId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis);
        if (data.analysis.severity) {
          setSeverity(data.analysis.severity);
        }
        // Match suggested asset tag
        if (data.analysis.suggestedAssetTags && data.analysis.suggestedAssetTags.length > 0) {
          const matched = assets.find(a =>
            data.analysis.suggestedAssetTags.some((tag: string) => tag.toLowerCase() === a.assetTag.toLowerCase())
          );
          if (matched && !targetAssetId) {
            setTargetAssetId(matched.id);
          }
        }
        toast({
          title: data.isAiGenerated ? 'AI Triage Analysis Complete' : 'Deterministic Analysis Complete',
          message: `Identified failure domain: ${data.analysis.suspectedFailureDomain}`,
          type: 'info',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Analysis Error',
        message: err.message || 'Failed to analyze incident.',
        type: 'error',
      });
    } finally {
      setIsAnalyzingWithAi(false);
    }
  };

  useEffect(() => {
    setAssets(repository.getAssets());
  }, []);

  useEffect(() => {
    if (preselectedAssetId) {
      setTargetAssetId(preselectedAssetId);
    }
  }, [preselectedAssetId]);

  // Fast preset loader
  const loadPreset = (presetType: 'vpn' | 'dns' | 'spooler' | 'auth' | 'backup') => {
    let text = '';
    let targetId = '';
    if (presetType === 'vpn') {
      text = 'Remote executive connected to FortiClient SSL-VPN successfully. Public internet browsing works, but opening corporate file share \\\\fs01.corp.internal\\Shared displays error 0x80070035 Network Path Not Found. Laptop IP is 172.16.50.14.';
      setDescription(text);
      setCategory('VPN & Remote Access');
      setSeverity('P2_HIGH');
      targetId = 'ast-109'; // EXEC-LT-04
      setTargetAssetId(targetId);
      setMode('GUIDED');
    } else if (presetType === 'dns') {
      text = 'Finance department users in VLAN 20 report DNS_PROBE_FINISHED_NXDOMAIN when navigating to internal accounting ERP erp.corp.internal. Workstation FIN-WS-012 cannot resolve the record despite external DNS working.';
      setDescription(text);
      setCategory('DNS & Name Resolution');
      setSeverity('P1_CRITICAL');
      targetId = 'ast-110'; // FIN-WS-012
      setTargetAssetId(targetId);
      setMode('GUIDED');
    } else if (presetType === 'spooler') {
      text = 'Warehouse shipping label printers offline across shipping dock 4. The Windows Print Spooler service on SRV-PRINT-01 crashes within 5 seconds of being manually started with Event ID 7031 in System event log.';
      setDescription(text);
      setCategory('Windows & System Services');
      setSeverity('P2_HIGH');
      targetId = 'ast-108'; // SRV-PRINT-01
      setTargetAssetId(targetId);
      setMode('GUIDED');
    } else if (presetType === 'auth') {
      text = 'Senior manager added to 14 new Active Directory groups immediately lost access to department shared folder \\\\fs01.corp.internal\\Engineering despite security group possessing Full Control NTFS permissions.';
      setDescription(text);
      setCategory('Accounts & Permissions');
      setSeverity('P3_MEDIUM');
      targetId = 'ast-113'; // SHR-ENG-01
      setTargetAssetId(targetId);
      setMode('GUIDED');
    } else if (presetType === 'backup') {
      text = 'Veeam nightly backup for SQL virtual machine SRV-SQL-01 failed at 02:15 AM with "VSS snapshot creation timed out on guest. SqlServerWriter in state Failed."';
      setDescription(text);
      setCategory('Backup & Storage');
      setSeverity('P2_HIGH');
      targetId = 'ast-107'; // SRV-SQL-01
      setTargetAssetId(targetId);
      setMode('AGENT');
    }

    setDismissedArticleId(null);
    setStepOutcomes({});
    searchLocalKnowledge(text, targetId);

    toast({
      title: 'Scenario Preset Loaded',
      message: `Configured fields for deterministic scenario: ${presetType.toUpperCase()}`,
      type: 'info'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.length < 10) {
      toast({
        title: 'Validation Error',
        message: 'Please provide at least 10 characters describing the incident symptoms.',
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);

    const targetAsset = assets.find(a => a.id === targetAssetId);

    // Create session steps based on category / asset
    const title = description.split('\n')[0].slice(0, 90) + '...';

    const newIncident = repository.createIncident({
      title,
      rawDescription: description.trim(),
      category,
      severity,
      status: 'INVESTIGATING',
      experienceLevel: experience,
      diagnosticMode: mode,
      targetAssetId: targetAssetId || undefined,
      targetAsset,
    });

    toast({
      title: 'Incident Created & Triaged',
      message: `Assigned ticket ${newIncident.ticketNumber}. Launching workbench...`,
      type: 'success'
    });

    router.push(`/incident/${newIncident.id}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">New Incident Intake & Triage</h1>
            <Badge variant="cyan" size="sm">Version A</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Describe symptoms in natural language. FixFlow AI grounds diagnostics in your registered inventory.
          </p>
        </div>

        <Link href="/">
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
      </div>

      {/* Preset Launcher Bar */}
      <Card className="bg-slate-900/90 border-cyan-500/20 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">1-Click Scenario Presets:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadPreset('vpn')}>
              VPN File Outage
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadPreset('dns')}>
              DNS Resolution
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadPreset('spooler')}>
              Print Spooler
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadPreset('auth')}>
              Kerberos / NTFS
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadPreset('backup')}>
              VSS SQL Backup
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Incident Symptom Intake
                </CardTitle>
                <CardDescription>
                  Enter ticket description or user complaint verbatim. Include error codes and asset tags if known.
                </CardDescription>
              </div>
            </CardHeader>

            <div className="space-y-4">
              <Textarea
                label="Raw Incident Description *"
                placeholder="e.g. Remote worker connected to VPN from laptop EXEC-LT-04 but cannot open department file share \\fs01.corp.internal\Shared. Receiving 0x80070035 Network Path Not Found..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                required
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSearchingLocal || !description.trim()}
                  onClick={() => searchLocalKnowledge(description)}
                  className="border-emerald-700/60 text-emerald-400 hover:bg-emerald-950/40"
                  leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}
                >
                  {isSearchingLocal ? 'Searching Local Solutions...' : 'Search Local Knowledge Base'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isAnalyzingWithAi || !description.trim()}
                  onClick={handleAnalyzeWithAi}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                >
                  {isAnalyzingWithAi ? 'Analyzing Symptoms...' : 'Analyze Problem with AI'}
                </Button>
              </div>

              {/* Verified Local Solution Card (Local-First Troubleshooting) */}
              {localSearchResponse?.topMatch && dismissedArticleId !== localSearchResponse.topMatch.article.id && (
                <div className="p-4 bg-emerald-950/20 rounded-xl border-2 border-emerald-500/40 text-xs space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-3 border-b border-emerald-900/40 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-4 h-4" />
                        </span>
                        <span className="font-bold text-sm text-emerald-200">
                          Verified Local Solution Available
                        </span>
                        <Badge
                          variant={localSearchResponse.topMatch.score >= 75 ? 'emerald' : 'amber'}
                          size="sm"
                        >
                          {localSearchResponse.topMatch.score}% Match Relevance
                        </Badge>
                        <Badge variant="cyan" size="sm">
                          Instant Offline Resolution
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300">
                        A verified remediation procedure exists in your local knowledge base. No external AI API call required.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDismissedArticleId(localSearchResponse.topMatch!.article.id)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title="Dismiss local match"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Matched Article Title & Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-white">
                        {localSearchResponse.topMatch.article.title}
                      </h3>
                      {localSearchResponse.topMatch.article.errorCode && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-bold">
                          {localSearchResponse.topMatch.article.errorCode}
                        </span>
                      )}
                    </div>

                    {/* Compatibility & Match Reasons */}
                    <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                      <div className="flex items-center gap-3 text-slate-300">
                        <span>
                          <strong className="text-slate-400">Target Type: </strong>
                          {localSearchResponse.topMatch.article.assetType || 'All Assets'}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-400">Compatible OS: </strong>
                          {localSearchResponse.topMatch.article.operatingSystem || 'Cross-Platform'}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">
                          {localSearchResponse.topMatch.article.successCount} Prior Confirmed Resolves
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {localSearchResponse.topMatch.matchReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[10px]"
                          >
                            ✓ {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Verification Steps Checklist */}
                  {localSearchResponse.topMatch.article.diagnosticSteps &&
                    localSearchResponse.topMatch.article.diagnosticSteps.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>Recommended Diagnostic Verification Steps:</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Run locally to confirm failure state
                          </span>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {localSearchResponse.topMatch.article.diagnosticSteps.map((step, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-200">
                                  {idx + 1}. {step.title}
                                </span>

                                <div className="flex items-center gap-1">
                                  {(['PASSED', 'FAILED', 'INCONCLUSIVE'] as const).map(res => (
                                    <button
                                      key={res}
                                      type="button"
                                      onClick={() =>
                                        setStepOutcomes(prev => ({
                                          ...prev,
                                          [idx]: res,
                                        }))
                                      }
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                        stepOutcomes[idx] === res
                                          ? res === 'PASSED'
                                            ? 'bg-emerald-600 text-white'
                                            : res === 'FAILED'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-amber-600 text-white'
                                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      {res}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {step.command && (
                                <div className="p-1.5 bg-slate-900 rounded font-mono text-[11px] text-emerald-400 border border-slate-800">
                                  {step.command}
                                </div>
                              )}

                              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                                <span>Expected: <strong className="text-cyan-400">{step.expectedResult}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Verified Solution Procedure */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Fix Implementation:</span>
                    </div>
                    <div className="p-3 bg-emerald-950/40 rounded-lg border border-emerald-900/60 font-mono text-xs text-emerald-200 whitespace-pre-line leading-relaxed">
                      {localSearchResponse.topMatch.article.verifiedSolution}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-900/40">
                    <div className="text-[11px] text-slate-400">
                      Does executing this verified solution resolve the incident?
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleAcceptLocalSolution(localSearchResponse.topMatch!.article)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                        This Solved My Issue (Close Ticket)
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEscalateFromLocalSolution(localSearchResponse.topMatch!.article)}
                        className="border-amber-700/80 text-amber-300 hover:bg-amber-950/40"
                      >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                        Did Not Solve — Escalate to AI
                      </Button>
                    </div>
                  </div>

                  {/* Candidate matches switcher if multiple */}
                  {localSearchResponse.candidateMatches && localSearchResponse.candidateMatches.length > 1 && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400">Other candidate articles:</span>
                      {localSearchResponse.candidateMatches.slice(1, 4).map((cand, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setLocalSearchResponse(prev =>
                              prev ? { ...prev, topMatch: cand } : null
                            );
                          }}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 hover:bg-slate-800 transition-colors"
                        >
                          {cand.article.title} ({cand.score}%)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Intake Analysis Box */}
              {aiAnalysis && (
                <div className="p-4 bg-slate-950/90 rounded-lg border border-cyan-500/30 text-xs space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      AI Intake Triage & Classification
                    </span>
                    <Badge variant="cyan" size="sm">Unverified AI Analysis</Badge>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-medium">
                    {aiAnalysis.problemSummary}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Suspected Domain:</span>
                      <strong className="text-slate-200">{aiAnalysis.suspectedFailureDomain}</strong>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Suggested Asset Match:</span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {aiAnalysis.suggestedAssetTags && aiAnalysis.suggestedAssetTags.length > 0 ? (
                          aiAnalysis.suggestedAssetTags.map((tag: string) => {
                            const matched = assets.find(a => a.assetTag.toLowerCase() === tag.toLowerCase());
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (matched) {
                                    setTargetAssetId(matched.id);
                                    toast({
                                      title: 'Asset Confirmed',
                                      message: `Linked target asset '${matched.assetTag}' to this incident.`,
                                      type: 'info',
                                    });
                                  }
                                }}
                                className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] hover:bg-cyan-900/50 transition-colors flex items-center gap-1"
                              >
                                <span>✓ Confirm Match: {tag}</span>
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">None from candidates</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {aiAnalysis.needsClarification && aiAnalysis.clarifyingQuestion && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Clarification Needed:</strong> {aiAnalysis.clarifyingQuestion}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Target IT Asset (Inventory Grounding)"
                  options={[
                    { label: '-- Select Asset from Inventory --', value: '' },
                    ...assets.map(a => ({
                      label: `${a.assetTag} — ${a.name} (${a.ipAddress || a.assetType})`,
                      value: a.id
                    }))
                  ]}
                  value={targetAssetId}
                  onChange={e => setTargetAssetId(e.target.value)}
                  helperText="Linking an asset populates upstream IP routes and dependency topologies."
                />

                <Select
                  label="Incident Taxonomy Category"
                  options={CATEGORIES.map(c => ({ label: c, value: c }))}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
              </div>

              {/* Retrieved Infrastructure Context Panel */}
              {targetAssetId && (() => {
                const selectedAsset = assets.find(a => a.id === targetAssetId);
                const related = repository.getRelatedDependencies(targetAssetId);
                const allDeps = [...related.upstream, ...related.downstream];

                return (
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        Retrieved Infrastructure Topology (Grounding Context)
                      </span>
                      <Badge variant="slate" size="sm">Registered CMDB Metadata</Badge>
                    </div>

                    {selectedAsset && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] p-2 rounded bg-slate-900 border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Asset Tag</span>
                          <span className="font-mono font-bold text-cyan-400">{selectedAsset.assetTag}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">IP Address</span>
                          <span className="font-mono text-slate-300">{selectedAsset.ipAddress || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Hostname</span>
                          <span className="font-mono text-slate-300 truncate block">{selectedAsset.hostname || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Location</span>
                          <span className="text-slate-300 truncate block">{selectedAsset.location || 'Default DC'}</span>
                        </div>
                      </div>
                    )}

                    {/* Relevant Dependencies */}
                    <div className="space-y-1.5">
                      <span className="text-slate-400 font-semibold text-[11px] block">
                        Relevant Bounded Infrastructure Relationships ({allDeps.length}):
                      </span>
                      {allDeps.length === 0 ? (
                        <p className="text-slate-500 text-[11px] italic">No upstream or downstream relationships registered for this asset.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {allDeps.map((d, idx) => (
                            <div key={idx} className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] flex items-center justify-between">
                              <div>
                                <span className="font-mono text-cyan-300 font-semibold">{d.asset.assetTag}</span>
                                <span className="text-slate-400 ml-1.5">({d.asset.name})</span>
                              </div>
                              <Badge variant="cyan" size="sm">{d.relationship.relationshipType}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Operational Health Disclaimer */}
                    <div className="p-2 rounded bg-slate-900/40 border border-slate-800/60 text-[10px] text-slate-400">
                      <strong>Architecture Disclaimer:</strong> Registered relationships represent documented IT topology. FixFlow AI does <em>not</em> assume that registered assets or dependencies are currently online or functioning until verified through live diagnostic telemetry.
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Severity Priority"
                  options={[
                    { label: 'P1 - Critical (Outage / Production Down)', value: 'P1_CRITICAL' },
                    { label: 'P2 - High (Degraded Major Service)', value: 'P2_HIGH' },
                    { label: 'P3 - Medium (Single User Impact)', value: 'P3_MEDIUM' },
                    { label: 'P4 - Low (Informational / Minor)', value: 'P4_LOW' }
                  ]}
                  value={severity}
                  onChange={e => setSeverity(e.target.value as IncidentSeverity)}
                />

                <Select
                  label="Diagnostic Execution Mode"
                  options={[
                    { label: 'Guided Mode (Step-by-step)', value: 'GUIDED' },
                    { label: 'Agent Mode (Bounded plan)', value: 'AGENT' }
                  ]}
                  value={mode}
                  onChange={e => setMode(e.target.value as DiagnosticMode)}
                  helperText={
                    mode === 'GUIDED'
                      ? 'Presents one validated test at a time.'
                      : 'Plans up to 6 safe probes with approval gates.'
                  }
                />

                <Select
                  label="Operator Experience Level"
                  options={[
                    { label: 'Beginner (Full explanations)', value: 'Beginner' },
                    { label: 'Intermediate (Balanced)', value: 'Intermediate' },
                    { label: 'Advanced (Minimalist / Raw)', value: 'Advanced' }
                  ]}
                  value={experience}
                  onChange={e => setExperience(e.target.value as ExperienceLevel)}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Rail: Safety & Launch (1 col) */}
        <div className="space-y-4">
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div>
                <CardTitle className="text-cyan-300">Ready to Triage?</CardTitle>
                <CardDescription>Review safety bounds before initiating session.</CardDescription>
              </div>
            </CardHeader>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Selected Mode:</span>
                  <strong className="text-cyan-400 font-mono">{mode}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Target Asset:</span>
                  <strong className="text-slate-200 font-mono">
                    {assets.find(a => a.id === targetAssetId)?.assetTag || 'Unspecified'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Safety Sandbox:</span>
                  <span className="text-emerald-400 font-medium">Read-Only Tools Only</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                FixFlow AI will generate exact read-only CLI commands. You execute them locally and enter the observed result.
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch Investigation Workbench
              </Button>
            </div>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800 text-[11px] space-y-2 text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Version A Safety Guarantee</span>
            </div>
            <p className="leading-relaxed">
              No SSH, WinRM, or remote execution. All commands are validated against our strict read-only allowlist.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default function NewIncidentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading intake form...</div>}>
      <NewIncidentContent />
    </Suspense>
  );
}
