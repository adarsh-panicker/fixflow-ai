// src/lib/engine/scenarios.ts
import {
  StepOutcome,
  SafetyClassification,
  HypothesisStatus,
} from '@/lib/validation/engineSchemas';

export interface NextStepRule {
  outcome: StepOutcome | '*';
  nextStepId: string | null; // null indicates scenario terminal point
  stopReason?: string;
  hypothesisImpact?: Array<{
    hypothesisId: string;
    delta: number; // e.g. +0.35, -0.40
    rationale: string;
    targetStatus?: HypothesisStatus;
  }>;
  conclusion?: {
    rootCause: string;
    recommendedFixes: Array<{
      action: string;
      owner: string;
      priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      remediationType: 'IMMEDIATE_FIX' | 'PREVENTIVE_MEASURE' | 'MONITORING_UPDATE';
    }>;
    stopReason: string;
  };
}

export interface ScenarioStepDefinition {
  stepId: string;
  title: string;
  question?: string;
  isClarifyingQuestion?: boolean;
  toolName: string;
  commandTemplate: string;
  purpose: string;
  expectedResult: string;
  possibleOutcomes: StepOutcome[];
  safetyClassification: SafetyClassification;
  requiresApproval?: boolean;
  rollbackInstructions?: string;
  nextRules: NextStepRule[];
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  triggerKeywords: string[];
  applicableAssetTypes: string[];
  initialHypotheses: Array<{
    id: string;
    title: string;
    description: string;
    initialConfidence: number;
  }>;
  initialStepId: string;
  steps: Record<string, ScenarioStepDefinition>;
}

// =========================================================================
// SCENARIO 1: Server Unreachable
// =========================================================================
export const SCENARIO_SERVER_UNREACHABLE: ScenarioDefinition = {
  id: 'srv-unreachable',
  title: 'Server Unreachable or Network Interface Down',
  description: 'Deterministic investigation for unresponsive Windows/Linux servers or virtual machines.',
  category: 'INFRASTRUCTURE',
  triggerKeywords: ['unreachable', 'server down', 'cannot connect', 'offline', 'ping failed', 'timeout', 'no response'],
  applicableAssetTypes: ['SERVER', 'VIRTUAL_MACHINE'],
  initialHypotheses: [
    {
      id: 'hyp-srv-1',
      title: 'Local Subnet Gateway or Network Link Failure',
      description: 'Physical network switch link is down or default gateway dropped packet routing.',
      initialConfidence: 0.50,
    },
    {
      id: 'hyp-srv-2',
      title: 'Operating System Freeze or Hypervisor Power Fault',
      description: 'Target VM crashed, kernel panicked, or hypervisor host suspended execution.',
      initialConfidence: 0.35,
    },
    {
      id: 'hyp-srv-3',
      title: 'Firewall Policy Drop or Management Port Filtering',
      description: 'Network or host firewall is silently dropping management traffic.',
      initialConfidence: 0.30,
    },
  ],
  initialStepId: 'step-srv-q1',
  steps: {
    'step-srv-q1': {
      stepId: 'step-srv-q1',
      title: 'Clarify Failure Scope and Maintenance Status',
      isClarifyingQuestion: true,
      question: 'Is this server unreachable for all subnets or only specific users? Were any recent firewall or network changes deployed?',
      toolName: 'technician_intake',
      commandTemplate: 'N/A - Technician Clarifying Interview',
      purpose: 'Establish whether the failure is global or isolated to specific network segments.',
      expectedResult: 'Technician confirms the server is reported unreachable across multiple management subnets.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'CLARIFYING_QUESTION',
      nextRules: [
        {
          outcome: '*',
          nextStepId: 'step-srv-icmp',
        },
      ],
    },
    'step-srv-icmp': {
      stepId: 'step-srv-icmp',
      title: 'ICMP Echo Probe to Server IP',
      toolName: 'ping_icmp_probe',
      commandTemplate: 'Test-Connection -TargetName {target_ip} -Count 4',
      purpose: 'Verify basic Layer 3 network reachability and round-trip latency to the target server.',
      expectedResult: '4 replies received with 0% packet loss and round-trip latency under 15ms.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-srv-gateway',
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-1', delta: 0.30, rationale: 'ICMP timeout indicates network path failure or host is powered down.' },
            { hypothesisId: 'hyp-srv-2', delta: 0.20, rationale: 'Host unreachable may be caused by hypervisor crash.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-srv-tcp-mgmt',
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-1', delta: -0.40, rationale: 'Layer 3 ping succeeds; network route and physical link are operational.', targetStatus: 'REFUTED' },
            { hypothesisId: 'hyp-srv-3', delta: 0.35, rationale: 'Server responds to ping but application/management port may be blocked.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-srv-gateway',
        },
      ],
    },
    'step-srv-gateway': {
      stepId: 'step-srv-gateway',
      title: 'Ping Subnet Default Gateway',
      toolName: 'ping_icmp_probe',
      commandTemplate: 'Test-Connection -TargetName {gateway_ip} -Count 4',
      purpose: 'Isolate whether network failure is confined to target server or affects entire local gateway subnet.',
      expectedResult: 'Default gateway responds with 0% packet loss.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'PASSED',
          nextStepId: 'step-srv-hypervisor',
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-1', delta: -0.30, rationale: 'Default gateway is reachable; problem is isolated to host or host switchport.' },
            { hypothesisId: 'hyp-srv-2', delta: 0.35, rationale: 'Gateway is up, confirming hypervisor or VM state as primary suspect.' },
          ],
        },
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-1', delta: 0.45, rationale: 'Default gateway is completely unreachable; upstream network failure confirmed.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Subnet Default Gateway or Core Switch Uplink is offline, disconnecting the entire subnet segment.',
            recommendedFixes: [
              { action: 'Inspect Top-of-Rack switch status and core trunk ports', owner: 'Network Engineering', priority: 'CRITICAL', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Verify gateway VRRP / HSRP redundancy state', owner: 'Network Engineering', priority: 'HIGH', remediationType: 'PREVENTIVE_MEASURE' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-srv-hypervisor',
        },
      ],
    },
    'step-srv-hypervisor': {
      stepId: 'step-srv-hypervisor',
      title: 'Query Hypervisor VM Power State & Console',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-VM -Name "{hostname}" | Select-Object Name, State, Status, Uptime',
      purpose: 'Inspect virtual machine power status and CPU utilization directly via hypervisor management plane.',
      expectedResult: 'VM state is Running and status is Operating Normally.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-2', delta: 0.60, rationale: 'Hypervisor confirms VM is stopped or guest OS kernel panicked.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Virtual Machine guest operating system crashed (BSOD / Kernel Panic) or was powered down unexpectedly.',
            recommendedFixes: [
              { action: 'Inspect hypervisor console log and restart VM instance', owner: 'Virtualization Team', priority: 'CRITICAL', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Analyze OS crash dump file for faulty drivers or memory exhaustion', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'PREVENTIVE_MEASURE' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-srv-nic',
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-2', delta: -0.25, rationale: 'VM is powered on and healthy on hypervisor; virtual NIC binding suspect.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          conclusion: {
            rootCause: 'Investigation inconclusive: hypervisor status could not be verified.',
            recommendedFixes: [
              { action: 'Physically inspect server console or request on-site datacenter technician check', owner: 'Datacenter Ops', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ESCALATION_REQUIRED',
          },
        },
      ],
    },
    'step-srv-nic': {
      stepId: 'step-srv-nic',
      title: 'Audit Virtual Network Adapter Link & Port Group',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-VMNetworkAdapter -VMName "{hostname}" | Select-Object SwitchName, Status, IPAddresses',
      purpose: 'Check if virtual NIC is connected to correct VLAN portgroup and has assigned IP address.',
      expectedResult: 'Status is Ok, connected to Production VLAN portgroup with correct IP address.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-1', delta: 0.45, rationale: 'Virtual network adapter disconnected or assigned to invalid VLAN.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Virtual NIC disconnected or misconfigured port group on hypervisor virtual switch.',
            recommendedFixes: [
              { action: 'Re-attach vNIC to production VLAN port group', owner: 'Systems Administration', priority: 'CRITICAL', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          conclusion: {
            rootCause: 'Server network configuration appears normal; host OS may have disabled interface internally.',
            recommendedFixes: [
              { action: 'Open out-of-band iLO/iDRAC console to inspect local OS network adapter status', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ESCALATION_REQUIRED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-srv-tcp-mgmt': {
      stepId: 'step-srv-tcp-mgmt',
      title: 'Probe Remote Management TCP Port (RDP 3389 / SSH 22)',
      toolName: 'socket_port_probe',
      commandTemplate: 'Test-NetConnection -ComputerName {target_ip} -Port 3389',
      purpose: 'Verify if remote desktop / administrative management service is listening on TCP socket.',
      expectedResult: 'TcpTestSucceeded is True.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'PASSED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-3', delta: -0.20, rationale: 'RDP port is open and accepting socket connections.' },
          ],
          conclusion: {
            rootCause: 'Server is fully reachable and accepting administrative connections; issue is isolated to client application or authentication.',
            recommendedFixes: [
              { action: 'Verify client user account permissions and RDP licensing status', owner: 'Service Desk', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-srv-3', delta: 0.65, rationale: 'Ping succeeds but management port is closed or filtered by firewall.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Host Windows Firewall or perimeter security policy is blocking TCP port 3389/22, or TermService is stopped.',
            recommendedFixes: [
              { action: 'Verify Windows Firewall inbound Remote Desktop rules and TermService status', owner: 'Security Operations', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
  },
};

// =========================================================================
// SCENARIO 2: Printer Unavailable or Print Queue Stuck
// =========================================================================
export const SCENARIO_PRINTER_UNAVAILABLE: ScenarioDefinition = {
  id: 'printer-stuck',
  title: 'Printer Unavailable or Print Queue Deadlocked',
  description: 'Deterministic troubleshooting for offline network printers, jammed queues, and spooler failures.',
  category: 'HARDWARE',
  triggerKeywords: ['printer', 'print queue', 'spooler', 'cannot print', 'printing', 'job stuck', 'printer offline'],
  applicableAssetTypes: ['PRINTER'],
  initialHypotheses: [
    {
      id: 'hyp-prt-1',
      title: 'Corrupted Print Job Deadlocking Print Spooler',
      description: 'A malformed document is stalled in the spool directory, halting queue processing.',
      initialConfidence: 0.50,
    },
    {
      id: 'hyp-prt-2',
      title: 'Printer Physical Link Offline or IP Address Mismatch',
      description: 'Printer is powered off, ethernet cable disconnected, or DHCP lease expired.',
      initialConfidence: 0.40,
    },
    {
      id: 'hyp-prt-3',
      title: 'Print Spooler Windows Service Terminated',
      description: 'The local or server-side Print Spooler service stopped unexpectedly.',
      initialConfidence: 0.30,
    },
  ],
  initialStepId: 'step-prt-q1',
  steps: {
    'step-prt-q1': {
      stepId: 'step-prt-q1',
      title: 'Clarify Printer Display & Paper/Toner Status',
      isClarifyingQuestion: true,
      question: 'Is the printer control panel LCD illuminated, and does it report an error code (Paper Jam, Cover Open, or Offline)?',
      toolName: 'technician_intake',
      commandTemplate: 'N/A - Physical Inspection Query',
      purpose: 'Rule out basic physical interventions such as paper feed jams or open access panels.',
      expectedResult: 'Technician confirms display is powered and reports Ready or Offline with no physical jam.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'CLARIFYING_QUESTION',
      nextRules: [
        {
          outcome: '*',
          nextStepId: 'step-prt-icmp',
        },
      ],
    },
    'step-prt-icmp': {
      stepId: 'step-prt-icmp',
      title: 'ICMP Echo Probe to Printer Network Interface',
      toolName: 'ping_icmp_probe',
      commandTemplate: 'Test-Connection -TargetName {target_ip} -Count 4',
      purpose: 'Verify network connectivity to printer internal network interface card.',
      expectedResult: 'Printer responds with 4 successful echo replies.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-prt-arp',
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-2', delta: 0.45, rationale: 'Printer fails to respond to ICMP ping; hardware or network interface offline.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-prt-spooler',
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-2', delta: -0.40, rationale: 'Printer IP is reachable on local network; hardware link is verified.', targetStatus: 'REFUTED' },
            { hypothesisId: 'hyp-prt-1', delta: 0.25, rationale: 'Network is healthy; spooler or queue logic suspect.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-prt-spooler',
        },
      ],
    },
    'step-prt-arp': {
      stepId: 'step-prt-arp',
      title: 'Inspect Local ARP Cache for Printer MAC Address',
      toolName: 'vpn_route_audit',
      commandTemplate: 'arp -a | findstr {target_ip}',
      purpose: 'Determine if target IP is bound to a physical MAC address on local switch.',
      expectedResult: 'A valid dynamic physical address (MAC) is present for target printer IP.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-2', delta: 0.50, rationale: 'No ARP entry exists; printer ethernet cable disconnected or device powered off.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Printer hardware is powered off or disconnected from network wall port.',
            recommendedFixes: [
              { action: 'Check printer power cable, power switch, and verify ethernet link LED status', owner: 'Desktop Support', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Patch printer to active network switchport', owner: 'Network Engineering', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-prt-spooler',
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-prt-spooler': {
      stepId: 'step-prt-spooler',
      title: 'Query Windows Print Spooler Service Status',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-Service -Name Spooler',
      purpose: 'Check if the Windows Print Spooler background service is active.',
      expectedResult: 'Service status is Running.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-3', delta: 0.65, rationale: 'Print Spooler service is stopped or disabled.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Windows Print Spooler service is stopped, preventing all print jobs from spooling.',
            recommendedFixes: [
              { action: 'Start the Print Spooler service via Service Control Manager or PowerShell: Start-Service Spooler', owner: 'Desktop Support', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Set Spooler startup type to Automatic', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'PREVENTIVE_MEASURE' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-prt-jobs',
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-3', delta: -0.30, rationale: 'Spooler service is running normally.', targetStatus: 'REFUTED' },
            { hypothesisId: 'hyp-prt-1', delta: 0.35, rationale: 'Service running; check queue for stalled jobs.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-prt-jobs',
        },
      ],
    },
    'step-prt-jobs': {
      stepId: 'step-prt-jobs',
      title: 'Audit Print Queue for Stalled Jobs',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-PrintJob -PrinterName "{asset_name}" | Select-Object Id, DocumentName, JobStatus, SubmittedTime',
      purpose: 'Identify any deadlocked print jobs blocking subsequent documents.',
      expectedResult: 'Queue contains zero stalled jobs with Error status.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-1', delta: 0.45, rationale: 'Print job in Error or Deleting status is deadlocking the queue.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'A corrupted or oversized document is stalled in the print queue, blocking all subsequent print jobs.',
            recommendedFixes: [
              { action: 'Cancel and purge stalled print jobs: Remove-PrintJob -PrinterName "{asset_name}" -ID <jobId>', owner: 'Desktop Support', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Clear spool files in C:\\Windows\\System32\\spool\\PRINTERS if queue remains locked', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-prt-port9100',
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-prt-port9100': {
      stepId: 'step-prt-port9100',
      title: 'Probe RAW JetDirect TCP Port 9100',
      toolName: 'socket_port_probe',
      commandTemplate: 'Test-NetConnection -ComputerName {target_ip} -Port 9100',
      purpose: 'Check if printer is actively listening on RAW printing port 9100.',
      expectedResult: 'TcpTestSucceeded is True.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'PASSED',
          nextStepId: null,
          conclusion: {
            rootCause: 'Printer hardware, network interface, and spooler are operational; print driver corruption suspected.',
            recommendedFixes: [
              { action: 'Reinstall or update the printer driver from manufacturer package', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-prt-2', delta: 0.40, rationale: 'Port 9100 closed or printer internal print server hung.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Printer JetDirect print daemon hung or port 9100 blocked by internal firmware freeze.',
            recommendedFixes: [
              { action: 'Power cycle the printer to restart internal network print daemon', owner: 'Desktop Support', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
  },
};

// =========================================================================
// SCENARIO 3: Shared File Inaccessible
// =========================================================================
export const SCENARIO_SHARED_FILE_INACCESSIBLE: ScenarioDefinition = {
  id: 'share-inaccessible',
  title: 'Shared File or SMB Share Inaccessible',
  description: 'Deterministic triage for SMB file share access errors, permission denials, and network path errors.',
  category: 'STORAGE',
  triggerKeywords: ['shared folder', 'file share', 'smb', 'unc path', 'access denied', '0x80070035', 'network path not found'],
  applicableAssetTypes: ['SHARED_FOLDER', 'STORAGE', 'SERVER'],
  initialHypotheses: [
    {
      id: 'hyp-shr-1',
      title: 'SMB Port 445 Blocked or Server Service Stopped',
      description: 'TCP port 445 is unreachable over the network or Server service on host is stopped.',
      initialConfidence: 0.50,
    },
    {
      id: 'hyp-shr-2',
      title: 'NTFS Security ACL or Share Permission Denial',
      description: 'The user or group is missing Read/Write permissions on the NTFS volume or SMB share ACL.',
      initialConfidence: 0.45,
    },
    {
      id: 'hyp-shr-3',
      title: 'Kerberos Ticket Expiration or SPN Mismatch',
      description: 'Client authentication token is invalid or domain controller cannot validate CIFS SPN.',
      initialConfidence: 0.30,
    },
  ],
  initialStepId: 'step-shr-q1',
  steps: {
    'step-shr-q1': {
      stepId: 'step-shr-q1',
      title: 'Clarify Exact Error Code and User Credentials',
      isClarifyingQuestion: true,
      question: 'Does Windows report "0x80070035 Network Path Not Found" or "0x80070005 Access is Denied" when browsing the UNC path?',
      toolName: 'technician_intake',
      commandTemplate: 'N/A - Clarifying Error Assessment',
      purpose: 'Distinguish network transport failures (Path Not Found) from authorization failures (Access Denied).',
      expectedResult: 'Technician inputs the exact error message observed by user.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'CLARIFYING_QUESTION',
      nextRules: [
        {
          outcome: '*',
          nextStepId: 'step-shr-smb-port',
        },
      ],
    },
    'step-shr-smb-port': {
      stepId: 'step-shr-smb-port',
      title: 'Test SMB TCP Port 445 Connectivity',
      toolName: 'socket_port_probe',
      commandTemplate: 'Test-NetConnection -ComputerName {hostname} -Port 445',
      purpose: 'Verify if the host is accepting SMB file sharing connections over port 445.',
      expectedResult: 'TcpTestSucceeded is True.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-shr-dns',
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-1', delta: 0.40, rationale: 'SMB port 445 is unreachable; firewall block or server service stopped.' },
            { hypothesisId: 'hyp-shr-2', delta: -0.30, rationale: 'Network path is down before permissions can be evaluated.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-shr-path',
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-1', delta: -0.40, rationale: 'Port 445 is open and accepting SMB traffic.', targetStatus: 'REFUTED' },
            { hypothesisId: 'hyp-shr-2', delta: 0.35, rationale: 'Network is healthy; authorization or ACL is probable root cause.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-shr-dns',
        },
      ],
    },
    'step-shr-dns': {
      stepId: 'step-shr-dns',
      title: 'Resolve File Server Hostname in DNS',
      toolName: 'dns_resolver_probe',
      commandTemplate: 'Resolve-DnsName -Name {hostname}',
      purpose: 'Verify that client can resolve the file server hostname to an active IP address.',
      expectedResult: 'Returns active IP address of target file server.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-1', delta: 0.50, rationale: 'DNS resolution failure prevents client from locating SMB server.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'DNS record for file server is missing or invalid, causing Network Path Not Found.',
            recommendedFixes: [
              { action: 'Add or update host A record for file server in primary DNS forward lookup zone', owner: 'Network Engineering', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-1', delta: 0.45, rationale: 'DNS resolves but port 445 is closed; server service down or firewall block.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'File server LanmanServer service is stopped or perimeter firewall dropped SMB port 445.',
            recommendedFixes: [
              { action: 'Start Server service (LanmanServer) on host and check firewall rule for TCP 445', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-shr-path': {
      stepId: 'step-shr-path',
      title: 'Test Share Path Access via Administrative Session',
      toolName: 'ntfs_permission_audit',
      commandTemplate: 'Test-Path "\\\\{hostname}\\{share_name}"',
      purpose: 'Check if the share folder exists and can be enumerated by an administrative technician token.',
      expectedResult: 'Returns True.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-shr-acl',
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-2', delta: 0.40, rationale: 'Share path returned access denied even for technician probe.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-shr-acl',
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-2', delta: 0.20, rationale: 'Share exists and is accessible; check specific user group ACL.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-shr-acl',
        },
      ],
    },
    'step-shr-acl': {
      stepId: 'step-shr-acl',
      title: 'Audit NTFS Access Control List (ACL) Permissions',
      toolName: 'ntfs_permission_audit',
      commandTemplate: 'icacls "\\\\{hostname}\\{share_name}"',
      purpose: 'Inspect security descriptor permissions for affected department security group.',
      expectedResult: 'Affected user security group is listed with Read & Execute or Full Control permissions.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-2', delta: 0.55, rationale: 'Required user security group is missing from NTFS ACL permissions.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'NTFS Access Control List (ACL) permissions missing for user security group.',
            recommendedFixes: [
              { action: 'Grant required security group Modify/Read permissions on target folder: icacls <path> /grant "CORP\\Group":(OI)(CI)M', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-shr-kerberos',
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-shr-kerberos': {
      stepId: 'step-shr-kerberos',
      title: 'Check Kerberos Ticket Cache for CIFS SPN',
      toolName: 'ntfs_permission_audit',
      commandTemplate: 'klist get cifs/{hostname}',
      purpose: 'Verify that client workstation holds a valid unexpired Kerberos service ticket for file server.',
      expectedResult: 'Valid Kerberos ticket retrieved with end time in future.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-shr-3', delta: 0.60, rationale: 'Kerberos ticket request failed or returned expired token.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Kerberos authentication failed due to ticket expiration or clock skew between client and Domain Controller.',
            recommendedFixes: [
              { action: 'Purge Kerberos ticket cache on client: klist purge', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Resynchronize client clock with domain controller: w32tm /resync', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          conclusion: {
            rootCause: 'Permissions and Kerberos are valid; client offline files cache synchronization conflict suspected.',
            recommendedFixes: [
              { action: 'Reset Windows Offline Files cache on user workstation via CSC database re-initialization', owner: 'Desktop Support', priority: 'LOW', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
  },
};

// =========================================================================
// SCENARIO 4: DNS Resolution Failure
// =========================================================================
export const SCENARIO_DNS_FAILURE: ScenarioDefinition = {
  id: 'dns-failure',
  title: 'DNS Name Resolution Failure',
  description: 'Deterministic diagnostics for unresolved domain names, stale DNS caches, and authoritative server dropouts.',
  category: 'NETWORK',
  triggerKeywords: ['dns', 'name resolution', 'nslookup', 'fqdn', 'resolve-dnsname', 'cannot resolve', 'unknown host', 'dns failure'],
  applicableAssetTypes: ['SERVER', 'APPLICATION', 'ROUTER'],
  initialHypotheses: [
    {
      id: 'hyp-dns-1',
      title: 'Stale or Negative DNS Client Cache Entry',
      description: 'The client resolver is serving a cached negative response or obsolete IP mapping.',
      initialConfidence: 0.50,
    },
    {
      id: 'hyp-dns-2',
      title: 'Authoritative Corporate DNS Server Service Down',
      description: 'Primary internal DNS server is unreachable or DNS Server service is halted.',
      initialConfidence: 0.45,
    },
    {
      id: 'hyp-dns-3',
      title: 'Missing or Deleted Host (A/AAAA) Forward Record',
      description: 'The DNS zone file lacks an active record for the requested hostname.',
      initialConfidence: 0.35,
    },
  ],
  initialStepId: 'step-dns-q1',
  steps: {
    'step-dns-q1': {
      stepId: 'step-dns-q1',
      title: 'Clarify Failing Hostname and Scope',
      isClarifyingQuestion: true,
      question: 'Which exact Fully Qualified Domain Name (FQDN) is failing to resolve, and does external internet resolution work?',
      toolName: 'technician_intake',
      commandTemplate: 'N/A - Intake Query',
      purpose: 'Establish exact target FQDN and isolate local workstation scope vs enterprise wide scope.',
      expectedResult: 'Technician specifies internal FQDN (e.g. srv-app-01.corp.internal).',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'CLARIFYING_QUESTION',
      nextRules: [
        {
          outcome: '*',
          nextStepId: 'step-dns-resolve-primary',
        },
      ],
    },
    'step-dns-resolve-primary': {
      stepId: 'step-dns-resolve-primary',
      title: 'Query Primary Corporate DNS Server for Host Record',
      toolName: 'dns_resolver_probe',
      commandTemplate: 'Resolve-DnsName -Name {hostname} -Server {dns_ip}',
      purpose: 'Query authoritative DNS server directly, bypassing client workstation local cache.',
      expectedResult: 'Returns valid IPv4 A record for target hostname.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-dns-server-reachability',
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-2', delta: 0.35, rationale: 'Primary DNS server query failed; server health or missing record suspect.' },
            { hypothesisId: 'hyp-dns-1', delta: -0.30, rationale: 'Direct server query failed, so client cache alone is not the sole issue.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-dns-client-cache',
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-2', delta: -0.40, rationale: 'Primary DNS server is healthy and returned valid record.', targetStatus: 'REFUTED' },
            { hypothesisId: 'hyp-dns-1', delta: 0.45, rationale: 'Server has record, but client fails; stale local client cache probable.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-dns-server-reachability',
        },
      ],
    },
    'step-dns-server-reachability': {
      stepId: 'step-dns-server-reachability',
      title: 'Test Reachability to Primary DNS Server IP',
      toolName: 'ping_icmp_probe',
      commandTemplate: 'Test-Connection -TargetName {dns_ip} -Count 4',
      purpose: 'Determine if DNS server machine is reachable over network.',
      expectedResult: '4 echo replies received with 0% loss.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-2', delta: 0.55, rationale: 'Primary DNS server is completely offline on the network.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Primary Corporate DNS Server (10.0.1.10) is offline or unreachable on the network.',
            recommendedFixes: [
              { action: 'Investigate physical server / VM state of DC-DNS-01 and restore network reachability', owner: 'Systems Administration', priority: 'CRITICAL', remediationType: 'IMMEDIATE_FIX' },
              { action: 'Ensure secondary DNS server is properly configured on DHCP client scope', owner: 'Network Engineering', priority: 'HIGH', remediationType: 'PREVENTIVE_MEASURE' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-dns-port53',
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-dns-port53': {
      stepId: 'step-dns-port53',
      title: 'Probe DNS UDP/TCP Port 53 on Server',
      toolName: 'socket_port_probe',
      commandTemplate: 'Test-NetConnection -ComputerName {dns_ip} -Port 53',
      purpose: 'Check if DNS daemon is listening on port 53.',
      expectedResult: 'TcpTestSucceeded is True.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-2', delta: 0.50, rationale: 'Server responds to ping but DNS port 53 is closed or filtered.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'DNS Server service (DNS) on DC-DNS-01 is stopped or port 53 is blocked by firewall.',
            recommendedFixes: [
              { action: 'Start DNS Server service on DC-DNS-01: Start-Service DNS', owner: 'Systems Administration', priority: 'CRITICAL', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-3', delta: 0.65, rationale: 'DNS server is listening and reachable, but FQDN record does not exist in zone.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'The target hostname record is missing or expired from the authoritative DNS Forward Lookup Zone.',
            recommendedFixes: [
              { action: 'Create static A record in Active Directory Integrated DNS zone or verify dynamic DNS client registration', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
    'step-dns-client-cache': {
      stepId: 'step-dns-client-cache',
      title: 'Audit Client Local DNS Cache for Negative Response',
      toolName: 'dns_resolver_probe',
      commandTemplate: 'Get-DnsClientCache -Entry "{hostname}"',
      purpose: 'Check if client workstation holds a cached negative lookup entry.',
      expectedResult: 'Local cache contains either valid A record or no negative cache entry.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-dns-1', delta: 0.55, rationale: 'Client cache contains negative TTL entry, suppressing valid DNS responses.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Workstation DNS Client cache contains a negative TTL entry, preventing connection to host.',
            recommendedFixes: [
              { action: 'Flush client DNS resolver cache: Clear-DnsClientCache', owner: 'Desktop Support', priority: 'MEDIUM', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          conclusion: {
            rootCause: 'DNS resolution is functional; client application issue or local hosts file override suspected.',
            recommendedFixes: [
              { action: 'Audit C:\\Windows\\System32\\drivers\\etc\\hosts for conflicting static mappings', owner: 'Desktop Support', priority: 'LOW', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
  },
};

// =========================================================================
// SCENARIO 5: Windows Service Failure
// =========================================================================
export const SCENARIO_WINDOWS_SERVICE_FAILURE: ScenarioDefinition = {
  id: 'service-failure',
  title: 'Windows Service Crash or Failure to Start',
  description: 'Deterministic root-cause investigation for stopped Windows background services and Service Control Manager crashes.',
  category: 'APPLICATION',
  triggerKeywords: ['service failed', 'service stopped', 'windows service', 'service crash', '7000', '7034', '7009', 'service failure'],
  applicableAssetTypes: ['SERVER', 'WORKSTATION', 'SERVICE', 'APPLICATION'],
  initialHypotheses: [
    {
      id: 'hyp-svc-1',
      title: 'Service Account Logon Failure or Expired Password',
      description: 'The configured logon account credentials expired or account lacks "Log on as a service" privilege.',
      initialConfidence: 0.45,
    },
    {
      id: 'hyp-svc-2',
      title: 'Unmet Service Dependency Stopped',
      description: 'A prerequisite background service required by this service is stopped or failed.',
      initialConfidence: 0.45,
    },
    {
      id: 'hyp-svc-3',
      title: 'Application Binary Crash or Corrupt Config File',
      description: 'The executable exited with an unhandled exception or malformed initialization configuration.',
      initialConfidence: 0.35,
    },
  ],
  initialStepId: 'step-svc-q1',
  steps: {
    'step-svc-q1': {
      stepId: 'step-svc-q1',
      title: 'Clarify Service Name and Failure Occurrence',
      isClarifyingQuestion: true,
      question: 'What is the exact service name, and did it crash during runtime or fail immediately upon manual start?',
      toolName: 'technician_intake',
      commandTemplate: 'N/A - Service Clarification Query',
      purpose: 'Establish exact service identifier for PowerShell queries.',
      expectedResult: 'Technician provides exact service name (e.g. W3SVC, Spooler, MSSQLSERVER).',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'CLARIFYING_QUESTION',
      nextRules: [
        {
          outcome: '*',
          nextStepId: 'step-svc-status',
        },
      ],
    },
    'step-svc-status': {
      stepId: 'step-svc-status',
      title: 'Query Windows Service State & Startup Mode',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-Service -Name "{service_name}" | Select-Object Name, Status, StartType',
      purpose: 'Inspect current runtime state (Running, Stopped, StartPending) and startup configuration.',
      expectedResult: 'Service status is Running.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-svc-eventlog',
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-1', delta: 0.20, rationale: 'Confirmed service is in Stopped state.' },
            { hypothesisId: 'hyp-svc-2', delta: 0.20, rationale: 'Service stopped; check dependencies and event log.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          conclusion: {
            rootCause: 'Service is currently Running and operational; failure may have been transient.',
            recommendedFixes: [
              { action: 'Inspect uptime and monitor for intermittent crash cycles', owner: 'Systems Administration', priority: 'LOW', remediationType: 'MONITORING_UPDATE' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-svc-eventlog',
        },
      ],
    },
    'step-svc-eventlog': {
      stepId: 'step-svc-eventlog',
      title: 'Query Windows System Event Log for SCM Error Events',
      toolName: 'event_log_query',
      commandTemplate: 'Get-WinEvent -FilterHashtable @{LogName=\'System\'; Id=7000,7009,7034} -MaxEvents 5',
      purpose: 'Extract the termination error message recorded by Service Control Manager.',
      expectedResult: 'Identifies specific SCM event ID (7000: Logon Failure, 7009: Timeout, 7034: Crash).',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: 'step-svc-account',
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-1', delta: 0.40, rationale: 'Event 7000 recorded: The service failed to start due to logon failure.' },
          ],
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-svc-dependencies',
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-2', delta: 0.35, rationale: 'Event indicates dependency failure or clean exit.' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-svc-dependencies',
        },
      ],
    },
    'step-svc-dependencies': {
      stepId: 'step-svc-dependencies',
      title: 'Audit Required Dependent Services Status',
      toolName: 'service_status_probe',
      commandTemplate: '(Get-Service -Name "{service_name}").RequiredServices | Select-Object Name, Status',
      purpose: 'Check if any upstream service prerequisite is stopped.',
      expectedResult: 'All required dependent services report Running status.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-2', delta: 0.55, rationale: 'One or more required dependent services are stopped.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Required dependent service is stopped, preventing this service from starting.',
            recommendedFixes: [
              { action: 'Start dependent services and configure their Startup Type to Automatic', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: 'step-svc-account',
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-2', delta: -0.35, rationale: 'All dependencies are healthy.', targetStatus: 'REFUTED' },
          ],
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: 'step-svc-account',
        },
      ],
    },
    'step-svc-account': {
      stepId: 'step-svc-account',
      title: 'Inspect Service Logon Identity and Exit Code',
      toolName: 'service_status_probe',
      commandTemplate: 'Get-WmiObject win32_service -Filter "name=\'{service_name}\'" | Select-Object StartName, State, ExitCode',
      purpose: 'Determine if service runs as domain service account with exit code 1069 (Logon Failure).',
      expectedResult: 'ExitCode is 0 and StartName account is valid.',
      possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
      safetyClassification: 'SAFE_READ_ONLY',
      nextRules: [
        {
          outcome: 'FAILED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-1', delta: 0.55, rationale: 'Service exit code 1069 confirms service account logon failure.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Service account password expired or account lacks "Log on as a service" right.',
            recommendedFixes: [
              { action: 'Update service account password in Services snap-in (services.msc) and ensure "Log on as a service" user right in secpol.msc', owner: 'Systems Administration', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'PASSED',
          nextStepId: null,
          hypothesisImpact: [
            { hypothesisId: 'hyp-svc-3', delta: 0.50, rationale: 'Dependencies and account are valid; binary crash or configuration corrupt.', targetStatus: 'CONFIRMED' },
          ],
          conclusion: {
            rootCause: 'Application binary crashed due to unhandled exception or corrupted configuration file.',
            recommendedFixes: [
              { action: 'Inspect application error log in C:\\ProgramData or event viewer Application log', owner: 'Application Support', priority: 'HIGH', remediationType: 'IMMEDIATE_FIX' },
            ],
            stopReason: 'ROOT_CAUSE_IDENTIFIED',
          },
        },
        {
          outcome: 'INCONCLUSIVE',
          nextStepId: null,
          stopReason: 'ESCALATION_REQUIRED',
        },
      ],
    },
  },
};

// =========================================================================
// SCENARIO REGISTRY
// =========================================================================
export const SCENARIO_REGISTRY: Record<string, ScenarioDefinition> = {
  'srv-unreachable': SCENARIO_SERVER_UNREACHABLE,
  'printer-stuck': SCENARIO_PRINTER_UNAVAILABLE,
  'share-inaccessible': SCENARIO_SHARED_FILE_INACCESSIBLE,
  'dns-failure': SCENARIO_DNS_FAILURE,
  'service-failure': SCENARIO_WINDOWS_SERVICE_FAILURE,
};

export function getAllScenarios(): ScenarioDefinition[] {
  return Object.values(SCENARIO_REGISTRY);
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_REGISTRY[id];
}
