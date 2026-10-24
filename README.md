# FixFlow AI — Inventory-Aware IT Diagnostics Workbench

FixFlow AI is an inventory-aware, AI-assisted IT troubleshooting workbench built for SysAdmins, Tier 1–3 support engineers, and SREs. It pairs structured deterministic troubleshooting decision trees with bounded AI orchestration (Google Gemini API / local deterministic fallback) grounded in real registered IT assets and infrastructure dependencies.

---

## Key Highlights

- **Inventory-Grounded Diagnostics**: Diagnostic tests reference the actual names, IP addresses, operating systems, and upstream relationships (`depends_on`, `hosted_on`, `routes_through`, `authenticates_against`) of registered enterprise assets.
- **Dual Diagnostic Modes**:
  - **Guided Mode**: Adaptive, step-by-step diagnostic test runner with copyable read-only commands, safety risk ratings, and manual result entry.
  - **Agent Mode**: Bounded multi-step autonomous planning (maximum 6 steps per cycle, 12-step session budget, loop detection, and human approval gates for elevated actions).
- **Infrastructure Availability Monitoring (ICMP)**:
  - On-premises local monitoring agent reporting real-time reachability, average latency, and packet loss for servers, switches, firewalls, and storage.
  - Deterministic state machine declaring `ONLINE`, `DEGRADED`, `OFFLINE`, `UNKNOWN`, and `MAINTENANCE`.
  - Bounded consecutive-failure outage detection with automated `AvailabilityIncident` tracking.
  - Diagnostic triage correlation: automatically feeds live reachability telemetry and upstream dependency health into AI troubleshooting workbench.
  - Synthetic simulation mode for local zero-hardware demonstration.
- **Strict Version A Air-Gapped / Human-in-the-Loop Access Model**:
  - No autonomous network discovery, background ping sweeps, or daemon connection to corporate networks.
  - Zero autonomous command execution or remote system modifications.
  - Technicians execute read-only diagnostic commands on their endpoints and enter observed outputs back into FixFlow AI.
- **Infrastructure Dependency Map**: Interactive topology graph powered by React Flow (`@xyflow/react`) visualizing relationships across endpoints, network devices, virtualization hosts, and storage.
- **Auditable Post-Mortem Reports & Vector PDF Export**: Editable executive summaries, 5-Whys causal progression, strictly separated verified fixes vs unverified recommendations, and printable vector PDF export via high-contrast `@media print` styling.
- **Reset Demo Data Action**: Fully functional demo state with 15 pre-loaded enterprise assets and 5 diagnostic scenarios, with a 1-click reset confirmation dialog.

---

## Architecture & Documentation

Comprehensive architectural and safety specifications are documented in the root `docs/` directory:
- [Product Specification](file:///d:/Personal/Developer/fixflow-ai/docs/PRODUCT_SPEC.md) (`docs/PRODUCT_SPEC.md`)
- [Infrastructure Monitoring Guide](file:///d:/Personal/Developer/fixflow-ai/docs/MONITORING.md) (`docs/MONITORING.md`)
- [Architecture & Design Tokens](file:///d:/Personal/Developer/fixflow-ai/docs/ARCHITECTURE.md) (`docs/ARCHITECTURE.md`)
- [Data Model & Schema](file:///d:/Personal/Developer/fixflow-ai/docs/DATA_MODEL.md) (`docs/DATA_MODEL.md`)
- [Safety & Sandboxing Policy](file:///d:/Personal/Developer/fixflow-ai/docs/SAFETY.md) (`docs/SAFETY.md`)
- [Implementation Plan](file:///d:/Personal/Developer/fixflow-ai/docs/IMPLEMENTATION_PLAN.md) (`docs/IMPLEMENTATION_PLAN.md`)
- [Demo Script & Evaluation Guide](file:///d:/Personal/Developer/fixflow-ai/docs/DEMO_SCRIPT.md) (`docs/DEMO_SCRIPT.md`)
- [Automated Test Plan](file:///d:/Personal/Developer/fixflow-ai/docs/TEST_PLAN.md) (`docs/TEST_PLAN.md`)

---

## Getting Started

### Environment Configuration & Gemini AI Setup

FixFlow AI supports server-side reasoning via the official Google Gen AI SDK (`@google/genai`). To enable live AI reasoning:

1. **Copy the environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Add your Google Gemini API Key**:
   Open `.env.local` and provide your API key obtained from [Google AI Studio](https://aistudio.google.com/):
   ```env
   DATABASE_URL="file:./dev.db"
   GEMINI_API_KEY="your_actual_gemini_api_key_here"
   GEMINI_MODEL="gemini-2.5-flash"
   ```

> [!IMPORTANT]
> **Zero Client-Side Secret Exposure**: `GEMINI_API_KEY` is loaded exclusively by server-side route handlers and provider adapters. No secrets are prefixed with `NEXT_PUBLIC_` or accessible in client browser bundles.

> [!NOTE]
> **Deterministic Offline Mode**: If `GEMINI_API_KEY` is omitted, FixFlow AI automatically falls back to the deterministic diagnostic engine. All 5 core scenarios, intake routing, and post-mortem generation remain 100% operational offline without an API key.

---

### Prerequisites
- **Node.js**: v18.18.0 or later (v20+ recommended)
- **Package Manager**: `npm`

### Installation & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup & Seeding**:
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run the Production Build**:
   ```bash
   npm run build
   npm run start
   ```

5. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   All 77 unit and integration tests run deterministically offline across 32 test suites.

6. **Run Local Infrastructure Monitoring Agent**:
   ```powershell
   # Single-pass execution (audits configured assets once and ingests to backend):
   npx tsx agent/index.ts --once --server http://localhost:3000 --agent-id agent-win11-ops --key ffa_agent_demo_win11_ops01_lan_prober_key_v1

   # Continuous background monitoring daemon:
   npx tsx agent/index.ts --server http://localhost:3000 --agent-id agent-win11-ops --key ffa_agent_demo_win11_ops01_lan_prober_key_v1 --interval 30 --concurrency 5
   ```
