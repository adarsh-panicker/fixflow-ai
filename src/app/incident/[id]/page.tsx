// src/app/incident/[id]/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Clock,
  Sparkles,
  Server,
  RotateCcw,
  Layers,
  Terminal,
  ShieldAlert,
  GitBranch,
  SlidersHorizontal,
  Save,
  AlertTriangle,
  History,
  Activity,
  BookOpen
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { repository } from '@/lib/data/repository';
import {
  Incident,
  DiagnosticStep,
  StepOutcome,
  DiagnosticMode,
  ExperienceLevel,
} from '@/types/incident';
import { GuidedAdapter } from '@/lib/engine/guidedAdapter';
import { useToast } from '@/components/ui/NotificationToast';
import { SaveToKnowledgeBaseModal } from '@/components/knowledgeBase/SaveToKnowledgeBaseModal';

export default function DiagnosticWorkbenchPage() {
  const params = useParams();
  const incidentId = params?.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [activeTab, setActiveTab] = useState<'runner' | 'tree' | 'timeline'>('runner');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [, startTransition] = useTransition();

  // Mode & Experience adaptation state
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('Intermediate');

  // Manual result entry state
  const [outcome, setOutcome] = useState<StepOutcome>('PASSED');
  const [rawOutput, setRawOutput] = useState('');
  const [notes, setNotes] = useState('');

  // AI Explanation State
  const [aiExplanation, setAiExplanation] = useState<any | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Escalation Modal State
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('Inconclusive diagnostic evidence - root cause unclear');
  const [escalateNotes, setEscalateNotes] = useState('');

  // Resolve Modal State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isSaveKbModalOpen, setIsSaveKbModalOpen] = useState(false);

  // Past step inspection review index (null means current active step)
  const [inspectStepIndex, setInspectStepIndex] = useState<number | null>(null);
  const [monitoringEvidence, setMonitoringEvidence] = useState<any | null>(null);

  const { toast } = useToast();

  const loadData = () => {
    if (!incidentId) return;
    const found = repository.getIncidentById(incidentId);
    if (found) {
      setIncident(found);
      if (found.targetAssetId) {
        fetch(`/api/monitoring/assets/${found.targetAssetId}/history`)
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setMonitoringEvidence(data);
            }
          })
          .catch(() => {});
      }
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('fixflow-data-changed', loadData);
    return () => window.removeEventListener('fixflow-data-changed', loadData);
  }, [incidentId]);

  const handleExplainStep = async (step: DiagnosticStep) => {
    if (!incident) return;
    setIsLoadingExplanation(true);
    try {
      const res = await fetch('/api/ai/explain-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          incident,
          targetAssetId: incident.targetAssetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiExplanation(data.explanation);
        toast({
          title: data.isAiGenerated ? 'AI Explanation Ready' : 'Technical Guidance Loaded',
          message: `Explained purpose and indicators for '${step.title}'.`,
          type: 'info',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Explanation Error',
        message: err.message || 'Failed to generate explanation.',
        type: 'error',
      });
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  if (!incident || !incident.session) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-slate-400">Loading diagnostic workbench session...</p>
        <Link href="/investigations">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Investigations
          </Button>
        </Link>
      </div>
    );
  }

  const session = incident.session;
  const isFinished = session.status === 'COMPLETED' || session.status === 'STOPPED' || session.status === 'ESCALATED' || incident.status === 'ROOT_CAUSE_IDENTIFIED';
  
  // Current step to execute or inspect
  const currentStep: DiagnosticStep | undefined =
    inspectStepIndex !== null
      ? session.steps[inspectStepIndex]
      : session.steps[session.currentStepIndex] || session.steps[session.steps.length - 1];

  const tailoredGuidance = currentStep ? GuidedAdapter.getTailoredExplanation(currentStep, experienceLevel) : null;
  const branchPreview = currentStep && !isFinished ? GuidedAdapter.getAlternateBranchesPreview(session, currentStep) : null;

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(true);
    toast({ title: 'Command Copied', message: 'Ready to paste into your administrative terminal.', type: 'info' });
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handleRecordResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStep || isFinished) return;

    startTransition(() => {
      const updated = repository.recordStepResult(
        incident.id,
        currentStep.id,
        outcome,
        notes.trim() || undefined,
        rawOutput.trim() || undefined
      );

      if (updated) {
        setIncident(updated);
        setInspectStepIndex(null);
        setAiExplanation(null);
        toast({
          title: 'Step Result Recorded',
          message: `Marked '${currentStep.title}' as ${outcome}. Hypotheses updated.`,
          type: 'success',
        });
        // Clear manual entry form
        setRawOutput('');
        setNotes('');
      }
    });
  };

  const handleModeToggle = () => {
    const nextMode: DiagnosticMode = incident.diagnosticMode === 'GUIDED' ? 'AGENT' : 'GUIDED';
    const updated = repository.switchDiagnosticMode(incident.id, nextMode);
    if (updated) {
      setIncident(updated);
      toast({
        title: `Switched to ${nextMode} Mode`,
        message:
          nextMode === 'AGENT'
            ? 'Bounded autonomous planning enabled. Sequence generated from evidence.'
            : 'Step-by-step guided runner active with branch previews.',
        type: 'info',
      });
    }
  };

  const handleSaveInvestigation = () => {
    const updated = repository.updateIncident(incident.id, {});
    if (updated) {
      toast({
        title: 'Investigation Saved',
        message: 'Investigation state persisted safely. You can resume at any time.',
        type: 'success',
      });
    }
  };

  const handleConfirmEscalation = () => {
    const updated = repository.escalateIncident(incident.id, escalateReason, escalateNotes);
    if (updated) {
      setIncident(updated);
      setIsEscalateModalOpen(false);
      toast({
        title: 'Incident Escalated to Tier 3',
        message: 'Diagnostic session stopped and logged to audit trail.',
        type: 'warning',
      });
    }
  };

  const handleReopenIncident = () => {
    const updated = repository.reopenIncident(incident.id);
    if (updated) {
      setIncident(updated);
      toast({
        title: 'Incident Reopened',
        message: 'Investigation session resumed. You can now execute further diagnostic tests.',
        type: 'info',
      });
    }
  };

  const handleConfirmResolve = () => {
    const updated = repository.resolveIncident(
      incident.id,
      resolveNotes.trim() || 'Root cause verified and remediated by technician.',
      'Lead Incident Engineer'
    );
    if (updated) {
      setIncident(updated);
      setIsResolveModalOpen(false);
      toast({
        title: 'Incident Resolved & Preserved',
        message: 'Investigation successfully archived with permanent historical audit trail.',
        type: 'success',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Console Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <Link href="/investigations">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Queue
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-cyan-400">{incident.ticketNumber}</span>
              {incident.severity === 'P1_CRITICAL' && <Badge variant="rose" size="sm">P1 Critical</Badge>}
              {incident.severity === 'P2_HIGH' && <Badge variant="amber" size="sm">P2 High</Badge>}
              {incident.severity === 'P3_MEDIUM' && <Badge variant="cyan" size="sm">P3 Medium</Badge>}
              <Badge variant="slate" size="sm">{incident.category}</Badge>
              {incident.isDemo && <Badge variant="demo" size="sm">Demo Record</Badge>}
              <Badge
                variant={
                  session.status === 'ESCALATED'
                    ? 'amber'
                    : incident.status === 'ROOT_CAUSE_IDENTIFIED'
                    ? 'emerald'
                    : 'cyan'
                }
                size="sm"
              >
                {session.status === 'ESCALATED' ? 'ESCALATED' : incident.status}
              </Badge>
            </div>
            <h1 className="text-sm font-semibold text-slate-100 mt-1 line-clamp-1">{incident.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Mode Switcher Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleModeToggle}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
          >
            Mode: <strong className="text-cyan-400 ml-1">{incident.diagnosticMode}</strong>
          </Button>

          {/* Quick Save */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveInvestigation}
            leftIcon={<Save className="w-3.5 h-3.5 text-slate-400" />}
          >
            Save State
          </Button>

          {/* Resolve Control */}
          {incident.status === 'ROOT_CAUSE_IDENTIFIED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsResolveModalOpen(true)}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Resolve Incident
            </Button>
          )}

          {/* Reopen Control */}
          {(incident.status === 'RESOLVED' || session.status === 'ESCALATED') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopenIncident}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
            >
              Reopen Incident
            </Button>
          )}

          {/* Escalate Control */}
          {!isFinished && incident.status !== 'RESOLVED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEscalateModalOpen(true)}
              leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              className="border-amber-500/30 hover:bg-amber-500/10 text-amber-300"
            >
              Escalate
            </Button>
          )}

          <Link href={`/incident/${incident.id}/report`}>
            <Button variant="cyan" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
              Post-Mortem Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Historical Resolved Banner */}
      {incident.status === 'RESOLVED' && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <strong className="text-emerald-200">Incident Resolved & Preserved in Historical Archive</strong>
              <Badge variant="emerald" size="sm">RESOLVED</Badge>
            </div>
            <p className="text-slate-300">
              {incident.resolutionNotes || 'Root cause remediated and verified. Historical session record preserved.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveKbModalOpen(true)}
              className="border-emerald-700/80 text-emerald-400 hover:bg-emerald-950/40"
              leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Save to KB
            </Button>
            <Button variant="outline" size="sm" onClick={handleReopenIncident} leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}>
              Reopen Incident
            </Button>
            <Link href={`/incident/${incident.id}/report`}>
              <Button variant="cyan" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                View RCA Report
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Mode-Specific Status / Strategy Banners */}
      {incident.diagnosticMode === 'AGENT' ? (
        <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Agent Mode: Autonomous Investigation Plan
              </span>
              <Badge variant="cyan" size="sm">
                Cycle #{session.planRevisions?.length || 1}
              </Badge>
              <Badge variant="slate" size="sm">
                Max 6 Steps / Cycle
              </Badge>
            </div>
            <p className="text-slate-300">
              Structured sequence dynamically adapted from observed evidence. Operator executes commands locally.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
            <div className="text-slate-400">
              Budget: <strong className="text-cyan-400">{session.totalStepsExecuted || 0}</strong> / {session.sessionBudgetMax || 12}
            </div>
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              0 Loops (Deduplicated)
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                Guided Mode: Validated Step-by-Step Triage
              </span>
              <Badge variant="cyan" size="sm">Adaptive Guidance</Badge>
            </div>
            <p className="text-slate-400">
              One validated test at a time. Explanations adapt to your technical experience level.
            </p>
          </div>

          {/* Experience Level Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 px-1 font-mono">Profile:</span>
            {(['Beginner', 'Intermediate', 'Advanced'] as ExperienceLevel[]).map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setExperienceLevel(level)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  experienceLevel === level
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ICMP Availability Monitoring Evidence Card */}
      {monitoringEvidence && monitoringEvidence.state && (
        <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live ICMP Availability Telemetry:
              </span>
              {monitoringEvidence.state.currentStatus === 'ONLINE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ONLINE ({monitoringEvidence.state.latestLatencyMs != null ? `${monitoringEvidence.state.latestLatencyMs.toFixed(1)}ms` : 'Responding'})
                </span>
              )}
              {monitoringEvidence.state.currentStatus === 'DEGRADED' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  DEGRADED ({monitoringEvidence.state.latestLatencyMs?.toFixed(1)}ms latency)
                </span>
              )}
              {monitoringEvidence.state.currentStatus === 'OFFLINE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <XCircle className="w-3 h-3 text-rose-400" />
                  OFFLINE (Packet Timeout)
                </span>
              )}
              {monitoringEvidence.state.currentStatus === 'UNKNOWN' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  <HelpCircle className="w-3 h-3 text-slate-400" />
                  UNKNOWN (Stale / Disconnected Agent)
                </span>
              )}
              {monitoringEvidence.config?.targetIp && (
                <span className="font-mono text-cyan-400 text-[11px]">
                  Target: {monitoringEvidence.config.targetIp}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {monitoringEvidence.state.transitionReason || 'Continuous ICMP reachability checks active.'}{' '}
              {monitoringEvidence.state.currentStatus === 'ONLINE' && (
                <span className="text-slate-500">
                  (Note: ICMP reachability from prober does not prove application service health.)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/assets/${incident.targetAssetId}?tab=monitoring`}>
              <Button variant="ghost" size="sm">
                View Full Telemetry
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Workbench Grid: Center Console (2 cols) & Right Context Rail (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Center Diagnostic Console (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* View Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Button
              variant={activeTab === 'runner' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('runner')}
              leftIcon={<Terminal className="w-3.5 h-3.5" />}
            >
              Diagnostic Runner
            </Button>
            <Button
              variant={activeTab === 'tree' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tree')}
              leftIcon={<Layers className="w-3.5 h-3.5" />}
            >
              Decision Tree
            </Button>
            <Button
              variant={activeTab === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('timeline')}
              leftIcon={<Clock className="w-3.5 h-3.5" />}
            >
              Timeline & Audits ({session.evidence.length})
            </Button>
          </div>

          {/* TAB 1: DIAGNOSTIC RUNNER */}
          {activeTab === 'runner' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Contradiction Alert Banner */}
              {session.evidence.some(e => e.isContradictory) && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Contradictory evidence detected in investigation timeline. Conflicting hypotheses marked for verification.</span>
                </div>
              )}

              {/* Stop / Escalation Banners */}
              {session.stopReason === 'SESSION_BUDGET_EXHAUSTED' && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="font-semibold block">Session Diagnostic Budget Exhausted (12 Steps)</strong>
                    <span className="text-[11px] text-amber-400/90">
                      Bounded planning stopped to prevent endless loops. Escalated to senior engineering team.
                    </span>
                  </div>
                </div>
              )}

              {session.status === 'ESCALATED' && session.stopReason !== 'SESSION_BUDGET_EXHAUSTED' && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                  <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="font-semibold block">Investigation Escalated</strong>
                    <span className="text-[11px] text-amber-400/90">
                      Reason: {session.stopReason === 'MANUAL_ESCALATION' ? 'Technician manual handover' : 'Inconclusive telemetry or physical intervention required on-site.'}
                    </span>
                  </div>
                </div>
              )}

              {incident.status === 'ROOT_CAUSE_IDENTIFIED' && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="font-semibold text-emerald-200">Root Cause Identified!</strong>
                      <p className="text-[11px] text-emerald-400/90 mt-0.5">
                        High-confidence hypothesis isolated from confirmed diagnostic evidence.
                      </p>
                    </div>
                  </div>
                  <Link href={`/incident/${incident.id}/report`}>
                    <Button variant="primary" size="sm">
                      Review Post-Mortem Report
                    </Button>
                  </Link>
                </div>
              )}

              {/* AGENT MODE: Proposed Investigation Plan Sequence Card */}
              {incident.diagnosticMode === 'AGENT' && session.proposedPlan && session.proposedPlan.length > 0 && (
                <Card className="border-cyan-500/30 bg-slate-950/70">
                  <CardHeader>
                    <div>
                      <CardTitle className="text-xs text-cyan-300 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        Proposed Plan Sequence (Cycle #{session.planRevisions?.length || 1})
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Dynamic sequence bounded to max 6 steps. Reassessed after each observation.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <div className="space-y-2">
                    {session.proposedPlan.map((pStep, pIdx) => {
                      const isActiveStep = currentStep?.stepId === pStep.stepId;
                      const isExecuted = session.steps.some(s => s.stepId === pStep.stepId && s.outcome !== 'NOT_TESTED');

                      return (
                        <div
                          key={pStep.id || pIdx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                            isActiveStep
                              ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                              : isExecuted
                              ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                              : 'bg-slate-950 border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                              #{pIdx + 1}
                            </span>
                            <div>
                              <div className="font-medium text-slate-200 text-xs flex items-center gap-1.5">
                                <span>{pStep.title}</span>
                                {pStep.toolName && (
                                  <span className="text-[10px] text-slate-500 font-mono">[{pStep.toolName}]</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono truncate max-w-md">{pStep.command}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={pStep.riskRating === 'SAFE_READ_ONLY' ? 'emerald' : 'amber'} size="sm">
                              {pStep.riskRating || 'SAFE_READ_ONLY'}
                            </Badge>
                            {isActiveStep ? (
                              <Badge variant="cyan" size="sm">Active Now</Badge>
                            ) : isExecuted ? (
                              <Badge variant="emerald" size="sm">Tested</Badge>
                            ) : (
                              <Badge variant="slate" size="sm">Planned</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* AGENT MODE: Plan Revision Changelog */}
              {incident.diagnosticMode === 'AGENT' && session.planRevisions && session.planRevisions.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                      <History className="w-3.5 h-3.5 text-cyan-400" />
                      Plan Adaptation Changelog
                    </span>
                    <span className="font-mono text-[10px]">{session.planRevisions.length} Revision(s) Recorded</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {session.planRevisions.slice().reverse().map((rev, rIdx) => (
                      <div key={rev.id || rIdx} className="p-2 rounded bg-slate-950 border border-slate-800/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-cyan-300 font-mono">Cycle #{rev.cycleNumber} Revision</span>
                          <span className="text-slate-500 text-[10px]">{new Date(rev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-300">{rev.reasoning}</p>
                        <div className="flex items-center gap-2 pt-0.5 text-[10px] flex-wrap">
                          {rev.stepsAdded.map((sa, i) => (
                            <span key={i} className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              + {sa}
                            </span>
                          ))}
                          {rev.stepsPruned.map((sp, i) => (
                            <span key={i} className="text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-500/20 line-through">
                              - {sp}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVE STEP CARD (Runner) */}
              {currentStep && (
                <Card className="border-cyan-500/30">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono font-semibold">
                        Step {inspectStepIndex !== null ? inspectStepIndex + 1 : session.currentStepIndex + 1} of {session.steps.length}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-100">{currentStep.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {inspectStepIndex !== null && (
                        <button
                          type="button"
                          onClick={() => setInspectStepIndex(null)}
                          className="text-[11px] text-cyan-400 hover:underline mr-1"
                        >
                          Return to Current Step
                        </button>
                      )}
                      <Badge variant={currentStep.isClarifyingQuestion ? 'cyan' : currentStep.riskRating === 'SAFE_READ_ONLY' ? 'emerald' : 'amber'} size="sm">
                        {currentStep.isClarifyingQuestion ? 'CLARIFYING_QUESTION' : currentStep.riskRating || 'SAFE_READ_ONLY'}
                      </Badge>
                    </div>
                  </div>

                  {/* Step Purpose & Instructions */}
                  <div className="py-3 text-xs text-slate-300 space-y-3">
                    {/* Tailored Explanation Box (Guided Mode) */}
                    {incident.diagnosticMode === 'GUIDED' && tailoredGuidance && (
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-cyan-300 flex items-center gap-1.5 text-xs">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                            {tailoredGuidance.badgeLabel}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">Profile: {tailoredGuidance.detailLevel}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{tailoredGuidance.guidanceText}</p>
                        <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] space-y-1">
                          <span className="font-semibold text-slate-400 block">What to Look For in Terminal:</span>
                          <span className="text-slate-300">{tailoredGuidance.whatToCheck}</span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-mono">
                          ✓ {tailoredGuidance.safetyNote}
                        </p>
                      </div>
                    )}

                    {currentStep.isClarifyingQuestion ? (
                      <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs">
                          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Technician Clarifying Question</span>
                        </div>
                        <p className="text-sm text-slate-100 font-medium leading-relaxed">
                          {currentStep.question || currentStep.purpose}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Interview the user or inspect monitoring logs to verify scope, then record findings below.
                        </p>
                      </div>
                    ) : (
                      <>
                        {incident.diagnosticMode === 'AGENT' && (
                          <p className="leading-relaxed text-slate-300">{currentStep.purpose}</p>
                        )}

                        {/* Copyable Command Box with Explicit Technician Notice */}
                        <div className="relative mt-2">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-t border-x border-slate-800 rounded-t-lg text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="w-3 h-3 text-cyan-400" />
                              <span>Tool: {currentStep.toolName} (Operator Local Execution)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand(currentStep.command)}
                              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              {copiedCommand ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedCommand ? 'Copied!' : 'Copy Command'}</span>
                            </button>
                          </div>
                          <pre className="p-3 bg-slate-950/90 border border-slate-800 rounded-b-lg font-mono text-xs text-cyan-300 overflow-x-auto select-all">
                            {currentStep.command}
                          </pre>
                        </div>

                        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                          <div className="text-[11px] text-slate-400">
                            <strong>Expected Output:</strong> {currentStep.expectedOutput || currentStep.expectedResult}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLoadingExplanation}
                            onClick={() => handleExplainStep(currentStep)}
                            leftIcon={<Sparkles className="w-3 h-3 text-cyan-400" />}
                          >
                            {isLoadingExplanation ? 'Analyzing...' : 'Explain with AI'}
                          </Button>
                        </div>

                        {/* AI Technical Explanation Drawer */}
                        {aiExplanation && (
                          <div className="p-3.5 bg-slate-950/90 rounded-lg border border-cyan-500/30 text-xs space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                                AI Technical Guidance
                              </span>
                              <Badge variant="cyan" size="sm">AI Guidance</Badge>
                            </div>
                            <p className="text-slate-200 leading-relaxed">{aiExplanation.plainEnglishPurpose}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                                <strong className="text-slate-400 block mb-0.5">Why This Test Matters:</strong>
                                <span className="text-slate-300">{aiExplanation.whyThisTestMatters}</span>
                              </div>
                              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                                <strong className="text-slate-400 block mb-0.5">What to Look For:</strong>
                                <span className="text-slate-300">{aiExplanation.whatToLookForInOutput}</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-emerald-400 font-mono pt-1">
                              ✓ {aiExplanation.safetyAssurance}
                            </p>
                          </div>
                        )}

                        {currentStep.rollbackInstructions && (
                          <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80 text-[10px] text-slate-500">
                            Rollback: {currentStep.rollbackInstructions}
                          </div>
                        )}
                      </>
                    )}

                    {/* Alternate Branches Preview (Guided Mode) */}
                    {incident.diagnosticMode === 'GUIDED' && branchPreview && !isFinished && (
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-2 mt-2">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-semibold flex items-center gap-1.5 text-slate-200 text-[11px]">
                            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                            Next Step Preview (Branch Prediction)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">Deterministic Branching</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 rounded bg-slate-900 border border-emerald-500/30">
                            <span className="text-emerald-400 font-semibold block mb-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> If Passed
                            </span>
                            <span className="text-slate-300 text-[10px] line-clamp-2">{branchPreview.passedNext}</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-rose-500/30">
                            <span className="text-rose-400 font-semibold block mb-0.5 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> If Failed
                            </span>
                            <span className="text-slate-300 text-[10px] line-clamp-2">{branchPreview.failedNext}</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-amber-500/30">
                            <span className="text-amber-400 font-semibold block mb-0.5 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" /> If Inconclusive
                            </span>
                            <span className="text-slate-300 text-[10px] line-clamp-2">{branchPreview.inconclusiveNext}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Result Recording Form */}
                  {!isFinished && (
                    <form onSubmit={handleRecordResult} className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-200">
                        Record Observed Test Outcome:
                      </h4>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setOutcome('PASSED')}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            outcome === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Passed</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOutcome('FAILED')}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            outcome === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOutcome('INCONCLUSIVE')}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            outcome === 'INCONCLUSIVE'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Inconclusive</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOutcome('SKIPPED')}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            outcome === 'SKIPPED'
                              ? 'bg-slate-700 text-slate-200 border-slate-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Skip Test</span>
                        </button>
                      </div>

                      <Textarea
                        label="Raw Terminal Output / Error Text (Optional)"
                        placeholder="Paste terminal output here for evidence locker..."
                        value={rawOutput}
                        onChange={e => setRawOutput(e.target.value)}
                        rows={3}
                      />

                      <Textarea
                        label="Technician Observations / Field Notes (Optional)"
                        placeholder="Note any physical lights, error codes, or ambient environment clues..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                      />

                      {/* Controls Bar: Back, Save, Escalate, Submit */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {/* Back Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={session.currentStepIndex === 0}
                            onClick={() => {
                              if (session.currentStepIndex > 0) {
                                setInspectStepIndex(session.currentStepIndex - 1);
                              }
                            }}
                            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                          >
                            Previous Step
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveInvestigation}
                            leftIcon={<Save className="w-3.5 h-3.5" />}
                          >
                            Save
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEscalateModalOpen(true)}
                            leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                            className="border-amber-500/30 text-amber-300"
                          >
                            Escalate
                          </Button>

                          <Button type="submit" variant="primary" size="md">
                            {incident.diagnosticMode === 'AGENT'
                              ? 'Submit Observation & Revise Plan'
                              : 'Record Result & Advance Step'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: DECISION TREE */}
          {activeTab === 'tree' && (
            <Card className="animate-in fade-in duration-150">
              <CardHeader>
                <div>
                  <CardTitle>Dynamic Investigation Decision Tree</CardTitle>
                  <CardDescription>Visual topology of diagnostic branches and hypothesis outcomes.</CardDescription>
                </div>
              </CardHeader>

              <div className="space-y-4 text-xs">
                {session.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    onClick={() => setInspectStepIndex(idx)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      step.outcome === 'PASSED'
                        ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500'
                        : step.outcome === 'FAILED'
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500'
                        : idx === session.currentStepIndex
                        ? 'bg-slate-900 border-cyan-500/50 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 font-bold">Step {idx + 1}</span>
                        <span className="font-semibold text-slate-200">{step.title}</span>
                      </div>
                      <Badge
                        variant={
                          step.outcome === 'PASSED'
                            ? 'emerald'
                            : step.outcome === 'FAILED'
                            ? 'rose'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {step.outcome}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-[11px] font-mono">{step.command}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 3: INVESTIGATION TIMELINE & AUDITS */}
          {activeTab === 'timeline' && (
            <Card className="animate-in fade-in duration-150">
              <CardHeader>
                <div>
                  <CardTitle>Investigation Timeline & Evidence Locker</CardTitle>
                  <CardDescription>Chronological log of technician observations, plan revisions, and evidence.</CardDescription>
                </div>
              </CardHeader>

              {session.evidence.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">No evidence recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {session.evidence.map(ev => (
                    <div key={ev.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant={ev.polarity === 'SUPPORTING' ? 'emerald' : 'rose'} size="sm">
                          {ev.polarity} EVIDENCE
                        </Badge>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(ev.recordedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200">{ev.summary}</p>
                      {ev.rawOutput && (
                        <pre className="p-2 bg-slate-900 rounded font-mono text-[10px] text-slate-400 overflow-x-auto">
                          {ev.rawOutput}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Rail: Hypotheses, Asset Context & Evidence Locker (1 col) */}
        <div className="space-y-4">
          {/* Hypothesis Matrix */}
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div>
                <CardTitle className="text-cyan-300 text-xs">Hypothesis Matrix</CardTitle>
                <CardDescription>Competing root cause explanations weighted by evidence.</CardDescription>
              </div>
            </CardHeader>

            <div className="space-y-3">
              {session.hypotheses.map(hyp => (
                <div key={hyp.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 line-clamp-1">{hyp.title}</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {Math.round(hyp.confidenceScore * 100)}%
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        hyp.confidenceScore >= 0.8
                          ? 'bg-emerald-400'
                          : hyp.confidenceScore >= 0.4
                          ? 'bg-cyan-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.round(hyp.confidenceScore * 100)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">{hyp.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span className="flex items-center gap-1.5">
                      <span>Status:</span>
                      <strong className={
                        hyp.status === 'CONFIRMED'
                          ? 'text-emerald-400'
                          : hyp.status === 'REFUTED'
                          ? 'text-rose-400 line-through'
                          : hyp.status === 'CONTRADICTORY'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }>
                        {hyp.status}
                      </strong>
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {hyp.supportingEvidenceIds?.length || 0} sup / {hyp.refutingEvidenceIds?.length || 0} ref
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Target Asset Context & Connected Infrastructure Topology */}
          {incident.targetAsset && (() => {
            const related = incident.targetAssetId ? repository.getRelatedDependencies(incident.targetAssetId) : null;
            const allDeps = related ? [...related.upstream, ...related.downstream] : [];

            return (
              <Card className="bg-slate-950/60 border-slate-800">
                <CardHeader>
                  <div>
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      Target Asset & Topology
                    </CardTitle>
                    <CardDescription className="text-[10px]">Registered CMDB Metadata</CardDescription>
                  </div>
                  <Link href={`/assets/${incident.targetAsset.id}`} className="text-[11px] text-cyan-400 hover:underline">
                    View Specs
                  </Link>
                </CardHeader>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Asset Tag</span>
                    <span className="font-mono font-bold text-slate-200">{incident.targetAsset.assetTag}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">IP Address</span>
                    <span className="font-mono text-slate-200">{incident.targetAsset.ipAddress || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Hostname</span>
                    <span className="font-mono text-slate-300 truncate max-w-[140px]">{incident.targetAsset.hostname || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Location</span>
                    <span className="text-slate-300 line-clamp-1">{incident.targetAsset.location || '—'}</span>
                  </div>
                </div>

                {/* Connected Infrastructure Dependencies */}
                <div className="pt-2.5 mt-2.5 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Grounding Topology ({allDeps.length}):</span>
                    <Link href="/dependency-map" className="text-[10px] text-cyan-400 hover:underline">
                      View Map
                    </Link>
                  </div>
                  {allDeps.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">No connected infrastructure dependencies registered.</p>
                  ) : (
                    <div className="space-y-1">
                      {allDeps.map((d, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-between">
                          <span className="font-mono text-cyan-400 font-semibold">{d.asset.assetTag}</span>
                          <span className="text-slate-400 font-mono">[{d.relationship.relationshipType}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 italic pt-0.5">
                    Notice: Documented topology reflects confirmed architecture. It does not imply operational connectivity until verified by diagnostic probes.
                  </p>
                </div>
              </Card>
            );
          })()}

          {/* Safety Sandbox Notice */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>Version A Sandboxed</span>
            </div>
            <p className="leading-snug">
              Technician executes commands locally. Zero remote system modifications or background daemons.
            </p>
          </div>
        </div>
      </div>

      {/* Escalation Modal */}
      <Modal
        isOpen={isEscalateModalOpen}
        onClose={() => setIsEscalateModalOpen(false)}
        title="Escalate Incident to Tier 3 Engineering"
        description="Halts automated diagnostic planning and transfers ownership to the senior operations escalations queue."
      >
        <div className="space-y-4 text-xs">
          <Select
            label="Escalation Rationale"
            value={escalateReason}
            onChange={e => setEscalateReason(e.target.value)}
            options={[
              { value: 'Inconclusive diagnostic evidence - root cause unclear', label: 'Inconclusive diagnostic evidence - root cause unclear' },
              { value: 'Physical hardware or on-site cabling inspection required', label: 'Physical hardware or on-site cabling inspection required' },
              { value: 'Third-party vendor or upstream ISP outage suspected', label: 'Third-party vendor or upstream ISP outage suspected' },
              { value: 'Security incident / unauthorized activity suspected', label: 'Security incident / unauthorized activity suspected' },
              { value: 'Specialized enterprise license or administrative credentials required', label: 'Specialized enterprise license or credentials required' },
              { value: 'Other operational escalation', label: 'Other operational escalation' },
            ]}
          />

          <Textarea
            label="Handover Notes / Summary for Tier 3 Team"
            placeholder="Summarize key steps completed and specific equipment location..."
            value={escalateNotes}
            onChange={e => setEscalateNotes(e.target.value)}
            rows={3}
          />

          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>This will mark the session status as ESCALATED and record a permanent audit event.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEscalateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConfirmEscalation}
              className="border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
            >
              Confirm Escalation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resolve Incident Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Resolve & Archive Incident"
        description="Marks the incident as fully resolved and locks the historical post-mortem record."
      >
        <div className="space-y-4 text-xs">
          <Textarea
            label="Resolution Summary & Confirmed Fix *"
            placeholder="Document the exact remedy implemented to resolve this issue..."
            value={resolveNotes}
            onChange={e => setResolveNotes(e.target.value)}
            rows={3}
            required
          />

          <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>This will finalize the post-mortem report and preserve the session in the historical archive.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmResolve}
            >
              Confirm Resolution
            </Button>
          </div>
        </div>
      </Modal>

      {incident && (
        <SaveToKnowledgeBaseModal
          isOpen={isSaveKbModalOpen}
          onClose={() => setIsSaveKbModalOpen(false)}
          incident={incident}
        />
      )}
    </div>
  );
}