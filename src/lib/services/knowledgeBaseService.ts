// src/lib/services/knowledgeBaseService.ts
import { prisma } from '../db/prisma';
import {
  KnowledgeArticleDTO,
} from '@/types/knowledgeBase';
import {
  KnowledgeArticleCreateSchema,
  KnowledgeArticleUpdateSchema,
  KnowledgeArticleOutcomeReportSchema,
} from '../validation/knowledgeBaseSchemas';
import { KnowledgeSearchService } from './knowledgeSearchService';

export interface ArticleFilterOptions {
  search?: string;
  category?: string;
  status?: string;
  assetType?: string;
  confidenceBasis?: string;
}

export class KnowledgeBaseService {
  /**
   * Helper to map Prisma entity to DTO
   */
  private static toDTO(article: any): KnowledgeArticleDTO {
    const totalUses = (article.successCount || 0) + (article.failureCount || 0);
    return {
      id: article.id,
      workspaceId: article.workspaceId,
      title: article.title,
      normalizedError: article.normalizedError,
      originalErrorDescription: article.originalErrorDescription,
      errorCode: article.errorCode,
      category: article.category,
      assetType: article.assetType,
      operatingSystem: article.operatingSystem,
      productOrService: article.productOrService,
      environmentNotes: article.environmentNotes,
      symptoms: JSON.parse(article.symptoms || '[]'),
      diagnosticSteps: JSON.parse(article.diagnosticSteps || '[]'),
      verifiedSolution: article.verifiedSolution,
      preventionNotes: article.preventionNotes,
      status: article.status,
      confidenceBasis: article.confidenceBasis,
      successCount: article.successCount,
      failureCount: article.failureCount,
      successRate: totalUses > 0 ? Math.round((article.successCount / totalUses) * 100) : null,
      createdBy: article.createdBy,
      verifiedBy: article.verifiedBy,
      lastUsedAt: article.lastUsedAt?.toISOString() || null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      linkedIncidentCount: article._count?.linkedIncidents || 0,
    };
  }

  /**
   * List knowledge articles with search and multi-criteria filtering
   */
  public static async getArticles(
    workspaceId = 'ws-default',
    filters?: ArticleFilterOptions
  ): Promise<KnowledgeArticleDTO[]> {
    const where: any = { workspaceId };

    if (filters?.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters?.assetType && filters.assetType !== 'ALL') {
      where.assetType = filters.assetType;
    }

    if (filters?.confidenceBasis && filters.confidenceBasis !== 'ALL') {
      where.confidenceBasis = filters.confidenceBasis;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q } },
        { normalizedError: { contains: q.toLowerCase() } },
        { originalErrorDescription: { contains: q } },
        { errorCode: { contains: q } },
        { productOrService: { contains: q } },
      ];
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ status: 'asc' }, { successCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return articles.map(this.toDTO);
  }

  /**
   * Get single article by ID
   */
  public static async getArticleById(id: string, workspaceId = 'ws-default'): Promise<KnowledgeArticleDTO | null> {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id, workspaceId },
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return article ? this.toDTO(article) : null;
  }

  /**
   * Create a new knowledge article
   */
  public static async createArticle(rawPayload: unknown, workspaceId = 'ws-default'): Promise<KnowledgeArticleDTO> {
    const data = KnowledgeArticleCreateSchema.parse({
      ...(rawPayload as any),
      workspaceId,
    });

    const normalizedError = KnowledgeSearchService.normalizeText(
      `${data.title} ${data.errorCode || ''} ${data.originalErrorDescription}`
    );

    const article = await prisma.knowledgeArticle.create({
      data: {
        workspaceId,
        title: data.title,
        normalizedError,
        originalErrorDescription: data.originalErrorDescription,
        errorCode: data.errorCode || null,
        category: data.category,
        assetType: data.assetType || null,
        operatingSystem: data.operatingSystem || null,
        productOrService: data.productOrService || null,
        environmentNotes: data.environmentNotes || null,
        symptoms: JSON.stringify(data.symptoms),
        diagnosticSteps: JSON.stringify(data.diagnosticSteps),
        verifiedSolution: data.verifiedSolution,
        preventionNotes: data.preventionNotes || null,
        status: data.status,
        confidenceBasis: data.confidenceBasis,
        createdBy: data.createdBy,
        verifiedBy: data.status === 'VERIFIED' ? data.verifiedBy || data.createdBy : null,
      },
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return this.toDTO(article);
  }

  /**
   * Update an existing article
   */
  public static async updateArticle(
    id: string,
    rawPayload: unknown,
    _workspaceId = 'ws-default'
  ): Promise<KnowledgeArticleDTO> {
    const data = KnowledgeArticleUpdateSchema.parse(rawPayload);

    const updateData: any = { ...data };

    if (data.title || data.originalErrorDescription || data.errorCode) {
      const existing = await prisma.knowledgeArticle.findUnique({ where: { id } });
      const title = data.title ?? existing?.title ?? '';
      const orig = data.originalErrorDescription ?? existing?.originalErrorDescription ?? '';
      const code = data.errorCode ?? existing?.errorCode ?? '';
      updateData.normalizedError = KnowledgeSearchService.normalizeText(`${title} ${code} ${orig}`);
    }

    if (data.symptoms) {
      updateData.symptoms = JSON.stringify(data.symptoms);
    }

    if (data.diagnosticSteps) {
      updateData.diagnosticSteps = JSON.stringify(data.diagnosticSteps);
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return this.toDTO(updated);
  }

  /**
   * Administrator verification workflow
   */
  public static async verifyArticle(
    id: string,
    verifiedBy = 'Senior Systems Administrator',
    _workspaceId = 'ws-default'
  ): Promise<KnowledgeArticleDTO> {
    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        confidenceBasis: 'ADMIN_VERIFIED',
        verifiedBy,
      },
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return this.toDTO(updated);
  }

  /**
   * Archive article (soft deprecate)
   */
  public static async archiveArticle(id: string, _workspaceId = 'ws-default'): Promise<KnowledgeArticleDTO> {
    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    return this.toDTO(updated);
  }

  /**
   * Record article application outcome from technician feedback
   */
  public static async recordOutcome(rawPayload: unknown): Promise<{
    success: boolean;
    article: KnowledgeArticleDTO;
    incidentId: string;
    outcome: string;
  }> {
    const data = KnowledgeArticleOutcomeReportSchema.parse(rawPayload);

    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: data.articleId },
    });

    if (!article) {
      throw new Error(`Knowledge article '${data.articleId}' not found.`);
    }

    // Increment success or failure count
    const isSuccess = data.outcome === 'ACCEPTED';
    const isFailure = data.outcome === 'UNSUCCESSFUL';

    const updatedArticle = await prisma.knowledgeArticle.update({
      where: { id: data.articleId },
      data: {
        successCount: isSuccess ? { increment: 1 } : undefined,
        failureCount: isFailure ? { increment: 1 } : undefined,
        lastUsedAt: new Date(),
      },
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    // Link outcome to incident record
    if (data.incidentId) {
      const existing = await prisma.incident.findUnique({
        where: { id: data.incidentId },
        select: { id: true },
      });
      if (existing) {
        await prisma.incident.update({
          where: { id: data.incidentId },
          data: {
            appliedArticleId: data.articleId,
            articleOutcome: data.outcome,
            status: isSuccess ? 'RESOLVED' : undefined,
            resolutionNotes: isSuccess
              ? `Successfully resolved using verified local knowledge solution: '${article.title}'.`
              : undefined,
          },
        }).catch(() => {});
      }
    }

    return {
      success: true,
      article: this.toDTO(updatedArticle),
      incidentId: data.incidentId,
      outcome: data.outcome,
    };
  }

  /**
   * Returns aggregated statistics for the knowledge base
   */
  public static async getKnowledgeStats(workspaceId = 'ws-default') {
    const articles = await prisma.knowledgeArticle.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        successCount: true,
        failureCount: true,
        category: true,
      },
    });

    let verified = 0;
    let draft = 0;
    let archived = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    for (const a of articles) {
      if (a.status === 'VERIFIED') verified++;
      else if (a.status === 'DRAFT') draft++;
      else if (a.status === 'ARCHIVED') archived++;

      totalSuccesses += a.successCount;
      totalFailures += a.failureCount;
    }

    const totalUses = totalSuccesses + totalFailures;
    const globalSuccessRate = totalUses > 0 ? Math.round((totalSuccesses / totalUses) * 100) : null;

    // Top reused solutions
    const mostReused = [...articles]
      .filter(a => a.successCount > 0)
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        successCount: a.successCount,
        failureCount: a.failureCount,
      }));

    // Solutions with high failure rate (at least 2 failures)
    const highFailure = [...articles]
      .filter(a => a.failureCount >= 2)
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        successCount: a.successCount,
        failureCount: a.failureCount,
      }));

    return {
      totalArticles: articles.length,
      verifiedCount: verified,
      draftCount: draft,
      archivedCount: archived,
      totalSuccessReuses: totalSuccesses,
      totalFailureOutcomes: totalFailures,
      globalSuccessRate,
      mostReused,
      highFailure,
    };
  }
}
