# FixFlow AI — Demonstration Script & Evaluation Guide

This document provides a structured, timed walkthrough for hackathon judges, evaluators, and stakeholders to experience FixFlow AI's full capabilities in under 5 minutes.

---

## 1. Demo Prerequisites & Zero-Key Setup

FixFlow AI is engineered to run **100% offline out-of-the-box** without any cloud credentials or API keys.

1. Ensure the server is running:
   ```bash
   npm run build
   npm run start
   # Or for development: npm run dev
   ```
2. Open your browser to: **[http://localhost:3000](http://localhost:3000)**
3. *(Optional)* To enable live Google Gemini structured synthesis, add your API key in `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

## 2. 5-Minute Hackathon Demo Script

### Act 1: The Operations Dashboard & Inventory Context (Minute 0:00 - 1:00)
- **Narrative**: *"Welcome to FixFlow AI. Today's IT support engineers are bombarded with messy user tickets, while production environments are too fragile to let autonomous agents execute random scripts. FixFlow AI is an inventory-aware diagnostic workbench that pairs safe, deterministic decision trees with bounded AI planning."*
- **Actions**:
  1. Start on the **Operations Dashboard** (`http://localhost:3000`). Point out active incident metrics, severity distribution, and recent investigations.
  2. Click **Asset Inventory** in the sidebar (`/assets`).
  3. Show the registered enterprise assets (Domain Controllers, File Servers, Core Switches, Virtual Machines).
  4. Click **Dependency Map** (`/dependency-map`). Show the visual graph of how Workstations connect to Switches, authenticate against Active Directory, and depend on File Servers.

---

### Act 2: Natural Language Intake & Asset Matching (Minute 1:00 - 2:00)
- **Narrative**: *"Let's take a common, frustrating ticket: A remote executive can connect to the corporate VPN, but cannot access their department file share."*
- **Actions**:
  1. Click **New Incident** in the sidebar (`/incident/new`).
  2. Click the quick-preset chip: **"VPN Connected but File Server Inaccessible"**.
  3. Notice how the triage engine instantly identifies:
     - Target Asset: `EXEC-LT-04` (Executive Laptop)
     - Target Resource: `FS-CORP-01` (`10.200.4.50`)
     - Category: `VPN & Networking`
     - Bound Scenario: `VPN Routing & MTU Black Hole Isolation`
  4. Click **"Launch Investigation Workbench"**.

---

### Act 3: Guided Mode — Safe, Step-by-Step Triage (Minute 2:00 - 3:00)
- **Narrative**: *"In Guided Mode, FixFlow AI presents one validated, read-only diagnostic test at a time. It never runs code on the remote machine—it empowers the human technician with exact commands, risk ratings, and expected outputs."*
- **Actions**:
  1. Inspect the first test: **"Verify VPN Virtual Adapter IP Configuration"**.
  2. Point out the copyable PowerShell command (`Get-NetIPAddress`), the safety rating (`SAFE_READ_ONLY`), and rollback instructions.
  3. Select outcome: **"Passed"** and click **"Record Result"**.
  4. Next test: **"Test Path MTU & Fragmentation"** (`ping -f -l 1472 10.200.4.50`).
  5. Select outcome: **"Passed"** (rules out MTU black hole).
  6. Next test: **"Audit Split-Tunnel Routing Table"** (`route print`).
  7. Select outcome: **"Failed"** (route for `10.200.4.0/24` is missing from the table).
  8. Click the **"Decision Tree"** tab in the center console: Show how the MTU hypothesis was refuted while the Missing Route hypothesis reached **95% Confidence (Root Cause Identified)**.

---

### Act 4: Agent Mode — Bounded Planning & Approval Gating (Minute 3:00 - 4:00)
- **Narrative**: *"What if the technician prefers the AI to plan the entire investigation autonomously? We switch to Agent Mode—with strict enterprise guardrails."*
- **Actions**:
  1. In the workbench header, toggle **Mode** from `Guided` to `Agent`.
  2. Click **"Propose Agent Diagnostic Plan"**.
  3. Show the bounded plan:
     - Strictly capped at **6 steps**.
     - Tools restricted to the server-side **Tool Allowlist**.
     - Session budget tracked.
  4. Highlight the **Human Approval Gate**: Show how elevated probes (such as port sweeps or deep event log queries) require explicit operator confirmation before execution.

---

### Act 5: Executive Post-Mortem & Vector PDF Export (Minute 4:00 - 5:00)
- **Narrative**: *"Once an incident is resolved, management and auditors need a clean RCA report. FixFlow AI generates a compliant post-mortem that strictly separates verified facts from unverified suggestions."*
- **Actions**:
  1. Click **"Generate Final Report"** or navigate to `/incident/[id]/report`.
  2. Point out the **Truth-in-Reporting Invariants**:
     - Verified Findings list only tests with confirmed terminal telemetry.
     - Unobserved metrics are clearly flagged as `[Unknown / Telemetry Not Recorded]`, never hallucinated.
     - 5-Whys causal progression is automatically structured.
  3. Click **"Edit Post-Mortem"** to demonstrate technician sign-off notes.
  4. Click the cyan **"Print / Save as PDF"** button (or press `Ctrl+P`).
  5. Show the clean, print-optimized executive vector PDF ready for leadership sign-off.

---

## 3. Evaluator Verification Matrix

| Evaluation Criterion | What to Test | Expected Outcome |
| :--- | :--- | :--- |
| **Zero-Key Offline Operation** | Disconnect internet or leave `GEMINI_API_KEY` blank. | App runs with 100% functionality; UI displays `deterministic_fallback` badges. |
| **Tool Sandboxing & Safety** | Inspect command recommendations across all 5 scenarios. | 100% read-only probes (`Resolve-DnsName`, `ping`, `Get-NetRoute`, etc.). No destructive commands (`rm`, `reboot`). |
| **Inventory & Dependency Context** | View `/dependency-map` and link assets in `/incident/new`. | Diagnostic steps incorporate real asset names, IPs, and upstream relationships. |
| **Bounded Agent Execution** | Request an Agent plan in Agent Mode. | Plan contains $\le 6$ steps; tools match allowlist; requires approval for elevated probes. |
| **Print / PDF Quality** | Trigger print on `/incident/[id]/report`. | High-contrast, pure-white background, black text, no sidebar, clean pagination. |
