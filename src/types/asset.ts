// src/types/asset.ts

export type AssetType =
  | 'SERVER'
  | 'VIRTUAL_MACHINE'
  | 'WORKSTATION'
  | 'LAPTOP'
  | 'NETWORK_DEVICE'
  | 'FIREWALL'
  | 'STORAGE'
  | 'SHARED_FOLDER'
  | 'DATABASE'
  | 'APPLICATION'
  | 'WINDOWS_SERVICE'
  | 'PRINTER'
  | 'OTHER';

export type AssetCriticality =
  | 'TIER_1_CRITICAL'
  | 'TIER_2_HIGH'
  | 'TIER_3_MEDIUM'
  | 'TIER_4_LOW';

export type AssetStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'MAINTENANCE';

export type DependencyType =
  | 'DEPENDS_ON'
  | 'HOSTED_ON'
  | 'CONNECTS_TO'
  | 'AUTHENTICATES_AGAINST'
  | 'ROUTES_THROUGH';

export interface AssetDependency {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: DependencyType;
  description?: string;
  targetAssetName?: string;
  targetAssetType?: AssetType;
}

export interface Asset {
  id: string;
  workspaceId?: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  manufacturer?: string | null;
  model?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  subnet?: string | null;
  operatingSystem?: string | null;
  location?: string | null;
  owner?: string | null;
  notes?: string | null;
  tags?: string | null;
  criticality: AssetCriticality;
  status: AssetStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  dependencies?: AssetDependency[];
}
