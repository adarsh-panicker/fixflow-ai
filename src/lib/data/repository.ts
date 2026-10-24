// src/lib/data/repository.ts
'use client';

import { DiagnosticEngine } from '@/lib/engine/diagnosticEngine';
import { AgentEngine } from '@/lib/engine/agentEngine';
import { GuidedAdapter } from '@/lib/engine/guidedAdapter';
import { Asset, AssetDependency } from '@/types/asset';
import { Incident, StepOutcome, DiagnosticMode } from '@/types/incident';
import { DEMO_ASSETS, DEMO_DEPENDENCIES, DEMO_INCIDENTS } from './demoData';

const ASSETS_STORAGE_KEY = 'fixflow_assets_v1';
const DEPS_STORAGE_KEY = 'fixflow_dependencies_v1';
const INCIDENTS_STORAGE_KEY = 'fixflow_incidents_v1';

class DataRepository {
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  // ==========================================
  // RESET DEMO DATA
  // ==========================================
  public resetToDemoData(): void {
    if (this.isBrowser()) {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(DEMO_ASSETS));
      localStorage.setItem(DEPS_STORAGE_KEY, JSON.stringify(DEMO_DEPENDENCIES));
      localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(DEMO_INCIDENTS));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
  }

  // ==========================================
  // ASSETS
  // ==========================================
  public getAssets(): Asset[] {
    if (!this.isBrowser()) return DEMO_ASSETS;
    const stored = localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(DEMO_ASSETS));
      return DEMO_ASSETS;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return DEMO_ASSETS;
    }
  }

  public getAssetById(id: string): Asset | undefined {
    const assets = this.getAssets();
    return assets.find(a => a.id === id || a.assetTag === id);
  }

  public createAsset(newAsset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Asset {
    const assets = this.getAssets();
    const created: Asset = {
      ...newAsset,
      id: `ast-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false
    };
    assets.unshift(created);
    if (this.isBrowser()) {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return created;
  }

  public updateAsset(id: string, updates: Partial<Asset>): Asset | undefined {
    const assets = this.getAssets();
    const index = assets.findIndex(a => a.id === id);
    if (index === -1) return undefined;

    assets[index] = {
      ...assets[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (this.isBrowser()) {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return assets[index];
  }

  public deleteAsset(id: string): boolean {
    const assets = this.getAssets();
    const filtered = assets.filter(a => a.id !== id);
    if (filtered.length === assets.length) return false;

    if (this.isBrowser()) {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(filtered));
      // Also delete dependencies involving this asset
      const deps = this.getDependencies().filter(d => d.sourceAssetId !== id && d.targetAssetId !== id);
      localStorage.setItem(DEPS_STORAGE_KEY, JSON.stringify(deps));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return true;
  }

  // ==========================================
  // DEPENDENCIES
  // ==========================================
  public getDependencies(): AssetDependency[] {
    if (!this.isBrowser()) return DEMO_DEPENDENCIES;
    const stored = localStorage.getItem(DEPS_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(DEPS_STORAGE_KEY, JSON.stringify(DEMO_DEPENDENCIES));
      return DEMO_DEPENDENCIES;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return DEMO_DEPENDENCIES;
    }
  }

  public createDependency(dep: Omit<AssetDependency, 'id'>): AssetDependency {
    const deps = this.getDependencies();
    const created: AssetDependency = {
      ...dep,
      id: `dep-${Date.now()}`
    };
    deps.push(created);
    if (this.isBrowser()) {
      localStorage.setItem(DEPS_STORAGE_KEY, JSON.stringify(deps));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return created;
  }

  public deleteDependency(id: string): boolean {
    const deps = this.getDependencies();
    const filtered = deps.filter(d => d.id !== id);
    if (filtered.length === deps.length) return false;

    if (this.isBrowser()) {
      localStorage.setItem(DEPS_STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return true;
  }

  // ==========================================
  // INCIDENTS
  // ==========================================
  public getIncidents(): Incident[] {
    if (!this.isBrowser()) return DEMO_INCIDENTS;
    const stored = localStorage.getItem(INCIDENTS_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(DEMO_INCIDENTS));
      return DEMO_INCIDENTS;
    }
    try {
      const parsed: Incident[] = JSON.parse(stored);
      // Re-hydrate targetAsset from assets list if needed
      const assets = this.getAssets();
      return parsed.map(inc => ({
        ...inc,
        targetAsset: inc.targetAsset || assets.find(a => a.id === inc.targetAssetId)
      }));
    } catch {
      return DEMO_INCIDENTS;
    }
  }

  public getIncidentById(id: string): Incident | undefined {
    const incidents = this.getIncidents();
    return incidents.find(i => i.id === id || i.ticketNumber === id);
  }

  public createIncident(incidentData: Omit<Incident, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'>): Incident {
    const incidents = this.getIncidents();
    const count = incidents.length + 1;
    const pad = String(840 + count).padStart(4, '0');
    const ticketNumber = `INC-2026-${pad}`;

    const created: Incident = {
      ...incidentData,
      id: `inc-${Date.now()}`,
      ticketNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: incidentData.isDemo || false,
    };

    // Initialize session via deterministic DiagnosticEngine if empty or requested
    if (!created.session || created.session.steps.length === 0) {
      const allAssets = this.getAssets();
      const targetAsset = created.targetAsset || allAssets.find(a => a.id === created.targetAssetId);
      const deps = this.getDependencies()
        .filter(d => d.sourceAssetId === targetAsset?.id)
        .map(d => allAssets.find(a => a.id === d.targetAssetId))
        .filter(Boolean) as Asset[];

      created.session = DiagnosticEngine.initializeSession(created, targetAsset, deps);
    }

    incidents.unshift(created);
    if (this.isBrowser()) {
      localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(incidents));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return created;
  }

  public updateIncident(id: string, updates: Partial<Incident>): Incident | undefined {
    const incidents = this.getIncidents();
    const index = incidents.findIndex(i => i.id === id || i.ticketNumber === id);
    if (index === -1) return undefined;

    incidents[index] = {
      ...incidents[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (this.isBrowser()) {
      localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(incidents));
      window.dispatchEvent(new Event('fixflow-data-changed'));
    }
    return incidents[index];
  }

  public recordStepResult(
    incidentId: string,
    stepId: string,
    outcome: StepOutcome,
    notes?: string,
    rawOutput?: string
  ): Incident | undefined {
    const incident = this.getIncidentById(incidentId);
    if (!incident || !incident.session) return undefined;

    const allAssets = this.getAssets();
    const targetAsset = incident.targetAsset || allAssets.find(a => a.id === incident.targetAssetId);
    const deps = this.getDependencies()
      .filter(d => d.sourceAssetId === targetAsset?.id)
      .map(d => allAssets.find(a => a.id === d.targetAssetId))
      .filter(Boolean) as Asset[];

    // Branch execution by active diagnostic mode
    let session = incident.session;
    let isFinished = false;
    let stopReason: string | undefined;
    let report: any;

    if (incident.diagnosticMode === 'AGENT') {
      const agentResult = AgentEngine.executeStepAndRevisePlan(
        session,
        incident,
        stepId,
        outcome,
        rawOutput || '',
        notes || '',
        targetAsset,
        deps,
        incident.isDemo || false
      );
      session = agentResult.session;
      isFinished = agentResult.isFinished;
      stopReason = agentResult.stopReason;
      report = agentResult.report;
    } else {
      const result = DiagnosticEngine.recordStepResult(
        session,
        incident,
        stepId,
        outcome,
        rawOutput || '',
        notes || '',
        targetAsset,
        deps,
        incident.isDemo || false
      );
      session = result.session;
      isFinished = result.isFinished;
      stopReason = result.stopReason;
      report = result.report;
    }

    const updates: Partial<Incident> = {
      session,
      status: isFinished && stopReason === 'ROOT_CAUSE_IDENTIFIED'
        ? 'ROOT_CAUSE_IDENTIFIED'
        : incident.status,
    };

    if (report) {
      updates.report = report;
    }

    return this.updateIncident(incident.id, updates);
  }

  public switchDiagnosticMode(incidentId: string, mode: DiagnosticMode): Incident | undefined {
    const incident = this.getIncidentById(incidentId);
    if (!incident || !incident.session) return undefined;

    const allAssets = this.getAssets();
    const targetAsset = incident.targetAsset || allAssets.find(a => a.id === incident.targetAssetId);
    const deps = this.getDependencies()
      .filter(d => d.sourceAssetId === targetAsset?.id)
      .map(d => allAssets.find(a => a.id === d.targetAssetId))
      .filter(Boolean) as Asset[];

    const switchedSession = AgentEngine.switchMode(incident.session, mode, targetAsset, deps);
    return this.updateIncident(incident.id, {
      diagnosticMode: mode,
      session: switchedSession,
    });
  }

  public escalateIncident(incidentId: string, reason: string, notes?: string): Incident | undefined {
    const incident = this.getIncidentById(incidentId);
    if (!incident || !incident.session) return undefined;

    const { session } = GuidedAdapter.escalateSession(incident.session, reason, notes);
    return this.updateIncident(incident.id, {
      status: 'INVESTIGATING',
      session,
    });
  }

  public reopenIncident(incidentId: string, _notes?: string): Incident | undefined {
    const incident = this.getIncidentById(incidentId);
    if (!incident) return undefined;

    let session = incident.session;
    if (session) {
      session = {
        ...session,
        status: 'ACTIVE',
        sessionStatus: 'ACTIVE',
        stopReason: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return this.updateIncident(incident.id, {
      status: 'INVESTIGATING',
      session,
    });
  }

  public resolveIncident(incidentId: string, resolutionNotes: string, signOffOperator?: string): Incident | undefined {
    const incident = this.getIncidentById(incidentId);
    if (!incident) return undefined;

    const now = new Date().toISOString();
    let session = incident.session;
    if (session) {
      session = {
        ...session,
        status: 'RESOLVED',
        sessionStatus: 'RESOLVED',
        updatedAt: now,
      };
    }

    let report = incident.report;
    if (report) {
      report = {
        ...report,
        confirmedRootCause: resolutionNotes || report.confirmedRootCause,
        signOffOperator: signOffOperator || report.signOffOperator,
        updatedAt: now,
      };
    }

    return this.updateIncident(incident.id, {
      status: 'RESOLVED',
      resolutionNotes,
      session,
      report,
    });
  }

  public getRelatedDependencies(assetId: string): {
    targetAsset?: Asset;
    upstream: Array<{ relationship: AssetDependency; asset: Asset }>;
    downstream: Array<{ relationship: AssetDependency; asset: Asset }>;
  } {
    const assets = this.getAssets();
    const targetAsset = assets.find(a => a.id === assetId);
    const allDeps = this.getDependencies();

    const upstream: Array<{ relationship: AssetDependency; asset: Asset }> = [];
    const downstream: Array<{ relationship: AssetDependency; asset: Asset }> = [];

    allDeps.forEach(dep => {
      if (dep.sourceAssetId === assetId) {
        const related = assets.find(a => a.id === dep.targetAssetId);
        if (related) {
          downstream.push({ relationship: dep, asset: related });
        }
      } else if (dep.targetAssetId === assetId) {
        const related = assets.find(a => a.id === dep.sourceAssetId);
        if (related) {
          upstream.push({ relationship: dep, asset: related });
        }
      }
    });

    return {
      targetAsset,
      upstream: upstream.slice(0, 5),
      downstream: downstream.slice(0, 5),
    };
  }

  public searchAndFilterIncidents(criteria: {
    searchTerm?: string;
    status?: string;
    severity?: string;
    assetId?: string;
    dateRange?: string;
  }): Incident[] {
    const incidents = this.getIncidents();
    const { searchTerm = '', status = 'ALL', severity = 'ALL', assetId = 'ALL', dateRange = 'ALL' } = criteria;
    const term = searchTerm.toLowerCase().trim();

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return incidents.filter(inc => {
      if (term) {
        const matchesTerm =
          inc.ticketNumber.toLowerCase().includes(term) ||
          inc.title.toLowerCase().includes(term) ||
          inc.category.toLowerCase().includes(term) ||
          (inc.rawDescription && inc.rawDescription.toLowerCase().includes(term)) ||
          (inc.targetAsset && inc.targetAsset.assetTag.toLowerCase().includes(term)) ||
          (inc.targetAsset && inc.targetAsset.hostname && inc.targetAsset.hostname.toLowerCase().includes(term));
        if (!matchesTerm) return false;
      }

      if (status !== 'ALL' && inc.status !== status) {
        return false;
      }

      if (severity !== 'ALL' && inc.severity !== severity) {
        return false;
      }

      if (assetId !== 'ALL' && inc.targetAssetId !== assetId && inc.targetAsset?.id !== assetId) {
        return false;
      }

      if (dateRange !== 'ALL') {
        const incTime = new Date(inc.createdAt).getTime();
        const diff = now - incTime;
        if (dateRange === 'TODAY' && diff > oneDay) {
          return false;
        } else if (dateRange === '7DAYS' && diff > 7 * oneDay) {
          return false;
        } else if (dateRange === '30DAYS' && diff > 30 * oneDay) {
          return false;
        }
      }

      return true;
    });
  }
}

export const repository = new DataRepository();
