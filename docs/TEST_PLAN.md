# FixFlow AI — Automated Test Plan & Quality Assurance Strategy

## 1. Testing Philosophy & Test Trophy

FixFlow AI operates under a **safety-critical** IT operations mandate. Test suites are designed to guarantee that the application never produces unsafe commands, never crashes on malformed AI output, and correctly enforces the deterministic state machine.

```
       / \
      / E2E \       Live Server HTTP Route Audits (All UI & API routes return 200)
     /-------\
    /  Integ  \     Workflow Tests (Intake -> Guided -> Agent -> Tree -> Report)
   /-----------\
  /    Unit      \  Engine, Safety Validator, Agent Planner, Zod Schemas
 /----------------\
```

---

## 2. Test Suite Specifications

### 2.1 Unit Test Suites

#### Suite 1: Tool Allowlist & Safety Sandboxing (`src/lib/safety/__tests__/validator.test.ts`)
- **T1.1: Forbidden Binaries Rejection**: Asserts that tool names or commands containing `exec`, `spawn`, `sh`, `bash`, `cmd`, `powershell`, `rm`, `del`, `format`, `shutdown`, `reboot`, or `Set-ItemProperty` throw `SafetyViolationError`.
- **T1.2: Shell Injection Prevention**: Asserts that command arguments containing `;`, `&`, `&&`, `|`, `` ` ``, `$()`, `>`, or `<` fail Zod schema validation.
- **T1.3: Tool Allowlist Verification**: Proves that only registered probes (`dns_resolver_probe`, `ping_icmp_probe`, `socket_port_probe`, `vpn_route_audit`, `mtu_path_probe`, `service_status_probe`, `ntfs_permission_audit`, `vss_writer_audit`, `event_log_query`) pass validation.
- **T1.4: Parameter Regex Constraints**: Verifies that IP addresses and hostnames match strict RFC-compliant patterns.

#### Suite 2: Deterministic Diagnostic Engine (`src/lib/engine/__tests__/engine.test.ts`)
- **T2.1: Lifecycle State Transitions**: Verifies progression from `intake` $\rightarrow$ `investigating` $\rightarrow$ `root_cause_identified` $\rightarrow$ `resolved`.
- **T2.2: Branching & Evidence Weighting**:
  - In DNS scenario: Proves that failed local cache test branches to internal resolver query.
  - In VPN scenario: Proves that passed MTU test refutes MTU black hole and promotes Missing Route hypothesis.
- **T2.3: Inconclusive & Missing Evidence Handling**: Asserts that `not_tested` or `inconclusive` results do not prematurely conclude investigations.
- **T2.4: Contradictory Evidence Dampening**: Verifies that conflicting evidence dampens confidence scores to neutral uncertainty ($0.5$).
- **T2.5: L1–L7 Structured Fallback**: Verifies that unmapped incidents generate a valid 4-stage diagnostic tree.

#### Suite 3: Bounded Agent Mode Guardrails (`src/lib/agent/__tests__/agent.test.ts`)
- **T3.1: Planning Step Cap**: Asserts that no agent plan ever exceeds **6 diagnostic steps** per cycle.
- **T3.2: Session Budget Exhaustion**: Proves that exceeding the 12-step session budget halts execution with `BudgetExceededError`.
- **T3.3: Loop & Duplicate Prevention**: Asserts that attempting to run identical probes consecutively triggers loop detection and halts.
- **T3.4: Human Approval Gating**: Verifies that elevated probes pause execution and set `requiresApproval: true`.
- **T3.5: Plan Adaptation**: Verifies that refuting evidence causes the agent to discard invalid downstream steps and re-plan.

#### Suite 4: AI Provider Adapter & Error Resilience (`src/lib/ai/__tests__/adapter.test.ts`)
- **T4.1: Structured Zod Contracts**: Verifies that incident triage, explanations, and report generation produce schema-valid JSON.
- **T4.2: Malformed Output Recovery**: Simulates corrupted JSON, truncated tokens, and markdown fences, asserting clean fallback without server crashes.
- **T4.3: Zero Secret Leakage**: Verifies that error traces and serialized responses never contain API keys or environment variables.
- **T4.4: Truth-in-Reporting Invariant**: Verifies that unobserved telemetry strictly defaults to `[Unknown / Telemetry Not Recorded]`.

---

### 2.2 Integration Test Suites (`src/lib/engine/__tests__/integration_workflow.test.ts`)

- **I1: End-to-End Guided Workflow**:
  1. Create incident session from raw text.
  2. Bind to registered asset (`EXEC-LT-04`) and scenario.
  3. Execute step 1 (`passed`), step 2 (`passed`), step 3 (`failed`).
  4. Verify hypothesis confidence reaches $\ge 90\%$.
  5. Verify post-mortem report generation with verified facts and 5-Whys.
- **I2: Asset CRUD & CSV Import**:
  1. Validate CSV row parsing with valid and invalid columns.
  2. Create asset with upstream and downstream dependencies.
  3. Verify cascade deletes and relationship integrity.

---

### 2.3 Automated End-to-End Route Audit (`scratch/audit_runner.mjs`)

An automated Node.js HTTP test script executing against the live running server:
- `GET /` $\rightarrow$ 200 OK (Dashboard)
- `GET /incident/new` $\rightarrow$ 200 OK (Intake)
- `GET /assets` $\rightarrow$ 200 OK (Inventory)
- `GET /dependency-map` $\rightarrow$ 200 OK (Topology Map)
- `GET /investigations` $\rightarrow$ 200 OK (History)
- `GET /incident/INC-2026-0842` $\rightarrow$ 200 OK (Workbench)
- `GET /incident/INC-2026-0842/report` $\rightarrow$ 200 OK (Post-Mortem)
- `POST /api/ai/parse-incident` $\rightarrow$ 200 OK (Zod valid)
- `POST /api/ai/explain-step` $\rightarrow$ 200 OK (Zod valid)
- `POST /api/ai/evaluate-hypotheses` $\rightarrow$ 200 OK (Zod valid)
- `POST /api/ai/generate-report` $\rightarrow$ 200 OK (Zod valid)
- `POST /api/agent/plan` $\rightarrow$ 200 OK (Zod valid)

---

## 3. Test Execution Commands & CI Checks

```bash
# 1. Strict TypeScript Compile Check
npx tsc --noEmit

# 2. Linting & Formatting Check
npm run lint

# 3. Complete Automated Test Suite (Unit & Integration)
npm test

# 4. Production Next.js Bundle Compilation
npm run build

# 5. Live Route Audit (with server running on port 3000)
node scratch/audit_runner.mjs
```
