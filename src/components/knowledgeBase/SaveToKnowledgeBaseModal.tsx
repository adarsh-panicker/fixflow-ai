// src/components/knowledgeBase/SaveToKnowledgeBaseModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Save
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/NotificationToast';
import { Incident } from '@/types/incident';
import { DiagnosticStepItem } from '@/types/knowledgeBase';

interface SaveToKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
}

export const SaveToKnowledgeBaseModal: React.FC<SaveToKnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  incident,
}) => {
  const [title, setTitle] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [category, setCategory] = useState('INFRASTRUCTURE');
  const [assetType, setAssetType] = useState('SERVER');
  const [operatingSystem, setOperatingSystem] = useState('');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [solution, setSolution] = useState('');
  const [prevention, setPrevention] = useState('');
  const [status, setStatus] = useState<'VERIFIED' | 'DRAFT'>('VERIFIED');
  const [steps, setSteps] = useState<DiagnosticStepItem[]>([]);

  // Duplicate Check
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  // Pre-fill fields whenever incident changes or modal opens
  useEffect(() => {
    if (!isOpen || !incident) return;

    // Detect error code from text
    const textToScan = `${incident.title} ${incident.rawDescription || ''}`;
    const hexCodeMatch = textToScan.match(/0x[0-9a-fA-F]{8}/);
    const eventIdMatch = textToScan.match(/Event ID\s*([0-9]+)/i);
    const namedErrorMatch = textToScan.match(/(NXDOMAIN|TIMEOUT|REFUSED|ACCESS_DENIED|DEADLOCK)/i);

    let detectedErrorCode = '';
    if (hexCodeMatch) detectedErrorCode = hexCodeMatch[0];
    else if (eventIdMatch) detectedErrorCode = `EVENT_${eventIdMatch[1]}`;
    else if (namedErrorMatch) detectedErrorCode = namedErrorMatch[0].toUpperCase();

    // Clean Title
    const initialTitle = incident.title.replace(/\.{3}$/, '').trim();
    setTitle(initialTitle);
    setErrorCode(detectedErrorCode);

    // Map Category
    let cat = 'INFRASTRUCTURE';
    const cUpper = (incident.category || '').toUpperCase();
    if (cUpper.includes('NETWORK') || cUpper.includes('DNS') || cUpper.includes('ROUT')) cat = 'NETWORK';
    else if (cUpper.includes('STORAGE') || cUpper.includes('FILE') || cUpper.includes('BACKUP')) cat = 'STORAGE';
    else if (cUpper.includes('PRINT') || cUpper.includes('HARDWARE')) cat = 'HARDWARE';
    else if (cUpper.includes('DATABASE') || cUpper.includes('SQL')) cat = 'DATABASE';
    else if (cUpper.includes('SEC') || cUpper.includes('AUTH') || cUpper.includes('VPN')) cat = 'SECURITY';
    setCategory(cat);

    // Target Asset Details
    if (incident.targetAsset) {
      setAssetType(incident.targetAsset.assetType || 'SERVER');
      setOperatingSystem(incident.targetAsset.operatingSystem || '');
    } else {
      setAssetType('SERVER');
      setOperatingSystem('');
    }

    setDescription(incident.rawDescription || incident.title);

    // Symptoms from title and notes
    const symList = [incident.title];
    if (detectedErrorCode) symList.push(`Error code reported: ${detectedErrorCode}`);
    if (incident.targetAsset?.hostname) symList.push(`Target Host: ${incident.targetAsset.hostname}`);
    setSymptoms(symList.join('\n'));

    // Steps from executed session steps
    if (incident.session?.steps && incident.session.steps.length > 0) {
      const mappedSteps: DiagnosticStepItem[] = incident.session.steps.slice(0, 5).map(s => ({
        title: s.title || (s as any).name || 'Diagnostic Step',
        command: s.command || '',
        purpose: s.purpose || 'Empirical diagnostic verification step',
        expectedResult: s.expectedResult || 'Expected standard operational status',
        riskRating: (s.safetyClassification as any) === 'SAFE_READ_ONLY' ? 'SAFE_READ_ONLY' : 'ELEVATED_AUDIT_WARNING',
      }));
      setSteps(mappedSteps);
    } else {
      setSteps([
        {
          title: 'Verify Service Availability',
          command: 'Test-NetConnection -ComputerName <Target> -Port <Port>',
          purpose: 'Confirm destination port responds to TCP handshake.',
          expectedResult: 'TcpTestSucceeded: True',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]);
    }

    // Solution from resolution notes or report
    const verifiedFixes = incident.report?.verifiedFixes?.map(f => `• ${f.action}`).join('\n');
    const initialSolution =
      verifiedFixes ||
      incident.resolutionNotes ||
      'Remediation verified: restart client service, update inbound firewall rules, and clear stale cache.';
    setSolution(initialSolution);

    // Prevention from 5 Whys or recommendations
    const recs = incident.report?.unverifiedRecommendations?.map(r => `• ${r.action}`).join('\n');
    setPrevention(recs || 'Implement standardized configuration baseline and monitoring check.');

    setDuplicateWarning(null);
  }, [isOpen, incident]);

  // Duplicate Check
  const handleCheckDuplicate = async () => {
    if (!title.trim()) return;
    setIsCheckingDuplicate(true);
    setDuplicateWarning(null);

    try {
      const symArray = symptoms.split('\n').filter(s => s.trim().length > 0);
      const res = await fetch('/api/knowledge-base/duplicate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          originalErrorDescription: description,
          errorCode: errorCode || null,
          symptoms: symArray,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result.hasDuplicate) {
          setDuplicateWarning(
            `Existing Similar Solution (${data.result.similarityScore}% match): "${data.result.matchedArticle.title}". ${data.result.reason}`
          );
        } else {
          toast({ title: 'Unique Solution', message: 'No duplicate articles found. Solution is unique.', type: 'success' });
        }
      }
    } catch (err) {
      console.error('Duplicate check failed:', err);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !solution.trim()) {
      toast({ title: 'Incomplete Fields', message: 'Please provide title, problem description, and verified solution.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const symArray = symptoms.split('\n').filter(s => s.trim().length > 0);

      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          errorCode: errorCode.trim() || null,
          category,
          assetType: assetType || null,
          operatingSystem: operatingSystem.trim() || null,
          originalErrorDescription: description.trim(),
          symptoms: symArray.length > 0 ? symArray : [title.trim()],
          diagnosticSteps: steps.filter(s => s.title.trim().length > 0),
          verifiedSolution: solution.trim(),
          preventionNotes: prevention.trim() || null,
          status,
          confidenceBasis: status === 'VERIFIED' ? 'ADMIN_VERIFIED' : 'USER_CONFIRMED',
          createdBy: 'Incident Triage Technician',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save knowledge article');
      }

      toast({ title: 'Solution Saved', message: 'Solution successfully saved to Knowledge Base!', type: 'success' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Save Failed', message: err.message || 'Save failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Verified Solution to Knowledge Base"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center gap-2.5 text-emerald-300">
          <BookOpen className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <p className="text-xs">
            Capture this proven resolution from ticket <strong>{incident.ticketNumber}</strong> so future incidents matching this error can be solved instantly without external API calls.
          </p>
        </div>

        {/* Title & Error Code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <label className="text-slate-300 font-medium">Knowledge Article Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Error Code</label>
            <input
              type="text"
              value={errorCode}
              onChange={e => setErrorCode(e.target.value)}
              placeholder="e.g. 0x80070035"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Category, Asset Type, OS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="NETWORK">Network</option>
              <option value="HARDWARE">Hardware</option>
              <option value="STORAGE">Storage</option>
              <option value="APPLICATION">Application</option>
              <option value="SECURITY">Security</option>
              <option value="DATABASE">Database</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Compatible Asset Type</label>
            <select
              value={assetType}
              onChange={e => setAssetType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="SERVER">Server</option>
              <option value="WORKSTATION">Workstation</option>
              <option value="LAPTOP">Laptop</option>
              <option value="ROUTER">Router</option>
              <option value="SWITCH">Switch</option>
              <option value="FIREWALL">Firewall</option>
              <option value="PRINTER">Printer</option>
              <option value="DATABASE">Database</option>
              <option value="APPLICATION">Application</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Operating System</label>
            <input
              type="text"
              value={operatingSystem}
              onChange={e => setOperatingSystem(e.target.value)}
              placeholder="e.g. Windows Server 2022"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Problem Description & Duplicate Check */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-medium">Observed Error / Problem Description *</label>
            <button
              type="button"
              onClick={handleCheckDuplicate}
              disabled={isCheckingDuplicate}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isCheckingDuplicate ? 'Checking...' : 'Check for Existing Articles'}</span>
            </button>
          </div>
          <textarea
            required
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">{duplicateWarning}</div>
          </div>
        )}

        {/* Verified Solution */}
        <div className="space-y-1">
          <label className="text-slate-200 font-semibold flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Proven Remediation Steps *</span>
          </label>
          <textarea
            required
            rows={3}
            value={solution}
            onChange={e => setSolution(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Prevention & RCA */}
        <div className="space-y-1">
          <label className="text-slate-300 font-medium">Root Cause & Prevention</label>
          <textarea
            rows={2}
            value={prevention}
            onChange={e => setPrevention(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Selection */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-200">Publication Status</div>
            <div className="text-[11px] text-slate-400">
              Verified solutions are immediately recommended to technicians on intake.
            </div>
          </div>

          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs"
          >
            <option value="VERIFIED">Verified (Ready for First-Line Recommendation)</option>
            <option value="DRAFT">Draft (Requires Admin Review)</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save to Knowledge Base
          </Button>
        </div>
      </form>
    </Modal>
  );
};
