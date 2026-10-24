// src/app/dependency-map/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  Filter,
  ExternalLink,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/NotificationToast';

// Custom Node Component for React Flow
function AssetNode({ data }: { data: { asset: any; isSelected: boolean } }) {
  const asset = data.asset;
  const isSelected = data.isSelected;

  return (
    <div
      className={`w-56 p-3 rounded-lg border text-left shadow-lg transition-all ${
        isSelected
          ? 'bg-slate-850 border-cyan-400 ring-2 ring-cyan-500/50'
          : 'bg-slate-900 border-slate-700/80 hover:border-slate-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-xs font-bold text-cyan-400">{asset.assetTag}</span>
        {asset.status === 'OPERATIONAL' && <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-950" />}
        {asset.status === 'DEGRADED' && <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-950" />}
        {asset.status === 'OFFLINE' && <span className="w-2 h-2 rounded-full bg-rose-400 ring-2 ring-rose-950" />}
      </div>

      <div className="text-[11px] font-semibold text-slate-200 line-clamp-1">{asset.name}</div>
      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{asset.ipAddress || asset.hostname || 'No IP'}</div>

      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span>{asset.assetType}</span>
        <span className="text-cyan-500 font-medium">{asset.criticality?.replace('TIER_', 'T')}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  assetNode: AssetNode,
};

export default function DependencyMapPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('ast-103'); // default select FS-CORP-01
  const [relFilter, setRelFilter] = useState<string>('ALL');

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assetRes, relRes] = await Promise.all([
        fetch('/api/assets?workspaceId=ws-default'),
        fetch('/api/relationships?workspaceId=ws-default'),
      ]);

      const assetData = await assetRes.json();
      const relData = await relRes.json();

      if (assetData.success && Array.isArray(assetData.assets)) {
        setAssets(assetData.assets);
      }
      if (relData.success && Array.isArray(relData.relationships)) {
        setRelationships(relData.relationships);
      }
    } catch (err: any) {
      toast({ title: 'Fetch Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Layout Positions deterministically
  const initialNodes: Node[] = useMemo(() => {
    const columns: Record<string, any[]> = {
      endpoints: [],
      network: [],
      compute: [],
      infra: [],
      disconnected: [],
    };

    // Track connected asset IDs
    const connectedAssetIds = new Set<string>();
    relationships.forEach(r => {
      connectedAssetIds.add(r.sourceAssetId);
      connectedAssetIds.add(r.targetAssetId);
    });

    assets.forEach(a => {
      if (!connectedAssetIds.has(a.id)) {
        columns.disconnected.push(a);
      } else if (a.assetType === 'LAPTOP' || a.assetType === 'WORKSTATION' || a.assetType === 'PRINTER') {
        columns.endpoints.push(a);
      } else if (a.assetType === 'FIREWALL' || a.assetType === 'SWITCH' || a.assetType === 'ROUTER') {
        columns.network.push(a);
      } else if (a.assetType === 'VIRTUAL_MACHINE' || a.assetType === 'SERVICE' || a.assetType === 'APPLICATION' || a.assetType === 'SHARED_FOLDER') {
        columns.compute.push(a);
      } else {
        columns.infra.push(a);
      }
    });

    const nodes: Node[] = [];

    const placeCol = (colAssets: any[], xOffset: number, yStart = 40) => {
      colAssets.forEach((asset, idx) => {
        nodes.push({
          id: asset.id,
          type: 'assetNode',
          position: { x: xOffset, y: idx * 130 + yStart },
          data: {
            asset,
            isSelected: asset.id === selectedAssetId,
          },
        });
      });
    };

    placeCol(columns.endpoints, 50);
    placeCol(columns.network, 360);
    placeCol(columns.compute, 670);
    placeCol(columns.infra, 980);
    placeCol(columns.disconnected, 1290, 40);

    return nodes;
  }, [assets, relationships, selectedAssetId]);

  const initialEdges: Edge[] = useMemo(() => {
    return relationships
      .filter(dep => relFilter === 'ALL' || dep.relationshipType === relFilter)
      .map(dep => {
        const isHighlight =
          selectedAssetId && (dep.sourceAssetId === selectedAssetId || dep.targetAssetId === selectedAssetId);
        const isAiSuggested = dep.provenance === 'AI_SUGGESTED';

        // Color coding: Cyan for confirmed, Amber for AI-suggested
        const edgeColor = isAiSuggested ? '#F59E0B' : isHighlight ? '#22D3EE' : '#64748B';

        return {
          id: dep.id,
          source: dep.sourceAssetId,
          target: dep.targetAssetId,
          label: `${dep.relationshipType.replace(/_/g, ' ')}${isAiSuggested ? ' [AI]' : ''}`,
          animated: isAiSuggested || isHighlight ? true : false,
          style: {
            stroke: edgeColor,
            strokeWidth: isHighlight ? 2.5 : 1.5,
            strokeDasharray: isAiSuggested ? '5,5' : undefined,
          },
          labelStyle: {
            fill: edgeColor,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: 'monospace',
          },
          labelBgStyle: {
            fill: '#0F172A',
            fillOpacity: 0.95,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        };
      });
  }, [relationships, selectedAssetId, relFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  // Relationships attached to selected node
  const selectedNodeRels = useMemo(() => {
    if (!selectedAssetId) return [];
    return relationships.filter(
      r => r.sourceAssetId === selectedAssetId || r.targetAssetId === selectedAssetId
    );
  }, [relationships, selectedAssetId]);

  const handleConfirmSuggested = async (relId: string) => {
    try {
      const res = await fetch(`/api/relationships/${relId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provenance: 'USER_CONFIRMED' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast({
        title: 'Relationship Confirmed',
        message: 'Promoted AI suggestion to user-confirmed in persistent topology.',
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Confirmation Error', message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Infrastructure Dependency Map</h1>
            <Badge variant="cyan" size="sm">{relationships.length} Persistent Links</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive topology rendering confirmed routes and AI-suggested candidate dependencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter Edge:</span>
            <select
              value={relFilter}
              onChange={e => setRelFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Relationships</option>
              <option value="DEPENDS_ON">DEPENDS_ON</option>
              <option value="HOSTED_ON">HOSTED_ON</option>
              <option value="CONNECTED_TO">CONNECTED_TO</option>
              <option value="MANAGED_BY">MANAGED_BY</option>
              <option value="PROVIDES_SERVICE_TO">PROVIDES_SERVICE_TO</option>
              <option value="SHARES_DATA_WITH">SHARES_DATA_WITH</option>
            </select>
          </div>

          <Link href="/assets">
            <Button variant="secondary" size="sm" leftIcon={<Server className="w-3.5 h-3.5" />}>
              Inventory
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Graph Area & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Interactive React Flow Canvas (3 cols) */}
        <div className="lg:col-span-3 h-[620px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative shadow-inner">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Loading infrastructure graph from SQLite...</span>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedAssetId(node.id)}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#1E293B" gap={20} size={1} />
              <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300 fill-slate-300" />
              <MiniMap
                nodeColor="#38BDF8"
                maskColor="rgba(11, 15, 23, 0.85)"
                className="!bg-slate-950 !border-slate-800 rounded-lg overflow-hidden"
              />
            </ReactFlow>
          )}

          {/* Canvas Floating Legend */}
          <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 backdrop-blur pointer-events-none flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400" />
              <span className="text-slate-300 font-medium">User Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 border-b border-dashed border-amber-400" />
              <span className="text-amber-400 font-medium">AI Suggested</span>
            </div>
          </div>
        </div>

        {/* Selected Node Inspector Sidebar (1 col) */}
        <div className="space-y-4">
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div>
                <CardTitle className="text-cyan-300 font-mono text-sm">
                  {selectedAsset ? selectedAsset.assetTag : 'Topology Inspector'}
                </CardTitle>
                <CardDescription>
                  {selectedAsset ? selectedAsset.name : 'Select a node in the graph'}
                </CardDescription>
              </div>
            </CardHeader>

            {selectedAsset ? (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <Badge variant={selectedAsset.status === 'OPERATIONAL' ? 'emerald' : 'amber'} size="sm">
                      {selectedAsset.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Asset Type</span>
                    <span className="text-slate-200">{selectedAsset.assetType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">IP Address</span>
                    <span className="font-mono text-cyan-400 font-bold">{selectedAsset.ipAddress || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Location</span>
                    <span className="text-slate-300 line-clamp-1">{selectedAsset.location || '—'}</span>
                  </div>
                </div>

                {/* Connected Relationships with Confirm button for AI suggestions */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Attached Topology Links ({selectedNodeRels.length}):
                  </h4>
                  {selectedNodeRels.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950 rounded border border-slate-900">
                      Disconnected asset. No links registered.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedNodeRels.map(rel => {
                        const isSource = rel.sourceAssetId === selectedAsset.id;
                        const otherAsset = isSource ? rel.targetAsset : rel.sourceAsset;
                        const isAi = rel.provenance === 'AI_SUGGESTED';

                        return (
                          <div
                            key={rel.id}
                            className={`p-2.5 rounded border text-[11px] space-y-1.5 ${
                              isAi ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant={isAi ? 'amber' : 'cyan'} size="sm">
                                {rel.relationshipType}
                              </Badge>
                              {isAi && <Badge variant="amber" size="sm">AI Suggested</Badge>}
                            </div>

                            <div className="text-slate-300">
                              <span className="text-slate-500 font-mono">{isSource ? '$\rightarrow$' : '$\leftarrow$'}</span>{' '}
                              <strong className="text-cyan-400 font-mono">{otherAsset?.assetTag || 'Asset'}</strong>
                              <span className="text-slate-400 text-[10px] block line-clamp-1">{otherAsset?.name}</span>
                            </div>

                            {isAi && (
                              <Button
                                variant="cyan"
                                size="sm"
                                className="w-full mt-1 h-7 text-[10px]"
                                leftIcon={<CheckCircle2 className="w-3 h-3" />}
                                onClick={() => handleConfirmSuggested(rel.id)}
                              >
                                Confirm AI Link
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex gap-2">
                  <Link href={`/assets/${selectedAsset.id}`} className="w-full">
                    <Button variant="secondary" size="sm" className="w-full" rightIcon={<ExternalLink className="w-3 h-3" />}>
                      Details
                    </Button>
                  </Link>
                  <Link href={`/incident/new?asset=${selectedAsset.id}`} className="w-full">
                    <Button variant="cyan" size="sm" className="w-full">
                      Triage
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 p-4 text-center">
                Click any node on the left canvas to view its topology connections and properties.
              </p>
            )}
          </Card>

          {/* Relationship Legend */}
          <Card className="bg-slate-950/60 border-slate-800 text-[11px] space-y-2">
            <h4 className="font-semibold text-slate-300 text-xs">Relationship Taxonomy</h4>
            <div className="space-y-1.5 text-slate-400 text-[10px]">
              <div><strong className="text-slate-300 font-mono">DEPENDS_ON</strong>: Upstream functional dependency</div>
              <div><strong className="text-slate-300 font-mono">HOSTED_ON</strong>: VM hypervisor or container host</div>
              <div><strong className="text-slate-300 font-mono">CONNECTED_TO</strong>: Network cable or switch port</div>
              <div><strong className="text-slate-300 font-mono">MANAGED_BY</strong>: Centralized management server</div>
              <div><strong className="text-slate-300 font-mono">PROVIDES_SERVICE_TO</strong>: DNS/Auth/Proxy provider</div>
              <div><strong className="text-slate-300 font-mono">SHARES_DATA_WITH</strong>: Storage/replication partner</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
