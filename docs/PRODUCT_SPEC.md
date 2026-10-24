# FixFlow AI — Product Specification

## 1. Executive Summary & Vision

**FixFlow AI** is an inventory-aware, AI-assisted IT troubleshooting workbench designed for IT support technicians, system administrators, and site reliability engineers (SREs). 

Traditional IT triage tools fall into two extremes: rigid, un-contextual decision trees that don't know your specific infrastructure, or generic AI chat interfaces (e.g. ChatGPT) that hallucinate dangerous commands, lack infrastructure context, and fail to track verifiable diagnostic evidence.

FixFlow AI bridges this divide through **Inventory-Aware Diagnostic Reasoning**:
- **Asset & Dependency Grounding**: Troubleshooting is grounded in the organization's real IT asset registry (servers, workstations, firewalls, hypervisors, services, and network switches) and confirmed infrastructure relationships (`depends_on`, `hosted_on`, `routes_through`, `authenticates_against`).
- **Dual Diagnostic Engines**: 
  - **Guided Mode**: A deterministic, step-by-step diagnostic runner presenting one validated test at a time with copyable read-only commands, expected outputs, safety ratings, and manual result entry.
  - **Agent Mode**: A bounded multi-step autonomous planner (maximum 6 steps per cycle) that constructs a goal-directed investigation plan and adapts dynamically as the human technician supplies test results.
- **Strict Version A Air-Gapped / Human-in-the-Loop Access Model**: 
  - No autonomous network discovery, background ping sweeps, or daemon connection to corporate networks.
  - Zero autonomous command execution or remote system modifications.
  - Technicians execute read-only diagnostic commands on their endpoints and enter observed outputs back into FixFlow AI.
- **Auditable Truth-in-Reporting**: A hard boundary between **Observed Facts** (backed by recorded evidence), **Candidate Hypotheses** (ranked by confidence), and **Unverified Recommendations**.

---

## 2. Target Personas & Experience Levels

FixFlow AI dynamically adapts terminology, command verbosity, and diagnostic guidance based on the operator's experience tier:

| Persona | Role | Needs & Pain Points | Experience Setting | Adapted Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 / Junior Help Desk** | Junior IT Technician | Unsure which CLI tools to run; prone to premature reboots or escalation. | **Beginner** | Detailed step explanations, exact command syntax with parameters pre-filled, plain-English "what to look for", safety warnings. |
| **Tier 2 / Systems Administrator** | SysAdmin / Network Admin | Handles complex multi-system outages; needs rapid isolation of routing vs DNS vs auth. | **Intermediate** | Compact syntax, direct PowerShell/Bash snippets, emphasis on topology paths and dependency impact. |
| **Tier 3 / SRE / Lead Architect** | Senior Engineer / Incident Lead | Needs rapid hypothesis testing, raw evidence logging, timeline auditing, and instant executive RCA generation. | **Advanced** | Minimalist command views, raw regex/telemetry entry, full hypothesis matrix weights, direct export to post-mortem. |

---

## 3. Scope & Infrastructure Access Boundary (Version A)

FixFlow AI strictly adheres to the **Version A** infrastructure access model:
1. **Manual Inventory Registration & CSV Import**: IT assets and topologies are explicitly entered by the user or imported via standard CSV/JSON schemas. No background network scanning or SNMP discovery.
2. **Human-Operated Diagnostic Execution**: FixFlow AI provides exact, verified, copyable diagnostic commands (PowerShell, Bash, Command Prompt). The human operator executes the command on the target system and records the observed result (Passed, Failed, Inconclusive, Error, or raw terminal output).
3. **Zero Autonomous Remote Changes**: FixFlow AI has no SSH keys, WinRM credentials, domain admin tokens, or agent daemons. It cannot reboot machines, modify registry keys, alter firewall rules, restart services, or delete files.
4. **Offline Zero-Key Reliability**: Works completely out-of-the-box without live external API keys using built-in deterministic scenario engines and labeled fallback models (`provenance: 'deterministic_fallback'`). When a Google Gemini API key is configured server-side, it unlocks structured generative synthesis, free-text parsing, and dynamic plan adaptation.

---

## 4. Product Modules & Functional Specifications

### Module 1: Dashboard (`/`)
- **Active Operations Center**: Real-time snapshot of active incidents, priority breakdown (P1 Critical through P4 Low), mean time to triage, and asset health status.
- **Quick Action Bar**: "New Incident Intake", "Register Asset", "Import Inventory CSV", and "View Dependency Map".
- **Recent Investigation Queue**: Sortable, filterable list of in-progress and recently closed diagnostic sessions.

### Module 2: AI Troubleshooter / Diagnostic Workbench (`/incident/[id]`)
- **Unified Center Console**:
  - **Diagnostic Runner**: Renders the current step (Guided) or the active plan execution queue (Agent). Shows command syntax, purpose, expected normal vs. failure patterns, rollback/safety notes, and manual result inputs.
  - **Visual Decision Tree**: Interactive node graph representing symptoms, investigated branches, and confirmed/refuted hypotheses.
  - **Investigation Timeline**: Chronological log of technician actions, test inputs, recorded telemetry, and state transitions.
- **Right Context Rail (Collapsible)**:
  - **Associated Assets & Dependencies**: The target asset, upstream dependencies (e.g. gateway, DNS server, AD DC), and downstream services.
  - **Evidence Locker**: Filterable log of recorded observations classified by impact (`supporting`, `refuting`, `neutral`).
  - **Hypothesis Matrix**: Dynamic table of competing hypotheses with live confidence meters.

### Module 3: Asset Inventory (`/assets`)
- **Asset Catalog**: Full CRUD management of enterprise IT assets with metadata: Asset Tag, Name, Type, Hostname/FQDN, IP Address/Subnet, Operating System, Physical/Virtual Location, Criticality (Tier 1-4), Assigned Owner, and Operational Status.
- **Supported Asset Types**:
  - `Server` (Physical Windows/Linux)
  - `Virtual Machine` (VMware, Hyper-V, KVM)
  - `Workstation` / `Laptop` (Windows 11, macOS, Ubuntu)
  - `Network Device` (Switch, Router, Gateway)
  - `Firewall` / `VPN Appliance`
  - `Storage / NAS / SAN`
  - `Shared Folder / SMB Share`
  - `Database` (PostgreSQL, MSSQL, MySQL)
  - `Application / SaaS`
  - `Windows Service / Daemon`
  - `Printer / Peripheral`
- **CSV Import / Export**:
  - Bulk import via CSV with schema validation, dry-run preview, and duplicate detection.
  - Template download with pre-formatted columns.

### Module 4: Infrastructure Dependency Map (`/dependency-map`)
- **Visual Graph Visualization**: Powered by React Flow (`@xyflow/react`) with custom dark-navy node cards.
- **Relationship Taxonomy**:
  - `depends_on`: Upstream functional dependency (e.g. ERP App depends on Database Server).
  - `hosted_on`: Virtualization/container relationship (e.g. VM hosted on Hypervisor Cluster).
  - `connects_to`: Network transport link (e.g. Workstation connects to Core Switch).
  - `authenticates_against`: Identity relationship (e.g. File Server authenticates against Active Directory DC).
  - `routes_through`: Gateway/Firewall route (e.g. Branch Office routes through Edge Firewall).
- **Interactive Triage Highlighting**: When an asset is linked to an active incident, the dependency map highlights the blast radius and upstream single-points-of-failure.

### Module 5: Incident History (`/investigations`)
- **Historical Repository**: Searchable archive of all historical triage investigations.
- **Multi-Faceted Search**: Filter by incident ID, target asset, category, technician, date range, resolution status (`investigating`, `root_cause_identified`, `resolved`, `escalated`, `closed`), and diagnostic mode used.

### Module 6: Findings & Post-Mortem PDF Reports (`/incident/[id]/report`)
- **Comprehensive RCA Summary**:
  - Incident Brief (Title, impacted systems, timeline, severity, MTTR).
  - Confirmed Root Cause & 5-Whys causal chain.
  - Complete Evidence Audit Trail (timestamped test results entered by technician).
  - Remediation Action Items (distinguishing verified immediate fixes from unverified long-term recommendations).
- **Interactive Editing**: Operators can update executive notes and toggle verification checkboxes.
- **Vector PDF / Print Engine**: Dedicated `@media print` CSS layout that renders a clean, professional, high-contrast black-and-white executive document via standard browser print dialog (`window.print()`).

### Module 7: Settings & AI Configuration (`/settings`)
- **System & LLM Status**: Live health indicator for server-side Gemini API or local fallback.
- **Model Parameters**: Selection of model (`gemini-2.5-flash`, `gemini-1.5-pro`), timeout configurations, retry thresholds.
- **Experience Level Default**: Global operator profile toggle (Beginner, Intermediate, Advanced).
- **Database & Data Management**: Reset demo data, export full SQLite database, re-seed initial scenarios.

---

## 5. Five Representative Deterministic Scenarios (Inventory-Aware)

FixFlow AI ships with five end-to-end deterministic scenarios that link directly to registered inventory assets:

### Scenario 1: DNS Resolution & Zone Delegation Failure
- **Incident Description**: "Workstations in Finance subnet cannot resolve internal accounting portal `erp.corp.internal`."
- **Involved Assets**: Workstation `FIN-WS-012`, Core Switch `SW-CORE-01`, Internal DNS Server `DC-DNS-01` (`10.0.1.10`), Backup DNS `DC-DNS-02`.
- **Diagnostic Flow**:
  1. Test local DNS client resolver cache and adapter configuration.
  2. Query primary internal DNS server via `Resolve-DnsName -Server 10.0.1.10`.
  3. Query root forwarder / upstream gateway.
  4. Inspect forward lookup zone delegation and SRV records.
- **Root Cause Isolated**: Stale forwarding record and expired zone replication between `DC-DNS-01` and `DC-DNS-02`.

### Scenario 2: VPN Connected but Remote SMB File Server Inaccessible
- **Incident Description**: "Remote executives can connect to corporate VPN but get `0x80070035 Network Path Not Found` when opening `\\fs01.corp.internal\Shared`."
- **Involved Assets**: Client Laptop `EXEC-LT-04`, VPN Gateway `FW-EDGE-01`, Core File Server `FS-CORP-01` (`10.200.4.50`).
- **Diagnostic Flow**:
  1. Verify virtual adapter IP assignment (`172.16.50.14`) and default subnet mask.
  2. Test ICMP reachability to `10.200.4.50`.
  3. Test SMB TCP Port 445 socket reachability.
  4. Perform path MTU sweep (`ping -f -l 1472`) to detect packet fragmentation black-holes.
  5. Audit split-tunnel routing table (`route print`) for corporate subnet prefix `10.200.0.0/16`.
- **Root Cause Isolated**: VPN concentrator DHCP push omitted the static routing prefix for `10.200.4.0/24`, causing file share traffic to route out the local internet interface.

### Scenario 3: Windows Print Spooler Crash Loop & Dependency Deadlock
- **Incident Description**: "All warehouse shipping label printers went offline; Print Spooler service on print server terminates within 5 seconds of starting."
- **Involved Assets**: Print Server `SRV-PRINT-01`, Warehouse Thermal Printer `PRN-WH-01`, Windows Service `Spooler`.
- **Diagnostic Flow**:
  1. Query Windows Service status (`Get-Service Spooler`).
  2. Query Event Viewer System log for Event ID 7031/7034 (Service Crash).
  3. Query Application log for faulting module in `spoolsv.exe`.
  4. Check `C:\Windows\System32\spool\PRINTERS\` directory for corrupted `.SHD` and `.SPL` spool files.
- **Root Cause Isolated**: Corrupted print job file `00042.SHD` in spool queue directory causing heap corruption in `spoolsv.exe` upon service initialization.

### Scenario 4: Active Directory Kerberos Token Bloat & NTFS Access Denial
- **Incident Description**: "Senior manager added to new Security Groups suddenly receives `Access Denied` on previously accessible department folder `\\fs-corp-01\Engineering`."
- **Involved Assets**: Workstation `ENG-WS-088`, Domain Controller `DC-AUTH-01`, File Server `FS-CORP-01`, User Account `j.doe@corp.internal`.
- **Diagnostic Flow**:
  1. Verify effective NTFS permissions on target directory.
  2. Check SMB session cache on client (`klist sessions`).
  3. Inspect Kerberos ticket size and group membership count (`klist get krbtgt`).
  4. Check HTTP/SMB MaxTokenSize event logs (Event ID 400).
- **Root Cause Isolated**: User belongs to >120 security groups, causing Kerberos token to exceed the default buffer size (Token Bloat), leading to silent SMB ticket rejection.

### Scenario 5: VSS Writer Failure & Nightly Backup Job Abort
- **Incident Description**: "Veeam nightly backup for database virtual machine `SRV-SQL-01` failed with `VSS snapshot creation timed out`."
- **Involved Assets**: Virtual Host `HYPER-NODE-02`, Virtual Machine `SRV-SQL-01`, Storage Array `SAN-VOL-03`, SQL Writer Service.
- **Diagnostic Flow**:
  1. Query VSS writers status via `vssadmin list writers`.
  2. Query VSS shadow storage allocation via `vssadmin list shadowstorage`.
  3. Query Windows System Event log for VolSnap Event ID 25/36 (Insufficient shadow copy storage).
  4. Check disk I/O latency during snapshot window.
- **Root Cause Isolated**: `SqlServerWriter` entered `[State 8: Failed] [Timed out]` due to shadow copy storage on volume `D:` exceeding its 10% maximum storage limit.

---

## 6. Success Metrics & Hackathon MVP Acceptance Criteria

1. **Complete Incident Lifecycle**: A user can create an incident, select or map an asset, execute a diagnostic session in Guided or Agent mode, confirm the root cause, and export a clean PDF report.
2. **Deterministic Offline Demonstration**: All five scenarios run completely without network connectivity or API keys.
3. **AI Enhancement**: When `GEMINI_API_KEY` is provided, natural language intake is structured automatically into technical metadata, and investigations adapt dynamically with LLM synthesis.
4. **Safety Verification**: 100% of suggested commands are read-only. Zero command executions take place on the host machine.
5. **Asset & Dependency Grounding**: Diagnostic tests reference the actual names, IP addresses, and dependencies of registered assets.
