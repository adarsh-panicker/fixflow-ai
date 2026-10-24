// src/lib/ai/safetyValidator.ts

export const APPROVED_TOOLS = [
  'dns_resolver_probe',
  'ping_icmp_probe',
  'socket_port_probe',
  'vpn_route_audit',
  'mtu_path_probe',
  'service_status_probe',
  'ntfs_permission_audit',
  'vss_writer_audit',
  'event_log_query',
  'technician_intake',
] as const;

export type ApprovedToolName = typeof APPROVED_TOOLS[number];

const FORBIDDEN_TOKENS = [
  'rm ',
  'del ',
  'format ',
  'shutdown',
  'reboot',
  'set-itemproperty',
  'remove-item',
  'net user /add',
  'chmod',
  'mkfs',
  'invoke-expression',
  'iex ',
  'sudo ',
  'dd ',
  'kill',
  'taskkill',
  'pkill',
  'systemctl stop',
  'systemctl restart',
  'stop-service',
  'restart-service',
  'new-item',
  'drop table',
  'truncate',
];

const FORBIDDEN_SHELL_PATTERNS = [
  /;\s*(\w+)/,          // Semicolon command chaining
  /&&/,                 // Boolean AND chaining
  /`/,                  // PowerShell backtick subshell
  /\$\(/,               // Subshell substitution $()
  />{1,2}/,             // File redirection > or >>
  /<{1,2}/,             // Input redirection
];

export interface CommandSafetyValidationResult {
  isSafe: boolean;
  toolName: string;
  violations: string[];
}

export class SafetyValidator {
  /**
   * Validates tool name and command text against the strict safety allowlist
   */
  public static validateCommand(toolName: string, command: string): CommandSafetyValidationResult {
    const violations: string[] = [];

    // 1. Tool Allowlist Check
    if (!APPROVED_TOOLS.includes(toolName as ApprovedToolName)) {
      violations.push(`Disallowed tool identifier '${toolName}'. Permitted tools: ${APPROVED_TOOLS.join(', ')}`);
    }

    const lowerCmd = command.toLowerCase().trim();

    // 2. Forbidden Binaries & Destructive Actions Check
    for (const token of FORBIDDEN_TOKENS) {
      if (lowerCmd.includes(token)) {
        violations.push(`Command contains destructive or state-modifying token: '${token}'`);
      }
    }

    // 3. Forbidden Shell Metacharacters (Pipes, Subshells, Chaining)
    for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
      if (pattern.test(command)) {
        violations.push(`Command contains unsafe shell chaining or redirection metacharacter matching: ${pattern}`);
      }
    }

    return {
      isSafe: violations.length === 0,
      toolName,
      violations,
    };
  }

  /**
   * Validates suggested asset tags against a known list of registered workspace assets
   */
  public static validateAssetTags(
    suggestedTags: string[],
    knownAssetTags: string[]
  ): { validTags: string[]; invalidTags: string[] } {
    const knownLower = new Set(knownAssetTags.map(t => t.toLowerCase()));
    const validTags: string[] = [];
    const invalidTags: string[] = [];

    for (const tag of suggestedTags) {
      if (knownLower.has(tag.toLowerCase())) {
        validTags.push(tag);
      } else {
        invalidTags.push(tag);
      }
    }

    return { validTags, invalidTags };
  }

  /**
   * Validates that evidence IDs referenced by hypotheses actually exist in the session
   */
  public static validateEvidenceReferences(
    referencedIds: string[],
    existingEvidenceIds: string[]
  ): { validIds: string[]; invalidIds: string[] } {
    const existingSet = new Set(existingEvidenceIds);
    const validIds: string[] = [];
    const invalidIds: string[] = [];

    for (const id of referencedIds) {
      if (existingSet.has(id)) {
        validIds.push(id);
      } else {
        invalidIds.push(id);
      }
    }

    return { validIds, invalidIds };
  }
}
