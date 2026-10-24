// src/app/assets/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Server,
  Plus,
  Upload,
  Search,
  Trash2,
  ExternalLink,
  Edit2,
  Tag,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { CsvImportModal } from '@/components/assets/CsvImportModal';
import { useToast } from '@/components/ui/NotificationToast';

export interface PersistentAsset {
  id: string;
  workspaceId: string;
  assetTag: string;
  name: string;
  assetType: string;
  manufacturer?: string | null;
  model?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  operatingSystem?: string | null;
  location?: string | null;
  owner?: string | null;
  notes?: string | null;
  tags?: string | null;
  criticality: string;
  status: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  outgoingRels?: any[];
  incomingRels?: any[];
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<PersistentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersistentAsset | null>(null);
  const [editTarget, setEditTarget] = useState<PersistentAsset | null>(null);

  // Form state
  const [formTag, setFormTag] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('SERVER');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formHostname, setFormHostname] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formOs, setFormOs] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOwner, setFormOwner] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formCriticality, setFormCriticality] = useState('TIER_3_MEDIUM');
  const [formStatus, setFormStatus] = useState('OPERATIONAL');
  const [formNotes, setFormNotes] = useState('');

  const { toast } = useToast();

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/assets?workspaceId=ws-default');
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) {
        setAssets(data.assets);
      }
    } catch (err: any) {
      toast({ title: 'Fetch Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        a.name.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        (a.hostname && a.hostname.toLowerCase().includes(q)) ||
        (a.ipAddress && a.ipAddress.includes(q)) ||
        (a.owner && a.owner.toLowerCase().includes(q)) ||
        (a.tags && a.tags.toLowerCase().includes(q));

      const matchType = typeFilter === 'ALL' || a.assetType === typeFilter;
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [assets, searchTerm, typeFilter, statusFilter]);

  const resetForm = () => {
    setFormTag('');
    setFormName('');
    setFormType('SERVER');
    setFormManufacturer('');
    setFormModel('');
    setFormHostname('');
    setFormIp('');
    setFormOs('');
    setFormLocation('');
    setFormOwner('');
    setFormTags('');
    setFormCriticality('TIER_3_MEDIUM');
    setFormStatus('OPERATIONAL');
    setFormNotes('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (asset: PersistentAsset) => {
    setEditTarget(asset);
    setFormTag(asset.assetTag);
    setFormName(asset.name);
    setFormType(asset.assetType);
    setFormManufacturer(asset.manufacturer || '');
    setFormModel(asset.model || '');
    setFormHostname(asset.hostname || '');
    setFormIp(asset.ipAddress || '');
    setFormOs(asset.operatingSystem || '');
    setFormLocation(asset.location || '');
    setFormOwner(asset.owner || '');
    setFormTags(asset.tags || '');
    setFormCriticality(asset.criticality);
    setFormStatus(asset.status);
    setFormNotes(asset.notes || '');
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      workspaceId: 'ws-default',
      assetTag: formTag.trim().toUpperCase(),
      name: formName.trim(),
      assetType: formType,
      manufacturer: formManufacturer.trim() || null,
      model: formModel.trim() || null,
      hostname: formHostname.trim().toLowerCase() || null,
      ipAddress: formIp.trim() || null,
      operatingSystem: formOs.trim() || null,
      location: formLocation.trim() || null,
      owner: formOwner.trim() || null,
      tags: formTags.trim() || null,
      criticality: formCriticality,
      status: formStatus,
      notes: formNotes.trim() || null,
    };

    try {
      if (editTarget) {
        // Edit existing
        const res = await fetch(`/api/assets/${editTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update asset');
        }
        toast({ title: 'Asset Updated', message: `${payload.assetTag} updated in persistent database.`, type: 'success' });
        setEditTarget(null);
      } else {
        // Create new
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to create asset');
        }
        toast({ title: 'Asset Created', message: `${payload.assetTag} registered in persistent SQLite database.`, type: 'success' });
        setIsAddOpen(false);
      }

      resetForm();
      loadAssets();
    } catch (err: any) {
      toast({ title: 'Save Error', message: err.message, type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/assets/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete asset');
      }

      toast({
        title: 'Asset Deleted',
        message: `${deleteTarget.assetTag} removed and its relationships detached.`,
        type: 'info',
      });

      setDeleteTarget(null);
      loadAssets();
    } catch (err: any) {
      toast({ title: 'Delete Error', message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Asset Inventory Catalog</h1>
            <Badge variant="cyan" size="sm">{assets.length} Persistent Assets</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered enterprise IT assets and components stored in relational SQLite database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Upload className="w-3.5 h-3.5 text-slate-400" />}
            onClick={() => setIsCsvOpen(true)}
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenAdd}
          >
            Register Asset
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/90 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by tag, hostname, IP, name, owner, or tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <Select
            options={[
              { label: 'All Asset Types', value: 'ALL' },
              { label: 'Servers', value: 'SERVER' },
              { label: 'Workstations', value: 'WORKSTATION' },
              { label: 'Laptops', value: 'LAPTOP' },
              { label: 'Routers', value: 'ROUTER' },
              { label: 'Switches', value: 'SWITCH' },
              { label: 'Firewalls', value: 'FIREWALL' },
              { label: 'Virtual Machines', value: 'VIRTUAL_MACHINE' },
              { label: 'Applications', value: 'APPLICATION' },
              { label: 'Services', value: 'SERVICE' },
              { label: 'Storage Arrays', value: 'STORAGE' },
              { label: 'Shared Folders', value: 'SHARED_FOLDER' },
              { label: 'Printers', value: 'PRINTER' },
            ]}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          />

          <Select
            options={[
              { label: 'All Operational Statuses', value: 'ALL' },
              { label: 'Operational (Healthy)', value: 'OPERATIONAL' },
              { label: 'Degraded', value: 'DEGRADED' },
              { label: 'Offline', value: 'OFFLINE' },
              { label: 'Maintenance', value: 'MAINTENANCE' },
            ]}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Asset Table */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span>Loading persistent inventory from SQLite database...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={<Server className="w-8 h-8" />}
          title="No assets match your search"
          description="Try clearing your search terms or type filter, or register a new asset."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setTypeFilter('ALL');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Asset Tag / Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Network / Host</th>
                  <th className="py-3 px-4">Hardware & OS</th>
                  <th className="py-3 px-4">Criticality</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-mono font-bold text-cyan-400 hover:underline"
                        >
                          {asset.assetTag}
                        </Link>
                        {asset.isDemo && <Badge variant="demo" size="sm">Demo</Badge>}
                      </div>
                      <p className="text-[11px] text-slate-200 font-medium line-clamp-1">{asset.name}</p>
                      {asset.location && (
                        <p className="text-[10px] text-slate-500">{asset.location}</p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="slate" size="sm">
                        {asset.assetType}
                      </Badge>
                      {asset.owner && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Owner: {asset.owner}</p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div>{asset.ipAddress || '—'}</div>
                      <div className="text-[10px] text-slate-500">{asset.hostname || '—'}</div>
                    </td>

                    <td className="py-3 px-4 text-[11px]">
                      <div className="text-slate-300 line-clamp-1">
                        {asset.manufacturer ? `${asset.manufacturer} ${asset.model || ''}` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">
                        {asset.operatingSystem || '—'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {asset.criticality === 'TIER_1_CRITICAL' && (
                        <Badge variant="rose" size="sm">Tier 1 Critical</Badge>
                      )}
                      {asset.criticality === 'TIER_2_HIGH' && (
                        <Badge variant="amber" size="sm">Tier 2 High</Badge>
                      )}
                      {asset.criticality === 'TIER_3_MEDIUM' && (
                        <Badge variant="cyan" size="sm">Tier 3 Medium</Badge>
                      )}
                      {asset.criticality === 'TIER_4_LOW' && (
                        <Badge variant="slate" size="sm">Tier 4 Low</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {asset.status === 'OPERATIONAL' && (
                        <Badge variant="emerald" size="sm">Operational</Badge>
                      )}
                      {asset.status === 'DEGRADED' && (
                        <Badge variant="amber" size="sm">Degraded</Badge>
                      )}
                      {asset.status === 'OFFLINE' && (
                        <Badge variant="rose" size="sm">Offline</Badge>
                      )}
                      {asset.status === 'MAINTENANCE' && (
                        <Badge variant="slate" size="sm">Maintenance</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/assets/${asset.id}`}>
                          <Button variant="ghost" size="sm" aria-label={`View ${asset.assetTag} details`}>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(asset)}
                          aria-label={`Edit ${asset.assetTag}`}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(asset)}
                          aria-label={`Delete ${asset.assetTag}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register / Edit Asset Modal */}
      <Modal
        isOpen={isAddOpen || !!editTarget}
        onClose={() => {
          setIsAddOpen(false);
          setEditTarget(null);
        }}
        title={editTarget ? `Edit Asset: ${editTarget.assetTag}` : 'Register New IT Asset'}
        description="Store hardware, virtual machine, network device, or service coordinates in relational database."
        maxWidth="xl"
      >
        <form onSubmit={handleSaveAsset} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Asset Tag *"
              placeholder="e.g. SRV-APP-01"
              value={formTag}
              onChange={e => setFormTag(e.target.value)}
              required
              disabled={!!editTarget} // Tag is unique identifier
            />
            <Input
              label="Asset Name *"
              placeholder="e.g. Core Application Gateway"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
            />
          </div>

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
              value={formType}
              onChange={e => setFormType(e.target.value)}
            />
            <Select
              label="Criticality Tier"
              options={[
                { label: 'Tier 1 Critical', value: 'TIER_1_CRITICAL' },
                { label: 'Tier 2 High', value: 'TIER_2_HIGH' },
                { label: 'Tier 3 Medium', value: 'TIER_3_MEDIUM' },
                { label: 'Tier 4 Low', value: 'TIER_4_LOW' },
              ]}
              value={formCriticality}
              onChange={e => setFormCriticality(e.target.value)}
            />
            <Select
              label="Operational Status"
              options={[
                { label: 'Operational', value: 'OPERATIONAL' },
                { label: 'Degraded', value: 'DEGRADED' },
                { label: 'Offline', value: 'OFFLINE' },
                { label: 'Maintenance', value: 'MAINTENANCE' },
              ]}
              value={formStatus}
              onChange={e => setFormStatus(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Manufacturer / Vendor"
              placeholder="e.g. Cisco / Dell / Fortinet"
              value={formManufacturer}
              onChange={e => setFormManufacturer(e.target.value)}
            />
            <Input
              label="Model Number / Platform"
              placeholder="e.g. Catalyst 9500 / PowerEdge R750"
              value={formModel}
              onChange={e => setFormModel(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Hostname / FQDN"
              placeholder="app01.corp.internal"
              value={formHostname}
              onChange={e => setFormHostname(e.target.value)}
            />
            <Input
              label="IP Address (where applicable)"
              placeholder="10.0.1.75 or 10.0.1.0/24"
              value={formIp}
              onChange={e => setFormIp(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Operating System / Firmware"
              placeholder="Ubuntu 22.04 LTS"
              value={formOs}
              onChange={e => setFormOs(e.target.value)}
            />
            <Input
              label="Physical / Virtual Location"
              placeholder="Datacenter 1 - Rack C04"
              value={formLocation}
              onChange={e => setFormLocation(e.target.value)}
            />
            <Input
              label="Owner / Custodian Team"
              placeholder="Infrastructure Operations"
              value={formOwner}
              onChange={e => setFormOwner(e.target.value)}
            />
          </div>

          <Input
            label="Tags (Comma separated)"
            placeholder="e.g. core-infra, erp, vlan10"
            value={formTags}
            onChange={e => setFormTags(e.target.value)}
            leftIcon={<Tag className="w-3.5 h-3.5" />}
          />

          <Textarea
            label="Operational Notes / Purpose"
            placeholder="Special instructions, credentials storage, or assigned network role..."
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsAddOpen(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editTarget ? 'Update Asset' : 'Register Asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal with Preview and Duplicate Protection */}
      <CsvImportModal
        isOpen={isCsvOpen}
        onClose={() => setIsCsvOpen(false)}
        onImportComplete={() => loadAssets()}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete Asset ${deleteTarget?.assetTag}?`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Any infrastructure dependency links involving this asset will be permanently detached.`}
        confirmLabel="Confirm Delete"
        variant="danger"
      />
    </div>
  );
}
