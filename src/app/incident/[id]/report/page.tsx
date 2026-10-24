// src/app/incident/[id]/report/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Edit2,
  Save,
  AlertTriangle,
  Server,
  Layers,
  Terminal,
  Clock,
  Eye,
  FileCheck,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { repository } from '@/lib/data/repository';
import { Incident, PostMortemReport, RemediationAction, FiveWhysItem } from '@/types/incident';
import { useToast } from '@/components/ui/NotificationToast';
import { SaveToKnowledgeBaseModal } from '@/components/knowledgeBase/SaveToKnowledgeBaseModal';

export default function IncidentReportPage() {
  const params = useParams();
  const incidentId = params?.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'preview'>('standard');
  const [isSaveKbModalOpen, setIsSaveKbModalOpen] = useState(false);

  // Editable report fields
  const [execSummary, setExecSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [fiveWhys, setFiveWhys] = useState<FiveWhysItem[]>([]);
  const [verifiedFixes, setVerifiedFixes] = useState<RemediationAction[]>([]);
  const [unverifiedRecs, setUnverifiedRecs] = useState<RemediationAction[]>([]);
  const [escalationNotes, setEscalationNotes] = useState('');
  const [signOff, setSignOff] = useState('');

  const { toast } = useToast();

  const loadData = () => {
    if (!incidentId) return;
    const found = repository.getIncidentById(incidentId);
    if (found) {
      setIncident(found);
      const rep = found.report || {
        id: `rep-${Date.now()}`,
        incidentId: found.id,
        executiveSummary: `Incident ${found.ticketNumber} regarding ${found.title}. Root cause isolated through inventory-grounded diagnostics.`,
        confirmedRootCause: found.resolutionNotes || 'Root cause confirmed through empirical diagnostic telemetry.',
        fiveWhys: [
          { whyNumber: 1, question: 'Why did the service fail to respond?', answer: found.title },
          { whyNumber: 2, question: 'Why did the primary test fail?', answer: 'Diagnostic probe reported packet loss or service rejection.' },
          { whyNumber: 3, question: 'Why did the failure cascade?', answer: 'Missing fallback redundancy or configuration drift on host.' },
          { whyNumber: 4, question: 'Why was the configuration drifted?', answer: 'Maintenance update executed without full regression verification.' },
          { whyNumber: 5, question: 'Why was regression verification missed?', answer: 'Lack of automated pre-flight post-change validation.' }
        ],
        verifiedFixes: [
          { id: 'fix-1', action: 'Verify endpoint network adapter and operational status', owner: 'Tier 2 Support', isVerified: true },
          { id: 'fix-2', action: 'Validate local service host configuration parameters', owner: 'Systems Administration', isVerified: true }
        ],
        unverifiedRecommendations: [
          { id: 'rec-1', action: 'Update enterprise monitoring alert threshold', owner: 'Monitoring Operations', isVerified: false },
          { id: 'rec-2', action: 'Schedule quarterly topology audit for upstream links', owner: 'Network Engineering', isVerified: false }
        ],
        signOffOperator: 'Adarsh Panicker (Lead Incident Systems Engineer)',
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setExecSummary(rep.executiveSummary);
      setRootCause(rep.confirmedRootCause);
      setProblemDescription(found.rawDescription || found.title);
      setFiveWhys(rep.fiveWhys);
      setVerifiedFixes(rep.verifiedFixes);
      setUnverifiedRecs(rep.unverifiedRecommendations);
      setEscalationNotes(found.session?.stopReason === 'MANUAL_ESCALATION' ? 'Technician manually escalated for physical on-site intervention.' : 'Investigation executed within safety sandbox.');
      setSignOff(rep.signOffOperator);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('fixflow-data-changed', loadData);
    return () => window.removeEventListener('fixflow-data-changed', loadData);
  }, [incidentId]);

  if (!incident) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-slate-400">Loading incident post-mortem report...</p>
        <Link href="/investigations">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Investigations
          </Button>
        </Link>
      </div>
    );
  }

  const session = incident.session;
  const relatedDeps = incident.targetAssetId ? repository.getRelatedDependencies(incident.targetAssetId) : null;
  const allDeps = relatedDeps ? [...relatedDeps.upstream, ...relatedDeps.downstream] : [];

  const isInconclusive =
    session?.status === 'ESCALATED' ||
    session?.stopReason === 'SESSION_BUDGET_EXHAUSTED' ||
    session?.stopReason === 'INCONCLUSIVE' ||
    (incident.status !== 'ROOT_CAUSE_IDENTIFIED' && incident.status !== 'RESOLVED');

  const handleSaveReport = () => {
    const updatedReport: PostMortemReport = {
      id: incident.report?.id || `rep-${Date.now()}`,
      incidentId: incident.id,
      executiveSummary: execSummary,
      confirmedRootCause: rootCause,
      fiveWhys,
      verifiedFixes,
      unverifiedRecommendations: unverifiedRecs,
      signOffOperator: signOff,
      generatedAt: incident.report?.generatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repository.updateIncident(incident.id, {
      rawDescription: problemDescription,
      report: updatedReport
    });

    setIsEditing(false);
    toast({ title: 'Report Saved', message: 'Post-mortem RCA saved to local repository.', type: 'success' });
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleFixVerification = (id: string) => {
    setVerifiedFixes(prev =>
      prev.map(f => (f.id === id ? { ...f, isVerified: !f.isVerified } : f))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header - Hidden on Print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link href={`/incident/${incident.id}`}>
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Workbench
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Post-Mortem Root Cause Analysis
              </h1>
              {incident.isDemo && <Badge variant="demo" size="sm">Demo Record</Badge>}
              <Badge variant={isInconclusive ? 'amber' : 'emerald'} size="sm">
                {isInconclusive ? 'INCONCLUSIVE / ESCALATED' : 'VERIFIED RCA'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive post-incident report derived solely from recorded diagnostic facts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'standard' ? 'preview' : 'standard')}
            leftIcon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}
          >
            {viewMode === 'standard' ? 'A4 Paginated Preview' : 'Document View'}
          </Button>

          {isEditing ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              onClick={handleSaveReport}
            >
              Save Report
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setIsEditing(true)}
            >
              Edit Post-Mortem
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-emerald-700/80 text-emerald-400 hover:bg-emerald-950/40"
            leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}
            onClick={() => setIsSaveKbModalOpen(true)}
          >
            Save to KB
          </Button>

          <Button
            variant="cyan"
            size="sm"
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            onClick={handlePrint}
          >
            Export / Print PDF
          </Button>
        </div>
      </div>

      {/* Main Report Document Container */}
      <div
        className={`mx-auto transition-all ${
          viewMode === 'preview'
            ? 'max-w-[850px] bg-slate-900 border border-slate-700/80 rounded-xl p-8 sm:p-12 shadow-2xl space-y-6 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none print:p-0'
            : 'bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6 text-slate-200 shadow-xl print:bg-white print:text-black print:border-none print:shadow-none print:p-0'
        }`}
      >
        {/* Official Report Brand Banner */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:border-black avoid-break">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black border border-cyan-500/40 flex items-center justify-center shrink-0 print:border-black">
              <img src="/logo.png" alt="FixFlow AI" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white print:text-black">FixFlow AI</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono print:text-black print:border-black">Enterprise RCA</span>
              </div>
              <p className="text-[11px] text-cyan-400 print:text-black font-medium">By Adarsh Panicker</p>
            </div>
          </div>

          <div className="text-right text-[10px] text-slate-400 print:text-black font-mono">
            <div>Root Cause Analysis Specification</div>
            <div className="text-slate-500 print:text-black">Copyrighted &copy; {new Date().getFullYear()} Adarsh Panicker</div>
          </div>
        </div>

        {/* Document Header & Metadata Table */}
        <div className="border-b border-slate-800 pb-5 print:border-black space-y-3 avoid-break">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-cyan-400 print:text-black">
                {incident.ticketNumber}
              </span>
              <Badge variant="rose" size="sm">{incident.severity}</Badge>
              <Badge variant="cyan" size="sm">{incident.category}</Badge>
              <Badge variant="slate" size="sm">Mode: {incident.diagnosticMode}</Badge>
            </div>
            <div className="text-right text-[11px] text-slate-400 print:text-black font-mono">
              <div>Report Generated: {new Date().toLocaleDateString()}</div>
              <div className="text-[10px] text-slate-500 print:text-black">Incident Created: {new Date(incident.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-100 print:text-black leading-tight">
            {incident.title}
          </h2>

          {/* Affected Target Asset & CMDB Context */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 print:bg-slate-50 print:border-black">
            <div>
              <span className="text-slate-500 print:text-black block font-semibold text-[10px] uppercase">Affected Target Asset</span>
              <span className="font-mono text-cyan-400 print:text-black font-bold">
                {incident.targetAsset?.assetTag || 'Unspecified'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 print:text-black block font-semibold text-[10px] uppercase">IP Address / Hostname</span>
              <span className="font-mono text-slate-300 print:text-black">
                {incident.targetAsset?.ipAddress || incident.targetAsset?.hostname || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 print:text-black block font-semibold text-[10px] uppercase">Resolution Status</span>
              <span className={`font-semibold print:text-black ${incident.status === 'RESOLVED' || incident.status === 'ROOT_CAUSE_IDENTIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {incident.status}
              </span>
            </div>
            <div>
              <span className="text-slate-500 print:text-black block font-semibold text-[10px] uppercase">Sign-Off Lead</span>
              <span className="text-slate-300 print:text-black font-medium">{signOff}</span>
            </div>
          </div>
        </div>

        {/* INCONCLUSIVE INVESTIGATION NOTICE (When applicable) */}
        {isInconclusive && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-1.5 avoid-break print:border-black print:bg-slate-100 print:text-black">
            <div className="flex items-center gap-2 font-bold text-amber-400 print:text-black">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>INCONCLUSIVE INVESTIGATION NOTICE</span>
            </div>
            <p className="leading-relaxed text-[11px] print:text-black">
              Diagnostic evidence gathered during this session was insufficient to definitively isolate a single root cause within the authorized read-only safety sandbox. Competing hypotheses remain unconfirmed. The incident has been escalated for physical hardware inspection, specialized administrative credentials, or packet trace capture.
            </p>
          </div>
        )}

        {/* Section 1: Problem Description & User Reported Impact */}
        <div className="space-y-2 avoid-break">
          <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
            <span>1. Problem Description & Operational Impact</span>
          </h3>
          {isEditing ? (
            <Textarea
              value={problemDescription}
              onChange={e => setProblemDescription(e.target.value)}
              rows={3}
            />
          ) : (
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 print:bg-white print:border-black text-xs text-slate-300 print:text-black leading-relaxed">
              {problemDescription}
            </div>
          )}
        </div>

        {/* Section 2: Executive Incident Summary & Confirmed Root Cause */}
        <div className="space-y-3 avoid-break">
          <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider">
            2. Executive Incident Summary & Confirmed Root Cause
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-slate-400 print:text-black font-semibold block mb-1">Executive Summary:</span>
              {isEditing ? (
                <Textarea
                  value={execSummary}
                  onChange={e => setExecSummary(e.target.value)}
                  rows={3}
                />
              ) : (
                <p className="text-xs text-slate-300 print:text-black leading-relaxed">
                  {execSummary}
                </p>
              )}
            </div>

            <div>
              <span className="text-[11px] text-slate-400 print:text-black font-semibold block mb-1">Root Cause Finding:</span>
              {isEditing ? (
                <Textarea
                  value={rootCause}
                  onChange={e => setRootCause(e.target.value)}
                  rows={2}
                />
              ) : (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 print:border-black print:bg-slate-50 text-xs font-medium text-slate-200 print:text-black">
                  {rootCause}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Registered Infrastructure Topology & Dependencies */}
        <div className="space-y-2.5 avoid-break">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              <span>3. Grounding Infrastructure Topology & Dependencies</span>
            </h3>
            <span className="text-[10px] text-slate-400 print:text-black font-mono">Registered CMDB Architecture</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-black print:bg-white space-y-2 text-xs">
            {allDeps.length === 0 ? (
              <p className="text-slate-500 italic text-[11px]">No upstream or downstream infrastructure dependencies registered.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allDeps.map((d, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 print:border-black print:bg-slate-50 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-mono text-cyan-400 print:text-black font-bold">{d.asset.assetTag}</span>
                      <span className="text-slate-400 ml-1.5 print:text-black">({d.asset.name})</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 print:text-black">[{d.relationship.relationshipType}]</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500 print:text-black italic">
              Notice: Registered topology reflects documented architecture. It does not imply operational health until confirmed by empirical diagnostic tests.
            </p>
          </div>
        </div>

        {/* Section 4: Chronological Diagnostic Steps Executed */}
        <div className="space-y-3 avoid-break">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>4. Chronological Diagnostic Test Execution</span>
            </h3>
            <span className="text-[10px] text-slate-400 print:text-black font-mono">
              {session?.steps.filter(s => s.outcome !== 'NOT_TESTED').length || 0} Probes Completed
            </span>
          </div>

          {session && session.steps.length > 0 ? (
            <div className="space-y-2">
              {session.steps.filter(s => s.outcome !== 'NOT_TESTED').map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-black print:bg-white text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 print:text-black font-bold">Step #{idx + 1}:</span>
                      <span className="font-semibold text-slate-200 print:text-black">{step.title}</span>
                      {step.toolName && (
                        <span className="text-[10px] text-slate-500 font-mono print:text-black">[{step.toolName}]</span>
                      )}
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

                  <p className="text-slate-400 print:text-black text-[11px] leading-relaxed">{step.purpose}</p>

                  <div className="p-2 bg-slate-900 print:bg-slate-100 rounded border border-slate-800/80 print:border-black font-mono text-[10px] text-cyan-300 print:text-black overflow-x-auto">
                    {step.command}
                  </div>

                  <div className="text-[10px] text-slate-400 print:text-black">
                    <strong>Expected:</strong> {step.expectedResult || step.expectedOutput}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No diagnostic steps executed yet.</p>
          )}
        </div>

        {/* Section 5: Actual Recorded Observations & Evidence Locker */}
        <div className="space-y-3 avoid-break">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>5. Empirical Evidence Locker (Observed Facts)</span>
            </h3>
            <span className="text-[10px] text-slate-400 print:text-black font-mono">
              {session?.evidence.length || 0} Recorded Facts
            </span>
          </div>

          {session && session.evidence.length > 0 ? (
            <div className="space-y-2">
              {session.evidence.map((ev, evIdx) => (
                <div
                  key={ev.id || evIdx}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 print:border-black print:bg-white text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 print:text-black">{ev.summary}</span>
                    <Badge variant={ev.polarity === 'SUPPORTING' ? 'emerald' : 'rose'} size="sm">
                      {ev.polarity}
                    </Badge>
                  </div>
                  {ev.technicianNotes && (
                    <p className="text-[11px] text-slate-400 print:text-black italic">
                      Technician Note: {ev.technicianNotes}
                    </p>
                  )}
                  {ev.rawOutput && (
                    <pre className="p-2 bg-slate-900 print:bg-slate-100 rounded text-[10px] font-mono text-slate-300 print:text-black overflow-x-auto">
                      {ev.rawOutput}
                    </pre>
                  )}
                  <div className="text-[9px] text-slate-500 print:text-black font-mono">
                    Source: Technician Terminal Entry | Timestamp: {new Date(ev.recordedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No empirical telemetry evidence recorded.</p>
          )}
        </div>

        {/* Section 6: Confirmed Findings vs Unverified Hypotheses */}
        <div className="space-y-3 avoid-break">
          <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>6. Hypotheses Evaluation Matrix</span>
          </h3>

          {session && session.hypotheses.length > 0 ? (
            <div className="space-y-2">
              {session.hypotheses.map(hyp => (
                <div
                  key={hyp.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 print:border-black print:bg-white text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 print:text-black">{hyp.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 print:text-black font-bold">
                        {Math.round(hyp.confidenceScore * 100)}%
                      </span>
                      <Badge
                        variant={
                          hyp.status === 'CONFIRMED'
                            ? 'emerald'
                            : hyp.status === 'REFUTED'
                            ? 'rose'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {hyp.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 print:text-black">{hyp.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No hypotheses evaluated.</p>
          )}
        </div>

        {/* Section 7: 5-Whys Causal Progression */}
        <div className="space-y-3 avoid-break">
          <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider">
            7. 5-Whys Root Cause Progression
          </h3>
          <div className="space-y-2">
            {fiveWhys.map((why, idx) => (
              <div
                key={why.whyNumber}
                className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 print:border-black print:bg-white text-xs space-y-1"
              >
                <div className="font-semibold text-slate-300 print:text-black">
                  Why #{why.whyNumber}: {why.question}
                </div>
                {isEditing ? (
                  <Input
                    value={why.answer}
                    onChange={e => {
                      const updated = [...fiveWhys];
                      updated[idx].answer = e.target.value;
                      setFiveWhys(updated);
                    }}
                  />
                ) : (
                  <div className="text-slate-400 print:text-black pl-3 border-l-2 border-cyan-500 print:border-black">
                    Answer: {why.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 8: Remediation Action Plan & Verification */}
        <div className="space-y-4 avoid-break">
          <h3 className="text-xs font-bold text-cyan-400 print:text-black uppercase tracking-wider">
            8. Remediation Action Plan & Verification
          </h3>

          <div className="space-y-3">
            <div>
              <h4 className="text-[11px] font-semibold text-emerald-400 print:text-black uppercase tracking-wider mb-2">
                Verified Immediate Fixes:
              </h4>
              <div className="space-y-2">
                {verifiedFixes.map(fix => (
                  <div
                    key={fix.id}
                    className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 print:border-black print:bg-white text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={fix.isVerified}
                        onChange={() => toggleFixVerification(fix.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span className={fix.isVerified ? 'text-slate-200 print:text-black' : 'text-slate-400'}>
                        {fix.action}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 print:text-black font-mono">Owner: {fix.owner}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-amber-400 print:text-black uppercase tracking-wider mb-2">
                Unverified Long-Term Recommendations (Requires Change Management):
              </h4>
              <div className="space-y-2">
                {unverifiedRecs.map(rec => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded bg-slate-950/60 border border-slate-800 print:border-black print:bg-white text-xs flex items-center justify-between"
                  >
                    <span className="text-slate-300 print:text-black">[UNVERIFIED] {rec.action}</span>
                    <span className="text-[10px] text-slate-500 print:text-black font-mono">Owner: {rec.owner}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Escalation Notes */}
            {escalationNotes && (
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 print:text-black uppercase tracking-wider mb-1">
                  Escalation Notes & Operational Handover:
                </h4>
                {isEditing ? (
                  <Textarea
                    value={escalationNotes}
                    onChange={e => setEscalationNotes(e.target.value)}
                    rows={2}
                  />
                ) : (
                  <p className="text-xs text-slate-300 print:text-black p-2.5 rounded bg-slate-950/60 border border-slate-800 print:border-black print:bg-white">
                    {escalationNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Operator Sign-Off & Truth-in-Reporting Stamp */}
        <div className="pt-6 border-t border-slate-800 print:border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400 print:text-black avoid-break">
          <div>
            <span className="font-semibold text-slate-300 print:text-black">Lead Sign-off Authority: </span>
            {isEditing ? (
              <Input value={signOff} onChange={e => setSignOff(e.target.value)} />
            ) : (
              <span className="font-mono text-cyan-400 print:text-black font-bold">{signOff}</span>
            )}
          </div>
          <div className="font-mono text-[10px] text-slate-500 print:text-black flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400 print:text-black" />
            <span>FixFlow AI Truth-in-Reporting Verification Stamp</span>
          </div>
        </div>

        {/* Document Footer with Copyright */}
        <div className="pt-4 text-[10px] text-slate-500 print:text-black text-center border-t border-slate-800/60 print:border-black">
          FixFlow AI Forensic Diagnostics Platform • Copyrighted &copy; {new Date().getFullYear()} Adarsh Panicker • All rights reserved.
        </div>
      </div>

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