// src/lib/data/demoData.ts
import { Asset, AssetDependency } from '@/types/asset';
import { Incident } from '@/types/incident';

export const DEMO_ASSETS: Asset[] = [
  {
    id: 'ast-101',
    assetTag: 'DC-DNS-01',
    name: 'Primary Domain Controller & DNS',
    assetType: 'SERVER',
    hostname: 'dc-dns-01.corp.internal',
    ipAddress: '10.0.1.10',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Server 2022 Datacenter',
    location: 'Primary Datacenter - Rack A01',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'Primary Active Directory Domain Services, Kerberos KDC, and DNS master zone holder.',
    isDemo: true,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-10-20T14:30:00Z'
  },
  {
    id: 'ast-102',
    assetTag: 'DC-DNS-02',
    name: 'Secondary Domain Controller',
    assetType: 'SERVER',
    hostname: 'dc-dns-02.corp.internal',
    ipAddress: '10.0.1.11',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Server 2022 Datacenter',
    location: 'Disaster Recovery Site - Rack D02',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'Secondary DNS replication node and backup Kerberos authenticator.',
    isDemo: true,
    createdAt: '2026-01-15T08:30:00Z',
    updatedAt: '2026-10-22T09:15:00Z'
  },
  {
    id: 'ast-103',
    assetTag: 'FS-CORP-01',
    name: 'Corporate Central File Server',
    assetType: 'SERVER',
    hostname: 'fs01.corp.internal',
    ipAddress: '10.200.4.50',
    subnet: '10.200.4.0/24',
    operatingSystem: 'Windows Server 2019 Standard',
    location: 'Primary Datacenter - Rack B04',
    criticality: 'TIER_2_HIGH',
    status: 'OPERATIONAL',
    notes: 'Hosts departmental SMB 3.0 file shares (Finance, Legal, Engineering, Executive).',
    isDemo: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-10-24T11:00:00Z'
  },
  {
    id: 'ast-104',
    assetTag: 'FW-EDGE-01',
    name: 'Corporate Perimeter Firewall & VPN Concentrator',
    assetType: 'FIREWALL',
    hostname: 'fw-edge-01.corp.internal',
    ipAddress: '10.0.0.1',
    subnet: '10.0.0.0/24',
    operatingSystem: 'FortiOS 7.4.2',
    location: 'Primary Datacenter - Edge Gateway Rack',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'Manages SSL-VPN endpoint pool (172.16.50.0/24) and border NAT policies.',
    isDemo: true,
    createdAt: '2026-01-10T12:00:00Z',
    updatedAt: '2026-10-24T16:00:00Z'
  },
  {
    id: 'ast-105',
    assetTag: 'SW-CORE-01',
    name: 'Core Distribution Switch Stack',
    assetType: 'NETWORK_DEVICE',
    hostname: 'sw-core-01.corp.internal',
    ipAddress: '10.0.1.1',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Cisco IOS-XE 17.9',
    location: 'Primary Datacenter - Core Rack',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'L3 routing between VLAN 10 (Servers), VLAN 20 (Workstations), and VLAN 50 (VPN).',
    isDemo: true,
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z'
  },
  {
    id: 'ast-106',
    assetTag: 'HYPER-NODE-02',
    name: 'VMware ESXi Compute Node 02',
    assetType: 'SERVER',
    hostname: 'esxi-02.corp.internal',
    ipAddress: '10.0.1.42',
    subnet: '10.0.1.0/24',
    operatingSystem: 'VMware ESXi 8.0 Update 2',
    location: 'Primary Datacenter - Cluster Blade 02',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'Hosts production database and backend accounting virtual machines.',
    isDemo: true,
    createdAt: '2026-01-20T11:00:00Z',
    updatedAt: '2026-10-21T15:20:00Z'
  },
  {
    id: 'ast-107',
    assetTag: 'SRV-SQL-01',
    name: 'Production ERP MSSQL Database Server',
    assetType: 'VIRTUAL_MACHINE',
    hostname: 'sql-prod-01.corp.internal',
    ipAddress: '10.0.1.65',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Server 2022 / SQL Server 2022',
    location: 'Virtual Cluster (on HYPER-NODE-02)',
    criticality: 'TIER_1_CRITICAL',
    status: 'DEGRADED',
    notes: 'Hosts core ERP financial database. Volume D: allocated for SQL transaction logs.',
    isDemo: true,
    createdAt: '2026-02-10T14:00:00Z',
    updatedAt: '2026-10-24T13:00:00Z'
  },
  {
    id: 'ast-108',
    assetTag: 'SRV-PRINT-01',
    name: 'Enterprise Print Server',
    assetType: 'SERVER',
    hostname: 'print01.corp.internal',
    ipAddress: '10.0.1.90',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Server 2019 Standard',
    location: 'Primary Datacenter - Rack C02',
    criticality: 'TIER_3_MEDIUM',
    status: 'DEGRADED',
    notes: 'Manages print queues for warehouse thermal printers and office laser printers.',
    isDemo: true,
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-10-24T15:30:00Z'
  },
  {
    id: 'ast-109',
    assetTag: 'EXEC-LT-04',
    name: 'VP Finance Executive Laptop',
    assetType: 'LAPTOP',
    hostname: 'lt-exec-04.corp.internal',
    ipAddress: '172.16.50.14',
    subnet: '172.16.50.0/24',
    operatingSystem: 'Windows 11 Enterprise 23H2',
    location: 'Remote Teleworker (Connected via SSL-VPN)',
    criticality: 'TIER_2_HIGH',
    status: 'OPERATIONAL',
    notes: 'Primary executive client reporting VPN file access failures.',
    isDemo: true,
    createdAt: '2026-04-12T10:00:00Z',
    updatedAt: '2026-10-24T17:00:00Z'
  },
  {
    id: 'ast-110',
    assetTag: 'FIN-WS-012',
    name: 'Accounting Department Workstation 12',
    assetType: 'WORKSTATION',
    hostname: 'ws-fin-012.corp.internal',
    ipAddress: '10.0.20.112',
    subnet: '10.0.20.0/24',
    operatingSystem: 'Windows 11 Enterprise 23H2',
    location: 'Headquarters Building - Floor 3 Accounting',
    criticality: 'TIER_3_MEDIUM',
    status: 'OPERATIONAL',
    notes: 'Client experiencing internal ERP domain resolution timeouts.',
    isDemo: true,
    createdAt: '2026-04-15T09:30:00Z',
    updatedAt: '2026-10-24T12:00:00Z'
  },
  {
    id: 'ast-111',
    assetTag: 'PRN-WH-01',
    name: 'Warehouse High-Speed Thermal Shipping Printer',
    assetType: 'PRINTER',
    hostname: 'prn-wh-01.corp.internal',
    ipAddress: '10.0.30.55',
    subnet: '10.0.30.0/24',
    operatingSystem: 'Zebra ZT411 Firmware v84',
    location: 'Logistics Facility - Shipping Dock 4',
    criticality: 'TIER_2_HIGH',
    status: 'OFFLINE',
    notes: 'Prints packing slips and carrier shipping labels; queued on SRV-PRINT-01.',
    isDemo: true,
    createdAt: '2026-05-01T11:00:00Z',
    updatedAt: '2026-10-24T16:15:00Z'
  },
  {
    id: 'ast-112',
    assetTag: 'SAN-VOL-03',
    name: 'PureStorage FlashArray Volume 03 (SQL)',
    assetType: 'STORAGE',
    hostname: 'san-array-01.corp.internal',
    ipAddress: '10.0.100.22',
    subnet: '10.0.100.0/24',
    operatingSystem: 'Purity//FA 6.4.8',
    location: 'Primary Datacenter - Storage Rack S01',
    criticality: 'TIER_1_CRITICAL',
    status: 'OPERATIONAL',
    notes: 'NVMe-oF datastore hosting SRV-SQL-01 database virtual disk files.',
    isDemo: true,
    createdAt: '2026-01-08T08:00:00Z',
    updatedAt: '2026-10-23T18:00:00Z'
  },
  {
    id: 'ast-113',
    assetTag: 'SHR-ENG-01',
    name: 'Engineering Department Shared SMB Folder',
    assetType: 'SHARED_FOLDER',
    hostname: 'fs01.corp.internal',
    ipAddress: '10.200.4.50',
    subnet: '10.200.4.0/24',
    operatingSystem: 'NTFS Filesystem (on FS-CORP-01)',
    location: 'Logical Share: \\fs01.corp.internal\\Engineering',
    criticality: 'TIER_2_HIGH',
    status: 'OPERATIONAL',
    notes: 'Restricted share governed by Active Directory security groups.',
    isDemo: true,
    createdAt: '2026-02-15T13:00:00Z',
    updatedAt: '2026-10-24T14:00:00Z'
  },
  {
    id: 'ast-114',
    assetTag: 'SVC-SPOOLER',
    name: 'Windows Print Spooler System Service',
    assetType: 'WINDOWS_SERVICE',
    hostname: 'print01.corp.internal',
    ipAddress: '10.0.1.90',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Service (spoolsv.exe)',
    location: 'Logical Service (hosted on SRV-PRINT-01)',
    criticality: 'TIER_3_MEDIUM',
    status: 'DEGRADED',
    notes: 'Core service responsible for spooling and dispatching print jobs.',
    isDemo: true,
    createdAt: '2026-03-01T08:30:00Z',
    updatedAt: '2026-10-24T16:30:00Z'
  },
  {
    id: 'ast-115',
    assetTag: 'SVC-VSS-SQL',
    name: 'Microsoft SQL Server VSS Writer Service',
    assetType: 'WINDOWS_SERVICE',
    hostname: 'sql-prod-01.corp.internal',
    ipAddress: '10.0.1.65',
    subnet: '10.0.1.0/24',
    operatingSystem: 'Windows Service (SqlWriter)',
    location: 'Logical Service (hosted on SRV-SQL-01)',
    criticality: 'TIER_1_CRITICAL',
    status: 'DEGRADED',
    notes: 'Volume Shadow Copy Service writer coordinating database freeze for backups.',
    isDemo: true,
    createdAt: '2026-02-10T14:30:00Z',
    updatedAt: '2026-10-24T13:45:00Z'
  }
];

export const DEMO_DEPENDENCIES: AssetDependency[] = [
  {
    id: 'dep-1',
    sourceAssetId: 'ast-109', // EXEC-LT-04
    targetAssetId: 'ast-104', // FW-EDGE-01
    relationshipType: 'ROUTES_THROUGH',
    description: 'VPN tunnel connects through perimeter firewall gateway'
  },
  {
    id: 'dep-2',
    sourceAssetId: 'ast-104', // FW-EDGE-01
    targetAssetId: 'ast-105', // SW-CORE-01
    relationshipType: 'CONNECTS_TO',
    description: 'Perimeter firewall connects to Core Distribution Switch'
  },
  {
    id: 'dep-3',
    sourceAssetId: 'ast-105', // SW-CORE-01
    targetAssetId: 'ast-103', // FS-CORP-01
    relationshipType: 'CONNECTS_TO',
    description: 'Core switch routes traffic to Corporate File Server'
  },
  {
    id: 'dep-4',
    sourceAssetId: 'ast-103', // FS-CORP-01
    targetAssetId: 'ast-101', // DC-DNS-01
    relationshipType: 'AUTHENTICATES_AGAINST',
    description: 'File server verifies Kerberos tickets against Primary DC'
  },
  {
    id: 'dep-5',
    sourceAssetId: 'ast-110', // FIN-WS-012
    targetAssetId: 'ast-105', // SW-CORE-01
    relationshipType: 'CONNECTS_TO',
    description: 'Workstation connects to HQ Floor 3 access switch'
  },
  {
    id: 'dep-6',
    sourceAssetId: 'ast-110', // FIN-WS-012
    targetAssetId: 'ast-101', // DC-DNS-01
    relationshipType: 'DEPENDS_ON',
    description: 'Workstation queries primary internal DNS resolver'
  },
  {
    id: 'dep-7',
    sourceAssetId: 'ast-101', // DC-DNS-01
    targetAssetId: 'ast-102', // DC-DNS-02
    relationshipType: 'DEPENDS_ON',
    description: 'Active Directory DNS replication partner'
  },
  {
    id: 'dep-8',
    sourceAssetId: 'ast-107', // SRV-SQL-01
    targetAssetId: 'ast-106', // HYPER-NODE-02
    relationshipType: 'HOSTED_ON',
    description: 'SQL Virtual Machine hosted on ESXi Hypervisor Node 02'
  },
  {
    id: 'dep-9',
    sourceAssetId: 'ast-107', // SRV-SQL-01
    targetAssetId: 'ast-112', // SAN-VOL-03
    relationshipType: 'DEPENDS_ON',
    description: 'Virtual disks stored on FlashArray LUN 03'
  },
  {
    id: 'dep-10',
    sourceAssetId: 'ast-115', // SVC-VSS-SQL
    targetAssetId: 'ast-107', // SRV-SQL-01
    relationshipType: 'HOSTED_ON',
    description: 'SQL VSS Writer service running inside SQL Server OS'
  },
  {
    id: 'dep-11',
    sourceAssetId: 'ast-114', // SVC-SPOOLER
    targetAssetId: 'ast-108', // SRV-PRINT-01
    relationshipType: 'HOSTED_ON',
    description: 'Print Spooler service running inside Print Server OS'
  },
  {
    id: 'dep-12',
    sourceAssetId: 'ast-108', // SRV-PRINT-01
    targetAssetId: 'ast-111', // PRN-WH-01
    relationshipType: 'CONNECTS_TO',
    description: 'Print server communicates with Zebra thermal printer over IP'
  },
  {
    id: 'dep-13',
    sourceAssetId: 'ast-113', // SHR-ENG-01
    targetAssetId: 'ast-103', // FS-CORP-01
    relationshipType: 'HOSTED_ON',
    description: 'Engineering department share hosted on File Server 01'
  }
];

// Attach dependencies to assets for quick reference
DEMO_ASSETS.forEach(asset => {
  const outgoing = DEMO_DEPENDENCIES.filter(d => d.sourceAssetId === asset.id).map(d => {
    const target = DEMO_ASSETS.find(a => a.id === d.targetAssetId);
    return {
      ...d,
      targetAssetName: target?.name,
      targetAssetType: target?.assetType
    };
  });
  asset.dependencies = outgoing;
});

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'inc-0842',
    ticketNumber: 'INC-2026-0842',
    title: 'Remote executive VPN connected but cannot access file share \\\\fs01.corp.internal\\Shared',
    rawDescription: 'VP of Finance connected to FortiClient SSL-VPN successfully from home. Internet browsing works, but attempting to open corporate file share yields 0x80070035 Network Path Not Found. Laptop IP is 172.16.50.14.',
    category: 'VPN & Remote Access',
    severity: 'P2_HIGH',
    status: 'INVESTIGATING',
    experienceLevel: 'Intermediate',
    diagnosticMode: 'GUIDED',
    targetAssetId: 'ast-109', // EXEC-LT-04
    targetAsset: DEMO_ASSETS.find(a => a.id === 'ast-109'),
    isDemo: true,
    createdAt: '2026-10-24T15:10:00Z',
    updatedAt: '2026-10-24T17:45:00Z',
    session: {
      id: 'ses-0842',
      incidentId: 'inc-0842',
      scenarioId: 'vpn-file-server-inaccessible',
      currentStepIndex: 1,
      mode: 'GUIDED',
      status: 'INVESTIGATING',
      totalStepsExecuted: 1,
      sessionBudgetMax: 12,
      steps: [
        {
          id: 'step-vpn-1',
          stepId: 'vpn-adapter-audit',
          title: 'Verify VPN Virtual Adapter IP Configuration',
          toolName: 'vpn_route_audit',
          command: 'Get-NetIPAddress -InterfaceAlias "*VPN*" | Select-Object InterfaceAlias, IPAddress, PrefixLength',
          purpose: 'Confirm that the client was assigned a valid tunnel IP address from the VPN pool (172.16.50.0/24).',
          expectedOutput: 'InterfaceAlias: SSL-VPN, IPAddress: 172.16.50.14, PrefixLength: 24',
          riskRating: 'SAFE_READ_ONLY',
          outcome: 'PASSED',
          observedOutput: 'InterfaceAlias: FortiClient SSL-VPN\nIPAddress: 172.16.50.14\nPrefixLength: 24\nOperationalStatus: Up',
          executedAt: '2026-10-24T15:25:00Z'
        },
        {
          id: 'step-vpn-2',
          stepId: 'mtu-blackhole-probe',
          title: 'Test Path MTU Size and Packet Fragmentation',
          toolName: 'mtu_path_probe',
          command: 'ping -f -l 1472 10.200.4.50 -n 2',
          purpose: 'Determine if VPN encapsulation headers are exceeding path MTU, causing silent packet drops.',
          expectedOutput: 'Reply from 10.200.4.50: bytes=1472 time=24ms TTL=126 (or Packet needs to be fragmented but DF set).',
          riskRating: 'SAFE_READ_ONLY',
          outcome: 'NOT_TESTED',
          rollbackInstructions: 'Read-only ICMP probe; no state changes or rollback required.'
        },
        {
          id: 'step-vpn-3',
          stepId: 'split-tunnel-route-check',
          title: 'Audit Split-Tunnel Client Routing Table',
          toolName: 'vpn_route_audit',
          command: 'Get-NetRoute -DestinationPrefix "10.200.0.0/16" | Format-Table',
          purpose: 'Verify whether the VPN gateway pushed the required subnet route for corporate file servers.',
          expectedOutput: 'DestinationPrefix: 10.200.0.0/16 via NextHop 172.16.50.1',
          riskRating: 'SAFE_READ_ONLY',
          outcome: 'NOT_TESTED'
        }
      ],
      evidence: [
        {
          id: 'ev-1',
          sessionId: 'ses-0842',
          stepId: 'step-vpn-1',
          summary: 'Virtual adapter FortiClient SSL-VPN is UP with valid IP 172.16.50.14/24.',
          rawOutput: 'InterfaceAlias: FortiClient SSL-VPN\nIPAddress: 172.16.50.14\nPrefixLength: 24',
          polarity: 'SUPPORTING',
          technicianNotes: 'IP lease from gateway is healthy. Excludes physical adapter disconnection.',
          recordedAt: '2026-10-24T15:26:00Z'
        }
      ],
      hypotheses: [
        {
          id: 'hyp-1',
          sessionId: 'ses-0842',
          title: 'Missing VPN Subnet Route for File Server Subnet',
          description: 'The VPN concentrator did not push the static route for 10.200.4.0/24, causing traffic to default to the local ISP gateway.',
          confidenceScore: 0.65,
          status: 'INVESTIGATING',
          updatedAt: '2026-10-24T15:26:00Z'
        },
        {
          id: 'hyp-2',
          sessionId: 'ses-0842',
          title: 'VPN Path MTU Fragmentation Black Hole',
          description: 'Large SMB handshake packets with Don\'t Fragment (DF) bit set are being dropped by transit routers.',
          confidenceScore: 0.40,
          status: 'INVESTIGATING',
          updatedAt: '2026-10-24T15:26:00Z'
        },
        {
          id: 'hyp-3',
          sessionId: 'ses-0842',
          title: 'Local Client VPN Adapter Disabled',
          description: 'Virtual network adapter was disconnected or failed to receive DHCP address.',
          confidenceScore: 0.05,
          status: 'REFUTED',
          updatedAt: '2026-10-24T15:26:00Z'
        }
      ]
    },
    report: {
      id: 'rep-0842',
      incidentId: 'inc-0842',
      executiveSummary: 'Investigation into remote access degradation for VP of Finance accessing corporate file storage. Preliminary testing confirms virtual adapter is operational. Leading hypothesis points to missing static routing push on FW-EDGE-01 for prefix 10.200.4.0/24.',
      confirmedRootCause: 'Under active investigation: awaiting path MTU sweep and client routing table verification.',
      fiveWhys: [
        { whyNumber: 1, question: 'Why cannot the client open the file share?', answer: 'Windows displays network path not found (0x80070035).' },
        { whyNumber: 2, question: 'Why is the network path unreachable?', answer: 'Traffic to 10.200.4.50 is failing to route across the VPN tunnel interface.' },
        { whyNumber: 3, question: 'Why does traffic bypass the tunnel?', answer: 'The client routing table lacks an explicit route for destination subnet 10.200.4.0/24.' },
        { whyNumber: 4, question: 'Why is the route missing?', answer: 'The FortiOS SSL-VPN split-tunnel address object configuration omitted the file server subnet.' },
        { whyNumber: 5, question: 'Why was it omitted?', answer: 'Subnet 10.200.4.0/24 was migrated during the Q3 datacenter expansion and not appended to the VPN portal policy.' }
      ],
      verifiedFixes: [
        { id: 'fix-1', action: 'Verify VPN adapter binding and IP lease status on client', owner: 'Tier 2 Support', isVerified: true, targetAssetTag: 'EXEC-LT-04' }
      ],
      unverifiedRecommendations: [
        { id: 'rec-1', action: 'Append 10.200.4.0/24 to FortiGate SSL-VPN Split Tunnel routing table', owner: 'Network Security Team', isVerified: false, targetAssetTag: 'FW-EDGE-01' },
        { id: 'rec-2', action: 'Lower client TCP MSS to 1360 bytes if MTU black hole is detected', owner: 'Network Security Team', isVerified: false, targetAssetTag: 'FW-EDGE-01' }
      ],
      signOffOperator: 'Adarsh Panicker (Lead Incident Engineer)',
      generatedAt: '2026-10-24T17:45:00Z',
      updatedAt: '2026-10-24T17:45:00Z'
    }
  },
  {
    id: 'inc-0843',
    ticketNumber: 'INC-2026-0843',
    title: 'Finance department workstations unable to resolve internal ERP portal erp.corp.internal',
    rawDescription: 'Multiple users in Accounting (VLAN 20) report browser DNS_PROBE_FINISHED_NXDOMAIN when navigating to internal financial accounting portal. External websites and Google resolve normally.',
    category: 'DNS & Name Resolution',
    severity: 'P1_CRITICAL',
    status: 'ROOT_CAUSE_IDENTIFIED',
    experienceLevel: 'Intermediate',
    diagnosticMode: 'GUIDED',
    targetAssetId: 'ast-110', // FIN-WS-012
    targetAsset: DEMO_ASSETS.find(a => a.id === 'ast-110'),
    isDemo: true,
    createdAt: '2026-10-24T11:00:00Z',
    updatedAt: '2026-10-24T14:15:00Z'
  },
  {
    id: 'inc-0844',
    ticketNumber: 'INC-2026-0844',
    title: 'Warehouse shipping label printers offline; Print Spooler crash loop on SRV-PRINT-01',
    rawDescription: 'Logistics shipping lines 1-4 halted. The Windows Print Spooler service on SRV-PRINT-01 crashes within 5 seconds of being manually started with Event ID 7031 in System log.',
    category: 'Windows & System Services',
    severity: 'P2_HIGH',
    status: 'OPEN',
    experienceLevel: 'Beginner',
    diagnosticMode: 'GUIDED',
    targetAssetId: 'ast-108', // SRV-PRINT-01
    targetAsset: DEMO_ASSETS.find(a => a.id === 'ast-108'),
    isDemo: true,
    createdAt: '2026-10-24T16:20:00Z',
    updatedAt: '2026-10-24T16:20:00Z'
  },
  {
    id: 'inc-0845',
    ticketNumber: 'INC-2026-0845',
    title: 'Senior manager added to new Security Groups denied access to Engineering folder',
    rawDescription: 'Engineering manager added to 14 additional Active Directory distribution and security groups. Immediately lost access to \\\\fs01.corp.internal\\Engineering despite group having Full Control.',
    category: 'Accounts & Permissions',
    severity: 'P3_MEDIUM',
    status: 'RESOLVED',
    experienceLevel: 'Advanced',
    diagnosticMode: 'GUIDED',
    targetAssetId: 'ast-113', // SHR-ENG-01
    targetAsset: DEMO_ASSETS.find(a => a.id === 'ast-113'),
    isDemo: true,
    createdAt: '2026-10-24T09:00:00Z',
    updatedAt: '2026-10-24T13:30:00Z'
  },
  {
    id: 'inc-0846',
    ticketNumber: 'INC-2026-0846',
    title: 'Veeam nightly backup for database VM SRV-SQL-01 failed with VSS timeout',
    rawDescription: 'Nightly backup job failed at 02:15 AM. Veeam logs report "Error: VSS snapshot creation timed out on guest SRV-SQL-01. SqlServerWriter in state Failed."',
    category: 'Backup & Storage',
    severity: 'P2_HIGH',
    status: 'INVESTIGATING',
    experienceLevel: 'Intermediate',
    diagnosticMode: 'AGENT',
    targetAssetId: 'ast-107', // SRV-SQL-01
    targetAsset: DEMO_ASSETS.find(a => a.id === 'ast-107'),
    isDemo: true,
    createdAt: '2026-10-24T07:30:00Z',
    updatedAt: '2026-10-24T15:00:00Z'
  }
];
