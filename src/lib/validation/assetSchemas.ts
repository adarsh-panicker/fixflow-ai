// src/lib/validation/assetSchemas.ts
import { z } from 'zod';

export const ASSET_TYPES = [
  'SERVER',
  'WORKSTATION',
  'LAPTOP',
  'ROUTER',
  'SWITCH',
  'FIREWALL',
  'PRINTER',
  'APPLICATION',
  'SERVICE',
  'VIRTUAL_MACHINE',
  'STORAGE',
  'SHARED_FOLDER',
] as const;

export const ASSET_CRITICALITIES = [
  'TIER_1_CRITICAL',
  'TIER_2_HIGH',
  'TIER_3_MEDIUM',
  'TIER_4_LOW',
] as const;

export const ASSET_STATUSES = [
  'OPERATIONAL',
  'DEGRADED',
  'OFFLINE',
  'MAINTENANCE',
] as const;

export const RELATIONSHIP_TYPES = [
  'DEPENDS_ON',
  'HOSTED_ON',
  'CONNECTED_TO',
  'MANAGED_BY',
  'PROVIDES_SERVICE_TO',
  'SHARES_DATA_WITH',
] as const;

export const RELATIONSHIP_PROVENANCE = [
  'USER_CONFIRMED',
  'AI_SUGGESTED',
] as const;

export function isValidIpv4OrCidr(val: string): boolean {
  if (!val) return true;
  const [ip, cidr] = val.split('/');
  if (cidr !== undefined) {
    const cidrNum = Number(cidr);
    if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32 || String(cidrNum) !== cidr) {
      return false;
    }
  }
  const octets = ip.split('.');
  if (octets.length !== 4) return false;
  return octets.every(octet => {
    if (!/^\d{1,3}$/.test(octet)) return false;
    const num = Number(octet);
    return num >= 0 && num <= 255 && String(num) === octet;
  });
}

const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const AssetCreateSchema = z.object({
  workspaceId: z.string().default('ws-default'),
  assetTag: z
    .string()
    .min(2, 'Asset Tag must be at least 2 characters')
    .max(50, 'Asset Tag must not exceed 50 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Asset Tag can only contain letters, numbers, hyphens, dots, and underscores'),
  name: z
    .string()
    .min(2, 'Asset Name must be at least 2 characters')
    .max(100, 'Asset Name must not exceed 100 characters'),
  assetType: z.enum(ASSET_TYPES, {
    errorMap: () => ({ message: 'Invalid asset type. Supported types: ' + ASSET_TYPES.join(', ') }),
  }),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  hostname: z
    .string()
    .max(150)
    .refine(val => !val || hostnameRegex.test(val), { message: 'Invalid hostname format (e.g. srv01.corp.internal)' })
    .optional()
    .nullable(),
  ipAddress: z
    .string()
    .max(50)
    .refine(val => !val || isValidIpv4OrCidr(val), { message: 'Invalid IPv4 address or CIDR (e.g. 10.0.1.50 or 10.0.1.0/24)' })
    .optional()
    .nullable(),
  operatingSystem: z.string().max(100).optional().nullable(),
  location: z.string().max(150).optional().nullable(),
  owner: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  criticality: z.enum(ASSET_CRITICALITIES).default('TIER_3_MEDIUM'),
  status: z.enum(ASSET_STATUSES).default('OPERATIONAL'),
});

export const AssetUpdateSchema = AssetCreateSchema.partial().extend({
  id: z.string().optional(),
});

export const RelationshipCreateSchema = z
  .object({
    workspaceId: z.string().default('ws-default'),
    sourceAssetId: z.string().min(1, 'Source asset is required'),
    targetAssetId: z.string().min(1, 'Target asset is required'),
    relationshipType: z.enum(RELATIONSHIP_TYPES, {
      errorMap: () => ({ message: 'Invalid relationship type. Supported: ' + RELATIONSHIP_TYPES.join(', ') }),
    }),
    provenance: z.enum(RELATIONSHIP_PROVENANCE).default('USER_CONFIRMED'),
    description: z.string().max(500).optional().nullable(),
  })
  .refine(data => data.sourceAssetId !== data.targetAssetId, {
    message: 'Self-links are forbidden: source and target asset cannot be the same',
    path: ['targetAssetId'],
  });

export const RelationshipUpdateSchema = z.object({
  relationshipType: z.enum(RELATIONSHIP_TYPES).optional(),
  provenance: z.enum(RELATIONSHIP_PROVENANCE).optional(),
  description: z.string().max(500).optional().nullable(),
});

// CSV Raw Row Validation
export const CsvRowMappingSchema = z.object({
  assetTag: z.string().min(1),
  name: z.string().min(1),
  assetType: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  hostname: z.string().optional(),
  ipAddress: z.string().optional(),
  operatingSystem: z.string().optional(),
  location: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  criticality: z.string().optional(),
  status: z.string().optional(),
});
