// src/components/assets/CsvImportModal.tsx
'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  RotateCcw,
  Check
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/Textarea';
import { CsvPreviewResult } from '@/lib/services/csvImportService';
import { useToast } from '../ui/NotificationToast';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const SAMPLE_CSV = `AssetTag,Name,AssetType,Manufacturer,Model,Hostname,IPAddress,OperatingSystem,Location,Owner,Criticality,Status,Tags
SW-ACC-03,Access Switch Floor 3,SWITCH,Cisco Systems,Catalyst 9300-48P,sw-acc-03.corp.internal,10.0.20.2,Cisco IOS-XE 17.9,HQ Floor 3 IDF,Network Team,TIER_2_HIGH,OPERATIONAL,switch;access;vlan20
SRV-BACKUP-02,Secondary Backup Repository,SERVER,Dell Technologies,PowerEdge R740xd,bkp02.corp.internal,10.0.100.15,Ubuntu 24.04 LTS,DR Site - Rack E01,Storage Team,TIER_2_HIGH,OPERATIONAL,backup;veeam;dr-site
ENG-WS-088,Lead Robotics CAD Workstation,WORKSTATION,HP,Z4 G5 Workstation,ws-eng-088.corp.internal,10.0.20.88,Windows 11 Pro for Workstations,HQ Floor 2 Labs,Alex Rivera,TIER_3_MEDIUM,OPERATIONAL,cad;robotics;workstation
DC-DNS-01,Duplicate Test Server,SERVER,Dell,PowerEdge,dc-dns-01.corp.internal,10.0.1.10,Windows Server 2022,Primary Datacenter,Directory Services,TIER_1_CRITICAL,OPERATIONAL,test;duplicate`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [csvText, setCsvText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [isCommitting, setIsCommitting] = useState(false);

  const { toast } = useToast();

  const handleGeneratePreview = async () => {
    if (!csvText.trim()) {
      toast({ title: 'Validation Error', message: 'Please provide CSV content or load sample.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/assets/import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, workspaceId: 'ws-default' }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process CSV preview');
      }

      setPreview(data.preview);
    } catch (err: any) {
      toast({ title: 'CSV Parse Failed', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;

    // Filter rows based on validity and duplicate preference
    const validRowsToCommit = preview.rows
      .filter(r => r.isValid && (duplicateAction === 'update' || !r.isDuplicate))
      .map(r => r.parsed);

    if (validRowsToCommit.length === 0) {
      toast({ title: 'No Rows to Import', message: 'All rows are either invalid or duplicates marked for skipping.', type: 'error' });
      return;
    }

    setIsCommitting(true);
    try {
      const res = await fetch('/api/assets/import-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRowsToCommit,
          workspaceId: 'ws-default',
          onDuplicate: duplicateAction,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to commit CSV changes');
      }

      toast({
        title: 'CSV Import Completed',
        message: data.message,
        type: 'success',
      });

      onImportComplete();
      handleClose();
    } catch (err: any) {
      toast({ title: 'Import Commit Error', message: err.message, type: 'error' });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setCsvText('');
    setDuplicateAction('skip');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Import Assets via CSV"
      description="Import enterprise IT inventory with column mapping, schema validation, and duplicate protection."
      maxWidth="2xl"
    >
      {!preview ? (
        // Step 1: Input CSV Text
        <div className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-semibold font-sans">
              <span>Supported Standard Header Names:</span>
              <Badge variant="cyan" size="sm">Auto-Mapped</Badge>
            </div>
            <p className="text-cyan-400">
              AssetTag, Name, AssetType, Manufacturer, Model, Hostname, IPAddress, OperatingSystem, Location, Owner, Criticality, Status, Tags
            </p>
            <p className="text-slate-500">
              Supported Asset Types: SERVER, WORKSTATION, LAPTOP, ROUTER, SWITCH, FIREWALL, PRINTER, APPLICATION, SERVICE, VIRTUAL_MACHINE, STORAGE, SHARED_FOLDER
            </p>
          </div>

          <Textarea
            label="Raw CSV Data (Comma Separated)"
            placeholder="Paste your CSV content here including the header line..."
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={8}
          />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              onClick={() => setCsvText(SAMPLE_CSV)}
            >
              Load Sample CSV with Duplicates
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleGeneratePreview}
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Parse & Inspect Preview
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Step 2: Inspect Preview, Errors & Duplicates
        <div className="space-y-4">
          {/* Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Rows</span>
              <span className="text-base font-bold text-slate-200">{preview.totalRows}</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-500/20 text-center">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">New & Valid</span>
              <span className="text-base font-bold text-emerald-300">{preview.validRows}</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-amber-500/20 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-semibold block">Duplicates Detected</span>
              <span className="text-base font-bold text-amber-300">{preview.duplicateRows}</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-rose-500/20 text-center">
              <span className="text-[10px] text-rose-400 uppercase font-semibold block">Syntax Errors</span>
              <span className="text-base font-bold text-rose-300">{preview.invalidRows}</span>
            </div>
          </div>

          {/* Duplicate Handling Policy */}
          {preview.duplicateRows > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Duplicate Protection Policy (Do Not Silently Overwrite)</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {preview.duplicateRows} asset(s) match existing tags, hostnames, or IP addresses in your inventory. Choose how to handle duplicates:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label
                  className={`p-2.5 rounded border cursor-pointer flex items-start gap-2 text-xs transition-colors ${
                    duplicateAction === 'skip'
                      ? 'bg-slate-900 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="dupAction"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                    className="mt-0.5 text-cyan-500"
                  />
                  <div>
                    <span className="font-semibold block text-cyan-400">Skip Duplicates (Recommended)</span>
                    <span className="text-[10px] text-slate-400">Leave existing assets untouched; only import brand-new assets.</span>
                  </div>
                </label>

                <label
                  className={`p-2.5 rounded border cursor-pointer flex items-start gap-2 text-xs transition-colors ${
                    duplicateAction === 'update'
                      ? 'bg-slate-900 border-amber-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="dupAction"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                    className="mt-0.5 text-amber-500"
                  />
                  <div>
                    <span className="font-semibold block text-amber-300">Update Existing Assets</span>
                    <span className="text-[10px] text-slate-400">Explicitly overwrite matched assets with new CSV values.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Preview Row Table */}
          <div className="border border-slate-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Row</th>
                  <th className="py-2 px-3">Asset Tag</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">IP Address</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {preview.rows.map(row => (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-slate-800/30 ${
                      !row.isValid
                        ? 'bg-rose-950/15'
                        : row.isDuplicate
                        ? 'bg-amber-950/15'
                        : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">#{row.rowNumber}</td>
                    <td className="py-2 px-3 font-mono font-bold text-cyan-400">
                      {row.parsed?.assetTag || '—'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="line-clamp-1">{row.parsed?.name || '—'}</div>
                      {row.errors.length > 0 && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{row.errors.join(', ')}</p>
                      )}
                      {row.duplicateReason && (
                        <p className="text-[10px] text-amber-400 mt-0.5">{row.duplicateReason}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="slate" size="sm">
                        {row.parsed?.assetType || 'UNKNOWN'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                      {row.parsed?.ipAddress || '—'}
                    </td>
                    <td className="py-2 px-3">
                      {!row.isValid ? (
                        <Badge variant="rose" size="sm">Invalid</Badge>
                      ) : row.isDuplicate ? (
                        <Badge variant="amber" size="sm">Duplicate</Badge>
                      ) : (
                        <Badge variant="emerald" size="sm">Ready</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => setPreview(null)}
            >
              Back to CSV Input
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCommit}
                isLoading={isCommitting}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Confirm & Commit Import ({preview.validRows + (duplicateAction === 'update' ? preview.duplicateRows : 0)} Assets)
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
