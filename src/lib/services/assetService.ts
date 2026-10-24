// src/lib/services/assetService.ts
import { prisma } from '../db/prisma';
import {
  AssetCreateSchema,
  AssetUpdateSchema,
  RelationshipCreateSchema,
  RelationshipUpdateSchema,
} from '../validation/assetSchemas';

export interface AssetFilterOptions {
  search?: string;
  type?: string;
  status?: string;
  criticality?: string;
}

export class AssetService {
  /**
   * Get all assets for a workspace with optional search and filters
   */
  public static async getAssets(workspaceId = 'ws-default', filters?: AssetFilterOptions) {
    const where: any = { workspaceId };

    if (filters?.type && filters.type !== 'ALL') {
      where.assetType = filters.type;
    }

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters?.criticality && filters.criticality !== 'ALL') {
      where.criticality = filters.criticality;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { assetTag: { contains: q } },
        { name: { contains: q } },
        { hostname: { contains: q } },
        { ipAddress: { contains: q } },
        { operatingSystem: { contains: q } },
        { location: { contains: q } },
      ];
    }

    return await prisma.asset.findMany({
      where,
      orderBy: [{ criticality: 'asc' }, { assetTag: 'asc' }],
      include: {
        outgoingRels: {
          include: {
            targetAsset: { select: { id: true, assetTag: true, name: true, assetType: true, status: true } },
          },
        },
        incomingRels: {
          include: {
            sourceAsset: { select: { id: true, assetTag: true, name: true, assetType: true, status: true } },
          },
        },
      },
    });
  }

  /**
   * Get a single asset by ID or Tag scoped to workspace
   */
  public static async getAssetById(idOrTag: string, workspaceId = 'ws-default') {
    return await prisma.asset.findFirst({
      where: {
        workspaceId,
        OR: [{ id: idOrTag }, { assetTag: idOrTag.toUpperCase() }],
      },
      include: {
        outgoingRels: {
          include: {
            targetAsset: true,
          },
        },
        incomingRels: {
          include: {
            sourceAsset: true,
          },
        },
        incidentLinks: {
          include: {
            incident: true,
          },
        },
      },
    });
  }

  /**
   * Create an asset with Zod validation and duplicate prevention
   */
  public static async createAsset(input: any, workspaceId = 'ws-default') {
    const validated = AssetCreateSchema.parse({ ...input, workspaceId });

    // Check duplicate asset tag in workspace
    const existing = await prisma.asset.findUnique({
      where: {
        workspaceId_assetTag: {
          workspaceId,
          assetTag: validated.assetTag,
        },
      },
    });

    if (existing) {
      throw new Error(`Asset with tag '${validated.assetTag}' already exists in this workspace.`);
    }

    return await prisma.asset.create({
      data: validated,
    });
  }

  /**
   * Update an asset with Zod validation
   */
  public static async updateAsset(id: string, input: any, workspaceId = 'ws-default') {
    const validated = AssetUpdateSchema.parse(input);

    const asset = await prisma.asset.findFirst({
      where: { id, workspaceId },
    });

    if (!asset) {
      throw new Error(`Asset not found or does not belong to workspace '${workspaceId}'.`);
    }

    return await prisma.asset.update({
      where: { id },
      data: validated,
    });
  }

  /**
   * Delete an asset with cascading relationship cleanup
   */
  public static async deleteAsset(id: string, workspaceId = 'ws-default') {
    const asset = await prisma.asset.findFirst({
      where: { id, workspaceId },
    });

    if (!asset) {
      throw new Error(`Asset not found in workspace.`);
    }

    return await prisma.asset.delete({
      where: { id },
    });
  }

  /**
   * Get all relationships for a workspace
   */
  public static async getRelationships(workspaceId = 'ws-default', filterType?: string) {
    const where: any = { workspaceId };
    if (filterType && filterType !== 'ALL') {
      where.relationshipType = filterType;
    }

    return await prisma.assetRelationship.findMany({
      where,
      include: {
        sourceAsset: { select: { id: true, assetTag: true, name: true, assetType: true, ipAddress: true, status: true, criticality: true } },
        targetAsset: { select: { id: true, assetTag: true, name: true, assetType: true, ipAddress: true, status: true, criticality: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create relationship with validation:
   * 1. Validate Zod schema
   * 2. Ensure both assets exist in same workspace
   * 3. Prevent self-links
   * 4. Prevent duplicate relationships
   */
  public static async createRelationship(input: any, workspaceId = 'ws-default') {
    const validated = RelationshipCreateSchema.parse({ ...input, workspaceId });

    // Validate both assets exist in workspace
    const [sourceAsset, targetAsset] = await Promise.all([
      prisma.asset.findFirst({ where: { id: validated.sourceAssetId, workspaceId } }),
      prisma.asset.findFirst({ where: { id: validated.targetAssetId, workspaceId } }),
    ]);

    if (!sourceAsset) {
      throw new Error(`Source asset '${validated.sourceAssetId}' does not exist in workspace.`);
    }
    if (!targetAsset) {
      throw new Error(`Target asset '${validated.targetAssetId}' does not exist in workspace.`);
    }

    // Check duplicate relationship
    const existing = await prisma.assetRelationship.findUnique({
      where: {
        workspaceId_sourceAssetId_targetAssetId_relationshipType: {
          workspaceId,
          sourceAssetId: validated.sourceAssetId,
          targetAssetId: validated.targetAssetId,
          relationshipType: validated.relationshipType,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Relationship '${validated.relationshipType}' between '${sourceAsset.assetTag}' and '${targetAsset.assetTag}' already exists.`
      );
    }

    return await prisma.assetRelationship.create({
      data: validated,
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  /**
   * Update relationship (e.g. confirm AI-suggested relationship)
   */
  public static async updateRelationship(id: string, input: any, workspaceId = 'ws-default') {
    const validated = RelationshipUpdateSchema.parse(input);

    const rel = await prisma.assetRelationship.findFirst({
      where: { id, workspaceId },
    });

    if (!rel) {
      throw new Error(`Relationship not found in workspace.`);
    }

    return await prisma.assetRelationship.update({
      where: { id },
      data: validated,
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  /**
   * Delete a relationship
   */
  public static async deleteRelationship(id: string, workspaceId = 'ws-default') {
    const rel = await prisma.assetRelationship.findFirst({
      where: { id, workspaceId },
    });

    if (!rel) {
      throw new Error(`Relationship not found in workspace.`);
    }

    return await prisma.assetRelationship.delete({
      where: { id },
    });
  }

  /**
   * Commit CSV import batch with duplicate handling:
   * onDuplicate = 'skip' (default safe mode): skips existing assets without overwriting.
   * onDuplicate = 'update': updates existing assets with user's explicit confirmation.
   */
  public static async commitCsvImport(
    workspaceId = 'ws-default',
    rowsToCommit: any[],
    options: { onDuplicate: 'skip' | 'update' } = { onDuplicate: 'skip' }
  ) {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rowsToCommit) {
      const candidate = { ...row, workspaceId };
      const validated = AssetCreateSchema.parse(candidate);

      const existing = await prisma.asset.findUnique({
        where: {
          workspaceId_assetTag: {
            workspaceId,
            assetTag: validated.assetTag,
          },
        },
      });

      if (existing) {
        if (options.onDuplicate === 'update') {
          await prisma.asset.update({
            where: { id: existing.id },
            data: validated,
          });
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        await prisma.asset.create({
          data: validated,
        });
        createdCount++;
      }
    }

    return { createdCount, updatedCount, skippedCount };
  }
}
