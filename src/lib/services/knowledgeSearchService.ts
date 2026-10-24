// src/lib/services/knowledgeSearchService.ts
import { prisma } from '../db/prisma';
import {
  KnowledgeArticleDTO,
  SearchMatchResult,
  LocalSearchResponse,
  DuplicateDetectionResult,
} from '@/types/knowledgeBase';

export interface SearchContextOptions {
  query: string;
  errorCode?: string | null;
  category?: string | null;
  assetType?: string | null;
  operatingSystem?: string | null;
  workspaceId?: string;
  verifiedOnly?: boolean;
  minThreshold?: number;
  ignoredArticleIds?: string[];
}

export class KnowledgeSearchService {
  /**
   * Normalizes text by removing non-alphanumeric punctuation, extra whitespace, and lowercasing
   */
  public static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenizes text into unique words with stopword filtration
   */
  public static tokenize(text: string): Set<string> {
    const STOPWORDS = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to',
      'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up',
      'down', 'it', 'its', 'this', 'that', 'these', 'those', 'then', 'so',
    ]);

    const words = this.normalizeText(text).split(' ');
    const tokens = new Set<string>();

    for (const w of words) {
      if (w.length > 2 && !STOPWORDS.has(w)) {
        tokens.add(w);
      }
    }
    return tokens;
  }

  /**
   * Calculates token Jaccard similarity score between 0 and 1
   */
  public static calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Extracts potential error codes (e.g. 0x80070035, EVENT_7000, NXDOMAIN, ECONNREFUSED)
   */
  public static extractErrorCode(text: string): string | null {
    // Hex errors like 0x80070035 or 0x80004005
    const hexMatch = text.match(/\b(0x[0-9a-fA-F]{4,8})\b/i);
    if (hexMatch) return hexMatch[1].toLowerCase();

    // Event log IDs like EVENT_7000 or Event 7000
    const eventMatch = text.match(/\b(?:event|eventid|event_id)[\s_:]*(\d{3,5})\b/i);
    if (eventMatch) return `event_${eventMatch[1]}`;

    // Common standard error codes
    const commonCodes = ['nxdomain', 'econnrefused', 'econnreset', 'etimedout', 'enotfound', 'access_denied'];
    const lower = text.toLowerCase();
    for (const code of commonCodes) {
      if (lower.includes(code)) return code.toUpperCase();
    }

    return null;
  }

  /**
   * Checks strict environment compatibility between the target asset and candidate article
   */
  public static checkCompatibility(
    article: { assetType?: string | null; operatingSystem?: string | null },
    target: { assetType?: string | null; operatingSystem?: string | null }
  ): { isCompatible: boolean; assetTypeMatch: boolean; osMatch: boolean; reason?: string } {
    let assetTypeMatch = true;
    let osMatch = true;

    // Asset type check: if both specified, check for strict conflict
    if (article.assetType && target.assetType) {
      const artType = article.assetType.toUpperCase();
      const tgtType = target.assetType.toUpperCase();
      // Allow general infrastructure overlap (e.g., SERVER vs STORAGE for file share)
      const isRelated =
        artType === tgtType ||
        (artType === 'SERVER' && tgtType === 'STORAGE') ||
        (artType === 'STORAGE' && tgtType === 'SERVER') ||
        (artType === 'ROUTER' && tgtType === 'SWITCH');

      if (!isRelated) {
        assetTypeMatch = false;
      }
    }

    // Operating System check: prevent Windows solutions on Linux, or Linux solutions on Windows
    if (article.operatingSystem && target.operatingSystem) {
      const artOs = article.operatingSystem.toLowerCase();
      const tgtOs = target.operatingSystem.toLowerCase();

      const isArtWindows = artOs.includes('win');
      const isTgtWindows = tgtOs.includes('win');
      const isArtLinux = artOs.includes('linux') || artOs.includes('ubuntu') || artOs.includes('rhel') || artOs.includes('debian');
      const isTgtLinux = tgtOs.includes('linux') || tgtOs.includes('ubuntu') || tgtOs.includes('rhel') || tgtOs.includes('debian');

      if ((isArtWindows && isTgtLinux) || (isArtLinux && isTgtWindows)) {
        osMatch = false;
        return {
          isCompatible: false,
          assetTypeMatch,
          osMatch: false,
          reason: `Incompatible OS environment: Target operates on '${target.operatingSystem}', while solution specifically targets '${article.operatingSystem}'.`,
        };
      }
    }

    // If asset types are completely disjoint (e.g. PRINTER vs FIREWALL)
    if (!assetTypeMatch) {
      return {
        isCompatible: false,
        assetTypeMatch: false,
        osMatch,
        reason: `Incompatible asset type: Target is '${target.assetType}', while solution specifically targets '${article.assetType}'.`,
      };
    }

    return {
      isCompatible: true,
      assetTypeMatch,
      osMatch,
    };
  }

  /**
   * Executes deterministic layered local knowledge search
   */
  public static async searchLocalKnowledge(options: SearchContextOptions): Promise<LocalSearchResponse> {
    const workspaceId = options.workspaceId || 'ws-default';
    const query = options.query.trim();
    const explicitErrorCode = options.errorCode?.trim() || this.extractErrorCode(query);
    const minThreshold = options.minThreshold ?? 45;
    const verifiedOnly = options.verifiedOnly ?? true;
    const ignoredIds = new Set(options.ignoredArticleIds || []);

    const where: any = { workspaceId };
    if (verifiedOnly) {
      where.status = 'VERIFIED';
    } else {
      where.status = { in: ['VERIFIED', 'DRAFT'] };
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      include: {
        _count: { select: { linkedIncidents: true } },
      },
    });

    if (articles.length === 0) {
      return {
        hasMatch: false,
        confidenceLevel: 'LOW',
        topMatch: null,
        candidateMatches: [],
        explanation: 'Local knowledge base is currently empty for this workspace.',
        suggestedAction: 'ESCALATE_TO_GEMINI',
      };
    }

    const queryNorm = this.normalizeText(query);
    const queryTokens = this.tokenize(query);
    const scoredMatches: SearchMatchResult[] = [];

    for (const a of articles) {
      if (ignoredIds.has(a.id)) continue;

      let score = 0;
      const matchReasons: string[] = [];

      // Check environment compatibility first
      const compat = this.checkCompatibility(
        { assetType: a.assetType, operatingSystem: a.operatingSystem },
        { assetType: options.assetType, operatingSystem: options.operatingSystem }
      );

      // Incompatible solutions are rejected or score-capped
      if (!compat.isCompatible) {
        continue;
      }

      // --- Layer A: Error Code Matching (+55 pts for exact match) ---
      let hasErrorCodeMatch = false;
      if (explicitErrorCode && a.errorCode) {
        const normArtCode = a.errorCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normQueryCode = explicitErrorCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normArtCode === normQueryCode) {
          score += 55;
          hasErrorCodeMatch = true;
          matchReasons.push(`Exact error code match: ${a.errorCode}`);
        } else if (normArtCode.includes(normQueryCode) || normQueryCode.includes(normArtCode)) {
          score += 45;
          hasErrorCodeMatch = true;
          matchReasons.push(`Partial error code match: ${a.errorCode}`);
        }
      }

      // --- Layer B: Exact or Substring Normalized Match (+35 pts) ---
      const artNorm = a.normalizedError;
      if (queryNorm === artNorm) {
        score += 35;
        matchReasons.push('Exact normalized problem statement match');
      } else if (queryNorm.includes(artNorm) || artNorm.includes(queryNorm)) {
        score += 25;
        matchReasons.push('Problem statement contains core normalized error string');
      }

      // --- Layer C: Title Keyword Coverage & Token Overlap (+ up to 35 pts) ---
      const titleTokens = this.tokenize(a.title);
      let titleOverlapCount = 0;
      for (const t of titleTokens) {
        if (queryTokens.has(t)) titleOverlapCount++;
      }
      const titleCoverage = titleTokens.size > 0 ? titleOverlapCount / titleTokens.size : 0;
      if (titleCoverage >= 0.35) {
        const titleScore = Math.min(25, Math.round(titleCoverage * 30));
        score += titleScore;
        matchReasons.push(`Title keyword coverage: ${Math.round(titleCoverage * 100)}%`);
      }

      const artTokens = this.tokenize(`${a.title} ${a.originalErrorDescription} ${a.symptoms} ${a.productOrService || ''}`);
      const jaccard = this.calculateJaccardSimilarity(queryTokens, artTokens);
      const tokenScore = Math.min(25, Math.round(jaccard * 50));
      if (tokenScore > 4) {
        score += tokenScore;
        matchReasons.push(`Symptom relevance score: ${Math.round(jaccard * 100)}%`);
      }

      // --- Layer D: Contextual Compatibility Bonuses ---
      if (options.assetType && a.assetType && options.assetType.toUpperCase() === a.assetType.toUpperCase()) {
        score += 10;
        matchReasons.push(`Asset type match: ${a.assetType}`);
      }

      if (options.operatingSystem && a.operatingSystem && options.operatingSystem.toLowerCase().includes(a.operatingSystem.toLowerCase())) {
        score += 8;
        matchReasons.push(`Operating system match: ${a.operatingSystem}`);
      }

      // Admin-verified bonus
      if (a.confidenceBasis === 'ADMIN_VERIFIED') {
        score += 5;
      }

      // Historical success rate bonus (up to +10 pts)
      const totalUses = a.successCount + a.failureCount;
      if (totalUses >= 3) {
        const successRatio = a.successCount / totalUses;
        if (successRatio >= 0.8) {
          score += 7;
          matchReasons.push(`High historical success rate: ${Math.round(successRatio * 100)}% (${a.successCount}/${totalUses} resolved)`);
        } else if (successRatio < 0.3) {
          score -= 10; // Penalize historically failing articles
        }
      }

      // Bound score 0 to 100
      const finalScore = Math.max(0, Math.min(100, score));

      if (finalScore >= minThreshold) {
        const confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' =
          finalScore >= 75 && a.status === 'VERIFIED'
            ? 'HIGH'
            : finalScore >= 45
            ? 'MODERATE'
            : 'LOW';

        const articleDTO: KnowledgeArticleDTO = {
          id: a.id,
          workspaceId: a.workspaceId,
          title: a.title,
          normalizedError: a.normalizedError,
          originalErrorDescription: a.originalErrorDescription,
          errorCode: a.errorCode,
          category: a.category,
          assetType: a.assetType,
          operatingSystem: a.operatingSystem,
          productOrService: a.productOrService,
          environmentNotes: a.environmentNotes,
          symptoms: JSON.parse(a.symptoms || '[]'),
          diagnosticSteps: JSON.parse(a.diagnosticSteps || '[]'),
          verifiedSolution: a.verifiedSolution,
          preventionNotes: a.preventionNotes,
          status: a.status as any,
          confidenceBasis: a.confidenceBasis as any,
          successCount: a.successCount,
          failureCount: a.failureCount,
          successRate: totalUses > 0 ? Math.round((a.successCount / totalUses) * 100) : null,
          createdBy: a.createdBy,
          verifiedBy: a.verifiedBy,
          lastUsedAt: a.lastUsedAt?.toISOString() || null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          linkedIncidentCount: a._count.linkedIncidents,
        };

        scoredMatches.push({
          article: articleDTO,
          score: finalScore,
          confidenceLevel,
          matchReasons,
          isCompatible: compat.isCompatible,
          compatibilityDetails: {
            assetTypeMatch: compat.assetTypeMatch,
            osMatch: compat.osMatch,
            errorCodeMatch: hasErrorCodeMatch,
          },
        });
      }
    }

    // Sort descending by score, then success count
    scoredMatches.sort((a, b) => b.score - a.score || b.article.successCount - a.article.successCount);

    const topMatch = scoredMatches.length > 0 ? scoredMatches[0] : null;

    if (topMatch && topMatch.confidenceLevel === 'HIGH') {
      return {
        hasMatch: true,
        confidenceLevel: 'HIGH',
        topMatch,
        candidateMatches: scoredMatches.slice(1, 4),
        explanation: `Found high-confidence verified local solution '${topMatch.article.title}' (${topMatch.score}% match). ${topMatch.matchReasons.join('. ')}.`,
        suggestedAction: 'PRESENT_LOCAL_SOLUTION',
      };
    } else if (topMatch && topMatch.confidenceLevel === 'MODERATE') {
      return {
        hasMatch: true,
        confidenceLevel: 'MODERATE',
        topMatch,
        candidateMatches: scoredMatches.slice(0, 3),
        explanation: `Found ${scoredMatches.length} candidate solution(s) with moderate symptom similarity (${topMatch.score}% match). Please confirm if symptoms match.`,
        suggestedAction: 'CONFIRM_CANDIDATE',
      };
    }

    return {
      hasMatch: false,
      confidenceLevel: 'LOW',
      topMatch: null,
      candidateMatches: [],
      explanation: 'No sufficiently relevant local verified knowledge article found. Escalating to Gemini AI troubleshooter.',
      suggestedAction: 'ESCALATE_TO_GEMINI',
    };
  }

  /**
   * Detects duplicate or near-identical articles before creating a new one
   */
  public static async detectDuplicates(params: {
    title: string;
    errorCode?: string | null;
    originalErrorDescription: string;
    symptoms?: string[];
    workspaceId?: string;
  }): Promise<DuplicateDetectionResult> {
    const workspaceId = params.workspaceId || 'ws-default';
    const articles = await prisma.knowledgeArticle.findMany({
      where: { workspaceId },
      include: { _count: { select: { linkedIncidents: true } } },
    });

    const newTokens = this.tokenize(`${params.title} ${params.originalErrorDescription}`);
    const newNorm = this.normalizeText(params.title);
    const newTitleTokens = this.tokenize(params.title);

    let highestScore = 0;
    let matchedArticle: any = null;

    for (const a of articles) {
      let score = 0;

      // Exact error code match
      if (params.errorCode && a.errorCode && params.errorCode.toLowerCase().replace(/[^a-z0-9]/g, '') === a.errorCode.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        score += 45;
      }

      // Title similarity (exact or Jaccard overlap)
      const aNorm = this.normalizeText(a.title);
      const aTitleTokens = this.tokenize(a.title);
      const titleSim = this.calculateJaccardSimilarity(newTitleTokens, aTitleTokens);

      if (newNorm === aNorm) {
        score += 50;
      } else if (newNorm.includes(aNorm) || aNorm.includes(newNorm)) {
        score += 35;
      } else if (titleSim >= 0.5) {
        score += Math.round(titleSim * 40);
      }

      // Full content token Jaccard
      const aTokens = this.tokenize(`${a.title} ${a.originalErrorDescription}`);
      const sim = this.calculateJaccardSimilarity(newTokens, aTokens);
      score += Math.round(sim * 25);

      if (score > highestScore) {
        highestScore = score;
        matchedArticle = a;
      }
    }

    if (highestScore >= 60 && matchedArticle) {
      const totalUses = matchedArticle.successCount + matchedArticle.failureCount;
      const articleDTO: KnowledgeArticleDTO = {
        id: matchedArticle.id,
        workspaceId: matchedArticle.workspaceId,
        title: matchedArticle.title,
        normalizedError: matchedArticle.normalizedError,
        originalErrorDescription: matchedArticle.originalErrorDescription,
        errorCode: matchedArticle.errorCode,
        category: matchedArticle.category,
        assetType: matchedArticle.assetType,
        operatingSystem: matchedArticle.operatingSystem,
        productOrService: matchedArticle.productOrService,
        environmentNotes: matchedArticle.environmentNotes,
        symptoms: JSON.parse(matchedArticle.symptoms || '[]'),
        diagnosticSteps: JSON.parse(matchedArticle.diagnosticSteps || '[]'),
        verifiedSolution: matchedArticle.verifiedSolution,
        preventionNotes: matchedArticle.preventionNotes,
        status: matchedArticle.status as any,
        confidenceBasis: matchedArticle.confidenceBasis as any,
        successCount: matchedArticle.successCount,
        failureCount: matchedArticle.failureCount,
        successRate: totalUses > 0 ? Math.round((matchedArticle.successCount / totalUses) * 100) : null,
        createdBy: matchedArticle.createdBy,
        verifiedBy: matchedArticle.verifiedBy,
        lastUsedAt: matchedArticle.lastUsedAt?.toISOString() || null,
        createdAt: matchedArticle.createdAt.toISOString(),
        updatedAt: matchedArticle.updatedAt.toISOString(),
        linkedIncidentCount: matchedArticle._count?.linkedIncidents || 0,
      };

      return {
        hasDuplicate: true,
        similarityScore: highestScore,
        matchedArticle: articleDTO,
        recommendation: highestScore >= 90 ? 'UPDATE_EXISTING' : 'WARN_DUPLICATE',
        reason: `A very similar article '${matchedArticle.title}' already exists (${highestScore}% similarity). Consider updating it instead of creating duplicates.`,
      };
    }

    return {
      hasDuplicate: false,
      similarityScore: highestScore,
      matchedArticle: null,
      recommendation: 'CREATE_NEW',
      reason: 'No duplicate detected. Safe to create as new article.',
    };
  }
}
