// src/lib/services/csvImportService.ts
import { ASSET_TYPES, ASSET_CRITICALITIES, ASSET_STATUSES, AssetCreateSchema } from '../validation/assetSchemas';

export interface CsvPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: {
    assetTag: string;
    name: string;
    assetType: string;
    manufacturer?: string;
    model?: string;
    hostname?: string;
    ipAddress?: string;
    operatingSystem?: string;
    location?: string;
    owner?: string;
    notes?: string;
    tags?: string;
    criticality: string;
    status: string;
  };
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateAssetId?: string;
}

export interface CsvPreviewResult {
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: CsvPreviewRow[];
}

export class CsvImportService {
  /**
   * Parse CSV text into 2D array of strings handling quotes, escapes, and commas
   */
  public static parseCsv(csvText: string): { headers: string[]; data: Record<string, string>[] } {
    const lines = csvText.trim().split(/\r\n|\n|\r/);
    if (lines.length === 0 || !lines[0].trim()) {
      return { headers: [], data: [] };
    }

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      data.push(row);
    }

    return { headers, data };
  }

  /**
   * Normalize flexible column headers into canonical schema field keys
   */
  public static normalizeColumnHeader(header: string): string {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.includes('host') || clean.includes('fqdn')) return 'hostname';
    if (clean === 'tags' || clean === 'labels') return 'tags';
    if (clean.includes('tag') || clean === 'id' || clean === 'assetid') return 'assetTag';
    if (clean.includes('name') || clean === 'title') return 'name';
    if (clean.includes('type') || clean === 'category') return 'assetType';
    if (clean.includes('manuf') || clean === 'make' || clean === 'vendor') return 'manufacturer';
    if (clean.includes('model') || clean === 'hardware') return 'model';
    if (clean.includes('ip') || clean === 'address') return 'ipAddress';
    if (clean.includes('os') || clean.includes('operatingsystem')) return 'operatingSystem';
    if (clean.includes('loc') || clean.includes('site') || clean.includes('rack')) return 'location';
    if (clean.includes('owner') || clean.includes('admin') || clean.includes('team')) return 'owner';
    if (clean.includes('note') || clean.includes('desc')) return 'notes';
    if (clean.includes('crit') || clean.includes('tier') || clean.includes('prio')) return 'criticality';
    if (clean.includes('stat') || clean.includes('health') || clean.includes('state')) return 'status';
    return header;
  }

  /**
   * Preview and validate CSV rows against schema and existing database records
   */
  public static previewImport(
    csvText: string,
    existingAssets: { id: string; assetTag: string; hostname?: string | null; ipAddress?: string | null }[],
    columnMapping?: Record<string, string>
  ): CsvPreviewResult {
    const { headers, data } = this.parseCsv(csvText);

    // Build default column mapping if not provided
    const mapping: Record<string, string> = columnMapping || {};
    if (!columnMapping) {
      headers.forEach(h => {
        mapping[h] = this.normalizeColumnHeader(h);
      });
    }

    const rows: CsvPreviewRow[] = [];
    const seenInBatchTags = new Set<string>();

    data.forEach((rawRow, idx) => {
      const rowNumber = idx + 2; // +1 for 0-index, +1 for header line
      const errors: string[] = [];
      const mappedRow: Record<string, any> = {};

      Object.entries(rawRow).forEach(([csvHeader, value]) => {
        const targetField = mapping[csvHeader];
        if (targetField) {
          mappedRow[targetField] = value;
        }
      });

      // Normalize AssetType
      const rawType = (mappedRow.assetType || '').toUpperCase().replace(/[\s-]/g, '_');
      const validAssetType = (ASSET_TYPES as readonly string[]).includes(rawType)
        ? rawType
        : rawType === 'VM'
        ? 'VIRTUAL_MACHINE'
        : rawType === 'SHARE' || rawType === 'FOLDER'
        ? 'SHARED_FOLDER'
        : 'SERVER';

      // Normalize Criticality
      const rawCrit = (mappedRow.criticality || '').toUpperCase().replace(/[\s-]/g, '_');
      const validCrit = (ASSET_CRITICALITIES as readonly string[]).includes(rawCrit)
        ? rawCrit
        : rawCrit.includes('1')
        ? 'TIER_1_CRITICAL'
        : rawCrit.includes('2')
        ? 'TIER_2_HIGH'
        : rawCrit.includes('4')
        ? 'TIER_4_LOW'
        : 'TIER_3_MEDIUM';

      // Normalize Status
      const rawStatus = (mappedRow.status || '').toUpperCase().replace(/[\s-]/g, '_');
      const validStatus = (ASSET_STATUSES as readonly string[]).includes(rawStatus)
        ? rawStatus
        : 'OPERATIONAL';

      const candidate = {
        workspaceId: 'ws-default',
        assetTag: (mappedRow.assetTag || '').trim().toUpperCase(),
        name: (mappedRow.name || '').trim(),
        assetType: validAssetType,
        manufacturer: mappedRow.manufacturer ? mappedRow.manufacturer.trim() : null,
        model: mappedRow.model ? mappedRow.model.trim() : null,
        hostname: mappedRow.hostname ? mappedRow.hostname.trim().toLowerCase() : null,
        ipAddress: mappedRow.ipAddress ? mappedRow.ipAddress.trim() : null,
        operatingSystem: mappedRow.operatingSystem ? mappedRow.operatingSystem.trim() : null,
        location: mappedRow.location ? mappedRow.location.trim() : null,
        owner: mappedRow.owner ? mappedRow.owner.trim() : null,
        notes: mappedRow.notes ? mappedRow.notes.trim() : null,
        tags: mappedRow.tags ? mappedRow.tags.trim() : null,
        criticality: validCrit,
        status: validStatus,
      };

      // Zod Validation
      const parseResult = AssetCreateSchema.safeParse(candidate);
      if (!parseResult.success) {
        parseResult.error.errors.forEach(e => {
          errors.push(`${e.path.join('.')}: ${e.message}`);
        });
      }

      // Duplicate Check (Existing DB + Intra-batch)
      let isDuplicate = false;
      let duplicateReason: string | undefined;
      let duplicateAssetId: string | undefined;

      if (candidate.assetTag) {
        if (seenInBatchTags.has(candidate.assetTag)) {
          isDuplicate = true;
          duplicateReason = `Duplicate asset tag '${candidate.assetTag}' appears multiple times in CSV`;
        } else {
          seenInBatchTags.add(candidate.assetTag);
        }

        const existingTagMatch = existingAssets.find(
          a => a.assetTag.toLowerCase() === candidate.assetTag.toLowerCase()
        );
        if (existingTagMatch) {
          isDuplicate = true;
          duplicateReason = `Asset tag '${candidate.assetTag}' already exists in database (Asset: ${existingTagMatch.assetTag})`;
          duplicateAssetId = existingTagMatch.id;
        }
      }

      if (!isDuplicate && candidate.hostname) {
        const existingHostMatch = existingAssets.find(
          a => a.hostname && a.hostname.toLowerCase() === candidate.hostname?.toLowerCase()
        );
        if (existingHostMatch) {
          isDuplicate = true;
          duplicateReason = `Hostname '${candidate.hostname}' is already registered to asset ${existingHostMatch.assetTag}`;
          duplicateAssetId = existingHostMatch.id;
        }
      }

      if (!isDuplicate && candidate.ipAddress) {
        const existingIpMatch = existingAssets.find(a => a.ipAddress === candidate.ipAddress);
        if (existingIpMatch) {
          isDuplicate = true;
          duplicateReason = `IP address '${candidate.ipAddress}' is already assigned to asset ${existingIpMatch.assetTag}`;
          duplicateAssetId = existingIpMatch.id;
        }
      }

      rows.push({
        rowNumber,
        raw: rawRow,
        parsed: candidate,
        isValid: errors.length === 0,
        errors,
        isDuplicate,
        duplicateReason,
        duplicateAssetId,
      });
    });

    return {
      headers,
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid && !r.isDuplicate).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      duplicateRows: rows.filter(r => r.isDuplicate).length,
      rows,
    };
  }
}
