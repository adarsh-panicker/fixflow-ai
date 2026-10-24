// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('Seeding FixFlow AI Database...');

  // 1. Create Default Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'ws-default' },
    update: {},
    create: {
      id: 'ws-default',
      name: 'Corporate Enterprise Production',
      description: 'Primary corporate IT infrastructure workspace',
    },
  });

  console.log(`Workspace ready: ${workspace.name} (${workspace.id})`);

  // 1b. Seed Initial Users and Workspace Memberships
  // Default Admin credentials as requested: Username = Admin, Password = Flexflow@i
  const adminPasswordHash = await bcrypt.hash('Flexflow@i', 10);
  const techPasswordHash = await bcrypt.hash('Flexflow@i', 10);
  const viewerPasswordHash = await bcrypt.hash('Flexflow@i', 10);
  const leadPasswordHash = await bcrypt.hash('Flexflow@i', 10);

  const adminUser = await prisma.userProfile.upsert({
    where: { email: 'admin@fixflow.ai' },
    update: {
      username: 'Admin',
      name: 'Admin (System Administrator)',
      passwordHash: adminPasswordHash,
    },
    create: {
      id: 'usr-admin-01',
      username: 'Admin',
      email: 'admin@fixflow.ai',
      name: 'Admin (System Administrator)',
      passwordHash: adminPasswordHash,
      emailVerified: new Date(),
    },
  });

  const leadAdminUser = await prisma.userProfile.upsert({
    where: { email: 'lead@fixflow.ai' },
    update: {
      username: 'LeadAdmin',
      passwordHash: leadPasswordHash,
    },
    create: {
      id: 'usr-lead-01',
      username: 'LeadAdmin',
      email: 'lead@fixflow.ai',
      name: 'Jordan Hayes (Admin)',
      passwordHash: leadPasswordHash,
      emailVerified: new Date(),
    },
  });

  const techUser = await prisma.userProfile.upsert({
    where: { email: 'tech@fixflow.ai' },
    update: {
      username: 'Technician',
      passwordHash: techPasswordHash,
    },
    create: {
      id: 'usr-tech-01',
      username: 'Technician',
      email: 'tech@fixflow.ai',
      name: 'Sam Chen (IT Support)',
      passwordHash: techPasswordHash,
      emailVerified: new Date(),
    },
  });

  const viewerUser = await prisma.userProfile.upsert({
    where: { email: 'auditor@fixflow.ai' },
    update: {
      username: 'Auditor',
      passwordHash: viewerPasswordHash,
    },
    create: {
      id: 'usr-viewer-01',
      username: 'Auditor',
      email: 'auditor@fixflow.ai',
      name: 'Morgan Taylor (Viewer)',
      passwordHash: viewerPasswordHash,
      emailVerified: new Date(),
    },
  });

  // Assign memberships in default workspace
  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: adminUser.id } },
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      role: 'OWNER',
    },
  });

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: leadAdminUser.id } },
    update: { role: 'ADMIN' },
    create: {
      workspaceId: workspace.id,
      userId: leadAdminUser.id,
      role: 'ADMIN',
    },
  });

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: techUser.id } },
    update: { role: 'SUPPORT' },
    create: {
      workspaceId: workspace.id,
      userId: techUser.id,
      role: 'SUPPORT',
    },
  });

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: viewerUser.id } },
    update: { role: 'VIEWER' },
    create: {
      workspaceId: workspace.id,
      userId: viewerUser.id,
      role: 'VIEWER',
    },
  });

  console.log('Seeded 4 default users with OWNER, ADMIN, SUPPORT, and VIEWER roles.');

  // 2. Clear existing demo assets and relationships for idempotency
  await prisma.workspaceAuditEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.monitoringAuditEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.monitoringCheckResult.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.availabilityIncident.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.assetAvailabilityState.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.assetMonitoringConfiguration.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.monitoringAgent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.assetRelationship.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.incidentAsset.deleteMany({});
  await prisma.evidenceRecord.deleteMany({});
  await prisma.diagnosticStepRecord.deleteMany({});
  await prisma.hypothesisRecord.deleteMany({});
  await prisma.diagnosticSession.deleteMany({});
  await prisma.postMortemReport.deleteMany({});
  await prisma.knowledgeArticle.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.incident.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.asset.deleteMany({ where: { workspaceId: workspace.id } });

  // 3. Define 16 Realistic Enterprise IT Assets
  const assetsData = [
    {
      id: 'ast-101',
      workspaceId: workspace.id,
      assetTag: 'DC-DNS-01',
      name: 'Primary Domain Controller & DNS',
      assetType: 'SERVER',
      manufacturer: 'Dell Technologies',
      model: 'PowerEdge R750',
      hostname: 'dc-dns-01.corp.internal',
      ipAddress: '10.0.1.10',
      operatingSystem: 'Windows Server 2022 Datacenter',
      location: 'Primary Datacenter - Rack A01',
      owner: 'Directory Services Team',
      notes: 'Active Directory Domain Services (AD DS), DNS Primary Master Zone, Kerberos KDC.',
      tags: 'ad,dns,kerberos,core-infra,tier-1',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-102',
      workspaceId: workspace.id,
      assetTag: 'DC-DNS-02',
      name: 'Secondary Domain Controller & DNS Replication',
      assetType: 'SERVER',
      manufacturer: 'Dell Technologies',
      model: 'PowerEdge R650',
      hostname: 'dc-dns-02.corp.internal',
      ipAddress: '10.0.1.11',
      operatingSystem: 'Windows Server 2022 Datacenter',
      location: 'Disaster Recovery Datacenter - Rack D02',
      owner: 'Directory Services Team',
      notes: 'Secondary DNS replication node and failover Kerberos authenticator.',
      tags: 'ad,dns,dr-site,tier-1',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-103',
      workspaceId: workspace.id,
      assetTag: 'FS-CORP-01',
      name: 'Corporate Central File Server',
      assetType: 'SERVER',
      manufacturer: 'HPE',
      model: 'ProLiant DL380 Gen10',
      hostname: 'fs01.corp.internal',
      ipAddress: '10.200.4.50',
      operatingSystem: 'Windows Server 2019 Standard',
      location: 'Primary Datacenter - Rack B04',
      owner: 'Infrastructure Storage Team',
      notes: 'Hosts departmental SMB 3.0 file shares (Finance, Legal, Engineering).',
      tags: 'smb,storage,shares,finance,legal',
      criticality: 'TIER_2_HIGH',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-104',
      workspaceId: workspace.id,
      assetTag: 'FW-EDGE-01',
      name: 'Corporate Perimeter Firewall & VPN Concentrator',
      assetType: 'FIREWALL',
      manufacturer: 'Fortinet',
      model: 'FortiGate 200F',
      hostname: 'fw-edge-01.corp.internal',
      ipAddress: '10.0.0.1',
      operatingSystem: 'FortiOS 7.4.2',
      location: 'Primary Datacenter - Edge Gateway Rack',
      owner: 'Network Security Operations',
      notes: 'Manages SSL-VPN endpoint pool (172.16.50.0/24) and border NAT policies.',
      tags: 'firewall,vpn,perimeter,ssl-vpn,nat',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-105',
      workspaceId: workspace.id,
      assetTag: 'SW-CORE-01',
      name: 'Core Distribution Switch Stack',
      assetType: 'SWITCH',
      manufacturer: 'Cisco Systems',
      model: 'Catalyst 9500-48Y4C',
      hostname: 'sw-core-01.corp.internal',
      ipAddress: '10.0.1.1',
      operatingSystem: 'Cisco IOS-XE 17.9.4a',
      location: 'Primary Datacenter - Core Rack',
      owner: 'Network Engineering Team',
      notes: 'L3 core routing between VLAN 10 (Servers), VLAN 20 (Users), and VLAN 50 (VPN).',
      tags: 'switch,core-network,routing,vlan',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-106',
      workspaceId: workspace.id,
      assetTag: 'HYPER-NODE-02',
      name: 'VMware ESXi Compute Node 02',
      assetType: 'SERVER',
      manufacturer: 'Cisco Systems',
      model: 'UCS B200 M6 Blade',
      hostname: 'esxi-02.corp.internal',
      ipAddress: '10.0.1.42',
      operatingSystem: 'VMware ESXi 8.0 Update 2',
      location: 'Primary Datacenter - Cluster Chassis 01',
      owner: 'Virtualization & Cloud Team',
      notes: 'Hosts production database and backend accounting virtual machines.',
      tags: 'vmware,esxi,hypervisor,compute',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-107',
      workspaceId: workspace.id,
      assetTag: 'SRV-SQL-01',
      name: 'Production ERP MSSQL Database Server',
      assetType: 'VIRTUAL_MACHINE',
      manufacturer: 'VMware Virtual Platform',
      model: 'VM Version 19',
      hostname: 'sql-prod-01.corp.internal',
      ipAddress: '10.0.1.65',
      operatingSystem: 'Windows Server 2022 / SQL Server 2022',
      location: 'Virtual Cluster (on HYPER-NODE-02)',
      owner: 'Database Administration (DBA)',
      notes: 'Hosts core ERP financial database. Volume D: allocated for SQL transaction logs.',
      tags: 'sql,database,erp,mssql,vss',
      criticality: 'TIER_1_CRITICAL',
      status: 'DEGRADED',
      isDemo: true,
    },
    {
      id: 'ast-108',
      workspaceId: workspace.id,
      assetTag: 'SRV-PRINT-01',
      name: 'Enterprise Print Management Server',
      assetType: 'SERVER',
      manufacturer: 'Dell Technologies',
      model: 'PowerEdge R350',
      hostname: 'print01.corp.internal',
      ipAddress: '10.0.1.90',
      operatingSystem: 'Windows Server 2019 Standard',
      location: 'Primary Datacenter - Rack C02',
      owner: 'End User Computing Team',
      notes: 'Manages print queues for warehouse thermal printers and office laser printers.',
      tags: 'print,spooler,peripherals',
      criticality: 'TIER_3_MEDIUM',
      status: 'DEGRADED',
      isDemo: true,
    },
    {
      id: 'ast-109',
      workspaceId: workspace.id,
      assetTag: 'EXEC-LT-04',
      name: 'VP Finance Executive Laptop',
      assetType: 'LAPTOP',
      manufacturer: 'Lenovo',
      model: 'ThinkPad X1 Carbon Gen 11',
      hostname: 'lt-exec-04.corp.internal',
      ipAddress: '172.16.50.14',
      operatingSystem: 'Windows 11 Enterprise 23H2',
      location: 'Remote Teleworker (Connected via SSL-VPN)',
      owner: 'Sarah Jenkins (VP Finance)',
      notes: 'Primary executive client reporting VPN file access failures.',
      tags: 'laptop,executive,teleworker,vpn-client',
      criticality: 'TIER_2_HIGH',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-110',
      workspaceId: workspace.id,
      assetTag: 'FIN-WS-012',
      name: 'Accounting Department Workstation 12',
      assetType: 'WORKSTATION',
      manufacturer: 'Dell Technologies',
      model: 'OptiPlex 7000 Micro',
      hostname: 'ws-fin-012.corp.internal',
      ipAddress: '10.0.20.112',
      operatingSystem: 'Windows 11 Enterprise 23H2',
      location: 'Headquarters Building - Floor 3 Accounting',
      owner: 'Accounting Dept Pool',
      notes: 'Client experiencing internal ERP domain resolution timeouts.',
      tags: 'workstation,accounting,vlan-20',
      criticality: 'TIER_3_MEDIUM',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-111',
      workspaceId: workspace.id,
      assetTag: 'PRN-WH-01',
      name: 'Warehouse High-Speed Thermal Shipping Printer',
      assetType: 'PRINTER',
      manufacturer: 'Zebra Technologies',
      model: 'ZT411 Industrial',
      hostname: 'prn-wh-01.corp.internal',
      ipAddress: '10.0.30.55',
      operatingSystem: 'Link-OS v84.20',
      location: 'Logistics Facility - Shipping Dock 4',
      owner: 'Warehouse Logistics Team',
      notes: 'Prints packing slips and carrier shipping labels; queued on SRV-PRINT-01.',
      tags: 'printer,warehouse,shipping,zebra',
      criticality: 'TIER_2_HIGH',
      status: 'OFFLINE',
      isDemo: true,
    },
    {
      id: 'ast-112',
      workspaceId: workspace.id,
      assetTag: 'SAN-VOL-03',
      name: 'PureStorage FlashArray LUN 03 (SQL Storage)',
      assetType: 'STORAGE',
      manufacturer: 'Pure Storage',
      model: 'FlashArray//X20 R3',
      hostname: 'san-array-01.corp.internal',
      ipAddress: '10.0.100.22',
      operatingSystem: 'Purity//FA 6.4.8',
      location: 'Primary Datacenter - Storage Rack S01',
      owner: 'Storage Administration',
      notes: 'NVMe-oF datastore hosting SRV-SQL-01 database virtual disk files.',
      tags: 'san,storage,nvme,purestorage,flash',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-113',
      workspaceId: workspace.id,
      assetTag: 'SHR-ENG-01',
      name: 'Engineering Department Shared SMB Folder',
      assetType: 'SHARED_FOLDER',
      manufacturer: 'Microsoft Corporation',
      model: 'NTFS SMB 3.0 Share',
      hostname: 'fs01.corp.internal',
      ipAddress: '10.200.4.50',
      operatingSystem: 'NTFS Filesystem (on FS-CORP-01)',
      location: 'Logical Share: \\\\fs01.corp.internal\\Engineering',
      owner: 'Engineering Leadership',
      notes: 'Restricted share governed by Active Directory security groups.',
      tags: 'smb,share,engineering,acls',
      criticality: 'TIER_2_HIGH',
      status: 'OPERATIONAL',
      isDemo: true,
    },
    {
      id: 'ast-114',
      workspaceId: workspace.id,
      assetTag: 'SVC-SPOOLER',
      name: 'Windows Print Spooler System Service',
      assetType: 'SERVICE',
      manufacturer: 'Microsoft Corporation',
      model: 'spoolsv.exe',
      hostname: 'print01.corp.internal',
      ipAddress: '10.0.1.90',
      operatingSystem: 'Win32 System Service',
      location: 'Logical Service (hosted on SRV-PRINT-01)',
      owner: 'End User Computing',
      notes: 'Core service responsible for spooling and dispatching print jobs.',
      tags: 'windows-service,spooler,print-daemon',
      criticality: 'TIER_3_MEDIUM',
      status: 'DEGRADED',
      isDemo: true,
    },
    {
      id: 'ast-115',
      workspaceId: workspace.id,
      assetTag: 'SVC-VSS-SQL',
      name: 'Microsoft SQL Server VSS Writer Service',
      assetType: 'SERVICE',
      manufacturer: 'Microsoft Corporation',
      model: 'SqlWriter.exe',
      hostname: 'sql-prod-01.corp.internal',
      ipAddress: '10.0.1.65',
      operatingSystem: 'Win32 VSS Writer Service',
      location: 'Logical Service (hosted on SRV-SQL-01)',
      owner: 'Database Administration',
      notes: 'Volume Shadow Copy Service writer coordinating database freeze for backups.',
      tags: 'vss,backup,sql-writer,service',
      criticality: 'TIER_1_CRITICAL',
      status: 'DEGRADED',
      isDemo: true,
    },
    {
      id: 'ast-116',
      workspaceId: workspace.id,
      assetTag: 'APP-ERP-PROD',
      name: 'Corporate Enterprise ERP Web Portal',
      assetType: 'APPLICATION',
      manufacturer: 'SAP / Custom',
      model: 'NetWeaver 7.50 / React Frontend',
      hostname: 'erp.corp.internal',
      ipAddress: '10.0.1.80',
      operatingSystem: 'Ubuntu 22.04 LTS / Node.js 20',
      location: 'Primary Datacenter - App Cluster',
      owner: 'Enterprise Business Applications Team',
      notes: 'Primary accounting and logistics enterprise portal accessed company-wide.',
      tags: 'app,erp,accounting,portal,web',
      criticality: 'TIER_1_CRITICAL',
      status: 'OPERATIONAL',
      isDemo: true,
    },
  ];

  for (const asset of assetsData) {
    await prisma.asset.create({ data: asset });
  }
  console.log(`Created ${assetsData.length} enterprise IT assets.`);

  // 4. Define Explicit Infrastructure Relationships
  // Relationships: DEPENDS_ON, HOSTED_ON, CONNECTED_TO, MANAGED_BY, PROVIDES_SERVICE_TO, SHARES_DATA_WITH
  // Provenance: USER_CONFIRMED, AI_SUGGESTED
  const relationshipsData = [
    {
      id: 'rel-1',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-109', // EXEC-LT-04
      targetAssetId: 'ast-104', // FW-EDGE-01
      relationshipType: 'CONNECTED_TO',
      provenance: 'USER_CONFIRMED',
      description: 'SSL-VPN endpoint tunnel terminates on edge firewall gateway',
    },
    {
      id: 'rel-2',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-104', // FW-EDGE-01
      targetAssetId: 'ast-105', // SW-CORE-01
      relationshipType: 'CONNECTED_TO',
      provenance: 'USER_CONFIRMED',
      description: 'Perimeter firewall connects to Core Distribution Switch via 10GbE trunk',
    },
    {
      id: 'rel-3',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-105', // SW-CORE-01
      targetAssetId: 'ast-103', // FS-CORP-01
      relationshipType: 'CONNECTED_TO',
      provenance: 'USER_CONFIRMED',
      description: 'Core switch routes VLAN 10 server subnet traffic to Corporate File Server',
    },
    {
      id: 'rel-4',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-101', // DC-DNS-01
      targetAssetId: 'ast-103', // FS-CORP-01
      relationshipType: 'PROVIDES_SERVICE_TO',
      provenance: 'USER_CONFIRMED',
      description: 'Primary DC validates Kerberos tickets and provides DNS for file server',
    },
    {
      id: 'rel-5',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-110', // FIN-WS-012
      targetAssetId: 'ast-105', // SW-CORE-01
      relationshipType: 'CONNECTED_TO',
      provenance: 'USER_CONFIRMED',
      description: 'Accounting workstation connects to Core Switch on access port VLAN 20',
    },
    {
      id: 'rel-6',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-110', // FIN-WS-012
      targetAssetId: 'ast-101', // DC-DNS-01
      relationshipType: 'DEPENDS_ON',
      provenance: 'USER_CONFIRMED',
      description: 'Workstation queries primary internal DNS resolver at 10.0.1.10',
    },
    {
      id: 'rel-7',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-101', // DC-DNS-01
      targetAssetId: 'ast-102', // DC-DNS-02
      relationshipType: 'SHARES_DATA_WITH',
      provenance: 'USER_CONFIRMED',
      description: 'Active Directory multi-master zone replication partner',
    },
    {
      id: 'rel-8',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-107', // SRV-SQL-01
      targetAssetId: 'ast-106', // HYPER-NODE-02
      relationshipType: 'HOSTED_ON',
      provenance: 'USER_CONFIRMED',
      description: 'Production SQL Server VM hosted on VMware ESXi Node 02',
    },
    {
      id: 'rel-9',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-107', // SRV-SQL-01
      targetAssetId: 'ast-112', // SAN-VOL-03
      relationshipType: 'DEPENDS_ON',
      provenance: 'USER_CONFIRMED',
      description: 'Virtual disk storage datastore hosted on PureStorage FlashArray LUN 03',
    },
    {
      id: 'rel-10',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-115', // SVC-VSS-SQL
      targetAssetId: 'ast-107', // SRV-SQL-01
      relationshipType: 'HOSTED_ON',
      provenance: 'USER_CONFIRMED',
      description: 'SQL VSS Writer service running inside SQL Server guest OS',
    },
    {
      id: 'rel-11',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-114', // SVC-SPOOLER
      targetAssetId: 'ast-108', // SRV-PRINT-01
      relationshipType: 'HOSTED_ON',
      provenance: 'USER_CONFIRMED',
      description: 'Print Spooler service running inside Print Server OS',
    },
    {
      id: 'rel-12',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-108', // SRV-PRINT-01
      targetAssetId: 'ast-111', // PRN-WH-01
      relationshipType: 'MANAGED_BY',
      provenance: 'USER_CONFIRMED',
      description: 'Print server dispatches spool queue jobs to Zebra thermal printer',
    },
    {
      id: 'rel-13',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-113', // SHR-ENG-01
      targetAssetId: 'ast-103', // FS-CORP-01
      relationshipType: 'HOSTED_ON',
      provenance: 'USER_CONFIRMED',
      description: 'Engineering department share hosted on File Server 01 NTFS volume',
    },
    {
      id: 'rel-14',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-116', // APP-ERP-PROD
      targetAssetId: 'ast-107', // SRV-SQL-01
      relationshipType: 'DEPENDS_ON',
      provenance: 'USER_CONFIRMED',
      description: 'ERP backend queries production MSSQL database on port 1433',
    },
    // AI-SUGGESTED RELATIONSHIP FOR DEMO
    {
      id: 'rel-15',
      workspaceId: workspace.id,
      sourceAssetId: 'ast-116', // APP-ERP-PROD
      targetAssetId: 'ast-101', // DC-DNS-01
      relationshipType: 'DEPENDS_ON',
      provenance: 'AI_SUGGESTED',
      description: 'AI inferred that ERP application relies on DC-DNS-01 for LDAP user authentication',
    },
  ];

  for (const rel of relationshipsData) {
    await prisma.assetRelationship.create({ data: rel });
  }
  console.log(`Created ${relationshipsData.length} infrastructure relationships (including AI-suggested links).`);

  // 5. Seed Core Incident & Diagnostic Workbench Demo Records
  const incidentVpn = await prisma.incident.create({
    data: {
      id: 'inc-0842',
      workspaceId: workspace.id,
      ticketNumber: 'INC-2026-0842',
      title: 'Remote executive VPN connected but cannot access file share \\\\fs01.corp.internal\\Shared',
      rawDescription:
        'VP of Finance connected to FortiClient SSL-VPN successfully from home. Internet browsing works, but opening corporate file share yields 0x80070035 Network Path Not Found. Laptop IP is 172.16.50.14.',
      category: 'VPN & Remote Access',
      severity: 'P2_HIGH',
      status: 'INVESTIGATING',
      experienceLevel: 'Intermediate',
      diagnosticMode: 'GUIDED',
      isDemo: true,
      involvedAssets: {
        create: [
          { assetId: 'ast-109', role: 'primary_affected' },
          { assetId: 'ast-103', role: 'target_resource' },
          { assetId: 'ast-104', role: 'gateway' },
        ],
      },
      session: {
        create: {
          id: 'ses-0842',
          scenarioId: 'vpn-file-server-inaccessible',
          currentStepIndex: 1,
          sessionStatus: 'INVESTIGATING',
          mode: 'GUIDED',
          totalStepsExecuted: 1,
          sessionBudgetMax: 12,
          stepRecords: {
            create: [
              {
                id: 'step-rec-1',
                stepId: 'vpn-adapter-audit',
                title: 'Verify VPN Virtual Adapter IP Configuration',
                toolName: 'vpn_route_audit',
                command: 'Get-NetIPAddress -InterfaceAlias "*VPN*" | Select-Object InterfaceAlias, IPAddress, PrefixLength',
                purpose: 'Confirm that the client was assigned a valid tunnel IP address from the VPN pool (172.16.50.0/24).',
                expectedOutput: 'InterfaceAlias: SSL-VPN, IPAddress: 172.16.50.14, PrefixLength: 24',
                riskRating: 'SAFE_READ_ONLY',
                outcome: 'PASSED',
              },
              {
                id: 'step-rec-2',
                stepId: 'mtu-blackhole-probe',
                title: 'Test Path MTU Size and Packet Fragmentation',
                toolName: 'mtu_path_probe',
                command: 'ping -f -l 1472 10.200.4.50 -n 2',
                purpose: 'Determine if VPN encapsulation headers are exceeding path MTU, causing silent packet drops.',
                expectedOutput: 'Reply from 10.200.4.50: bytes=1472 time=24ms TTL=126',
                riskRating: 'SAFE_READ_ONLY',
                outcome: 'NOT_TESTED',
              },
              {
                id: 'step-rec-3',
                stepId: 'split-tunnel-route-check',
                title: 'Audit Split-Tunnel Client Routing Table',
                toolName: 'vpn_route_audit',
                command: 'Get-NetRoute -DestinationPrefix "10.200.0.0/16" | Format-Table',
                purpose: 'Verify whether the VPN gateway pushed the required subnet route for corporate file servers.',
                expectedOutput: 'DestinationPrefix: 10.200.0.0/16 via NextHop 172.16.50.1',
                riskRating: 'SAFE_READ_ONLY',
                outcome: 'NOT_TESTED',
              },
            ],
          },
          evidence: {
            create: [
              {
                id: 'ev-1',
                stepId: 'vpn-adapter-audit',
                summary: 'Virtual adapter FortiClient SSL-VPN is UP with valid IP 172.16.50.14/24.',
                rawOutput: 'InterfaceAlias: FortiClient SSL-VPN\nIPAddress: 172.16.50.14\nPrefixLength: 24',
                polarity: 'SUPPORTING',
                technicianNotes: 'IP lease from gateway is healthy. Excludes physical adapter disconnection.',
              },
            ],
          },
          hypotheses: {
            create: [
              {
                id: 'hyp-1',
                title: 'Missing VPN Subnet Route for File Server Subnet',
                description: 'The VPN concentrator did not push the static route for 10.200.4.0/24.',
                confidenceScore: 0.65,
                status: 'INVESTIGATING',
              },
              {
                id: 'hyp-2',
                title: 'VPN Path MTU Fragmentation Black Hole',
                description: 'Large SMB handshake packets with Don\'t Fragment (DF) bit set are dropped by transit routers.',
                confidenceScore: 0.40,
                status: 'INVESTIGATING',
              },
              {
                id: 'hyp-3',
                title: 'Local Client VPN Adapter Disabled',
                description: 'Virtual network adapter was disconnected or failed to receive DHCP address.',
                confidenceScore: 0.05,
                status: 'REFUTED',
              },
            ],
          },
        },
      },
      report: {
        create: {
          id: 'rep-0842',
          executiveSummary:
            'Investigation into remote access degradation for VP of Finance accessing corporate file storage. Preliminary testing confirms virtual adapter is operational. Leading hypothesis points to missing static routing push on FW-EDGE-01 for prefix 10.200.4.0/24.',
          confirmedRootCause: 'Under active investigation: awaiting path MTU sweep and client routing table verification.',
          fiveWhys: JSON.stringify([
            { whyNumber: 1, question: 'Why cannot the client open the file share?', answer: 'Windows displays network path not found (0x80070035).' },
            { whyNumber: 2, question: 'Why is the network path unreachable?', answer: 'Traffic to 10.200.4.50 fails to route across the tunnel.' },
            { whyNumber: 3, question: 'Why does traffic bypass the tunnel?', answer: 'The client routing table lacks an explicit route for destination 10.200.4.0/24.' },
            { whyNumber: 4, question: 'Why is the route missing?', answer: 'The FortiOS SSL-VPN split-tunnel address object configuration omitted the file server subnet.' },
            { whyNumber: 5, question: 'Why was it omitted?', answer: 'Subnet 10.200.4.0/24 was migrated during Q3 datacenter expansion and not appended to portal policy.' },
          ]),
          verifiedFixes: JSON.stringify([
            { id: 'fix-1', action: 'Verify VPN adapter binding and IP lease status on client', owner: 'Tier 2 Support', isVerified: true },
          ]),
          unverifiedRecommendations: JSON.stringify([
            { id: 'rec-1', action: 'Append 10.200.4.0/24 to FortiGate SSL-VPN Split Tunnel routing table', owner: 'Network Security Team', isVerified: false },
          ]),
          signOffOperator: 'Adarsh Panicker (Lead Incident Engineer)',
        },
      },
    },
  });

  console.log(`Created baseline incident: ${incidentVpn.ticketNumber}`);

  // 6. Seed Infrastructure Availability Monitoring
  console.log('Seeding Infrastructure Monitoring Agents and Configurations...');

  // Create Primary Local Monitoring Agent
  const lanAgent = await prisma.monitoringAgent.create({
    data: {
      id: 'agent-win11-ops',
      workspaceId: workspace.id,
      agentKey: 'ffa_agent_demo_win11_ops01_lan_prober_key_v1',
      name: 'Win11-Ops01-LanProber (Local Subnet)',
      hostname: 'ops-admin01.corp.internal',
      ipAddress: '10.0.10.15',
      platform: 'win32',
      version: '1.0.0',
      status: 'ACTIVE',
      lastHeartbeat: new Date(),
    },
  });

  // Assets to monitor:
  // ast-101 (DC-DNS-01) - Online, 1.2ms
  // ast-102 (DC-DNS-02) - Online, 1.4ms
  // ast-103 (CORE-SW-01) - Online, 0.4ms
  // ast-104 (FW-EDGE-01) - Online, 0.8ms (with recovered incident)
  // ast-105 (SAN-STORE-01) - Online, 2.1ms
  // ast-106 (FILE-SRV-01) - Online, 1.8ms
  // ast-107 (PRINT-SVR-01) - Degraded, 115.4ms latency (threshold 100ms)
  // ast-108 (APP-PORTAL-01) - Online, 3.2ms
  // ast-109 (SEC-SIEM-01) - Offline (threshold crossed, active incident)
  // ast-110 (PRT-FL02-CLR) - Online, 5.6ms

  const monitoringConfigs = [
    { assetId: 'ast-101', targetIp: '10.0.1.10', status: 'ONLINE', latency: 1.2, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-102', targetIp: '10.0.1.11', status: 'ONLINE', latency: 1.4, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-103', targetIp: '10.0.0.1',  status: 'ONLINE', latency: 0.4, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-104', targetIp: '10.0.0.254', status: 'ONLINE', latency: 0.8, loss: 0, failCount: 0, succCount: 4 },
    { assetId: 'ast-105', targetIp: '10.0.3.50', status: 'ONLINE', latency: 2.1, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-106', targetIp: '10.0.2.20', status: 'ONLINE', latency: 1.8, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-107', targetIp: '10.0.2.30', status: 'DEGRADED', latency: 115.4, loss: 0, failCount: 0, succCount: 3, latencyWarn: 100 },
    { assetId: 'ast-108', targetIp: '10.0.2.15', status: 'ONLINE', latency: 3.2, loss: 0, failCount: 0, succCount: 5 },
    { assetId: 'ast-109', targetIp: '10.0.4.10', status: 'OFFLINE', latency: null, loss: 100, failCount: 3, succCount: 0 },
    { assetId: 'ast-110', targetIp: '10.0.5.42', status: 'ONLINE', latency: 5.6, loss: 0, failCount: 0, succCount: 5 },
  ];

  const now = new Date();

  for (const m of monitoringConfigs) {
    await prisma.assetMonitoringConfiguration.create({
      data: {
        workspaceId: workspace.id,
        assetId: m.assetId,
        agentId: lanAgent.id,
        enabled: true,
        targetIp: m.targetIp,
        pollingIntervalSeconds: 60,
        timeoutSeconds: 2,
        packetCount: 3,
        failureThreshold: 3,
        recoveryThreshold: 2,
        latencyWarningMs: m.latencyWarn || 100,
        packetLossWarningPercent: 20,
        suppressAlerts: false,
      },
    });

    await prisma.assetAvailabilityState.create({
      data: {
        workspaceId: workspace.id,
        assetId: m.assetId,
        currentStatus: m.status,
        lastObservedState: m.status === 'OFFLINE' ? 'TIMEOUT' : 'SUCCESS',
        consecutiveFailures: m.failCount,
        consecutiveSuccesses: m.succCount,
        lastCheckTime: now,
        lastSuccessfulResponse: m.status === 'OFFLINE' ? new Date(now.getTime() - 900_000) : now,
        lastStateTransition: new Date(now.getTime() - 600_000),
        transitionReason:
          m.status === 'OFFLINE'
            ? 'Consecutive probe timeouts exceeded failure threshold.'
            : m.status === 'DEGRADED'
            ? 'High latency observed: 115.4ms exceeds warning threshold (100ms).'
            : 'Normal ICMP Echo Reply received within timeout.',
        latestLatencyMs: m.latency,
        latestPacketLoss: m.loss,
      },
    });

    // Create 3 historical check records for each asset
    for (let i = 2; i >= 0; i--) {
      const checkTime = new Date(now.getTime() - i * 60_000);
      const isFailed = m.status === 'OFFLINE';
      await prisma.monitoringCheckResult.create({
        data: {
          workspaceId: workspace.id,
          assetId: m.assetId,
          agentId: lanAgent.id,
          checkedAt: checkTime,
          receivedAt: new Date(checkTime.getTime() + 500),
          result: isFailed ? 'TIMEOUT' : 'SUCCESS',
          averageLatencyMs: isFailed ? null : m.latency,
          minLatencyMs: isFailed ? null : m.latency ? m.latency * 0.9 : null,
          maxLatencyMs: isFailed ? null : m.latency ? m.latency * 1.2 : null,
          packetsSent: 3,
          packetsReceived: isFailed ? 0 : 3,
          packetLossPercent: isFailed ? 100 : 0,
          provider: 'REAL_AGENT',
        },
      });
    }
  }

  // Active Outage Incident for ast-109 (SEC-SIEM-01)
  await prisma.availabilityIncident.create({
    data: {
      workspaceId: workspace.id,
      assetId: 'ast-109',
      title: 'Availability Outage: SEC-SIEM-01 (10.0.4.10) Unreachable',
      status: 'TRIGGERED',
      severity: 'P2_HIGH',
      firstFailureAt: new Date(now.getTime() - 300_000),
      thresholdCrossedAt: new Date(now.getTime() - 180_000),
      latestFailureAt: now,
      failureSummary: 'Asset reached configured failure threshold (3 consecutive missed ICMP Echo Replies). Target IP 10.0.4.10 is unresponsive.',
    },
  });

  // Recovered Outage Incident for ast-104 (FW-EDGE-01)
  await prisma.availabilityIncident.create({
    data: {
      workspaceId: workspace.id,
      assetId: 'ast-104',
      title: 'Availability Outage: FW-EDGE-01 (10.0.0.254) Transient Packet Drop',
      status: 'RECOVERED',
      severity: 'P1_CRITICAL',
      firstFailureAt: new Date(now.getTime() - 3600_000),
      thresholdCrossedAt: new Date(now.getTime() - 3480_000),
      latestFailureAt: new Date(now.getTime() - 3300_000),
      recoveredAt: new Date(now.getTime() - 3120_000),
      outageDurationSeconds: 360,
      failureSummary: 'Upstream gateway failed 3 consecutive ICMP checks during core switch firmware failover.',
      recoverySummary: 'Target successfully responded to 2 consecutive ICMP Echo Requests. Average latency: 0.8ms.',
    },
  });

  console.log('Seeded 10 monitored assets with availability states and incidents.');

  // 10. Seed Enterprise Error & Solution Knowledge Base Articles
  const knowledgeArticles = [
    {
      id: 'kb-101',
      workspaceId: workspace.id,
      title: 'SMB Network Path Not Found (0x80070035) on Windows File Share',
      normalizedError: 'smb network path not found 0x80070035 windows file share fs01 corp internal',
      originalErrorDescription: 'Clients report error 0x80070035 "The network path was not found" when attempting to connect to corporate file shares on fs01.corp.internal (10.200.4.50).',
      errorCode: '0x80070035',
      category: 'STORAGE',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2019 Standard',
      productOrService: 'Microsoft SMB 3.0 File Sharing / LanmanServer',
      environmentNotes: 'Affects Windows Server file repositories and domain member workstations over TCP port 445.',
      symptoms: JSON.stringify([
        'Error 0x80070035: The network path was not found',
        'Windows cannot access \\\\fs01.corp.internal\\shares',
        'SMB client negotiation timeout on TCP port 445',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Test SMB Port 445 Connectivity',
          command: 'Test-NetConnection -ComputerName fs01.corp.internal -Port 445',
          purpose: 'Determine if SMB port 445 is open and reachable over TCP.',
          expectedResult: 'TcpTestSucceeded: True',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Verify Workstation Client Service',
          command: 'Get-Service -Name LanmanWorkstation',
          purpose: 'Verify the LanmanWorkstation client service is running.',
          expectedResult: 'Status: Running, StartType: Automatic',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Verify DNS Resolution to Share IP',
          command: 'Resolve-DnsName -Name fs01.corp.internal',
          purpose: 'Verify DNS resolves fs01.corp.internal to IP 10.200.4.50.',
          expectedResult: 'IPAddress: 10.200.4.50',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Ensure Windows Defender Firewall allows inbound 'File and Printer Sharing (SMB-In)' on port 445.
2. Restart the LanmanWorkstation client service: 'Restart-Service -Name LanmanWorkstation -Force'.
3. In Group Policy, verify 'Digitally sign communications (always)' matches between server and client.
4. Clear stale SMB credentials/sessions on the client: 'net use * /delete /y'.`,
      preventionNotes: 'Enforce standardized GPO rule for File and Printer Sharing inbound exception on Domain profile networks.',
      status: 'VERIFIED',
      confidenceBasis: 'ADMIN_VERIFIED',
      successCount: 38,
      failureCount: 2,
      createdBy: 'Directory & Storage Services Team',
      verifiedBy: 'Senior Infrastructure Architect',
      lastUsedAt: new Date(now.getTime() - 86400_000),
    },
    {
      id: 'kb-102',
      workspaceId: workspace.id,
      title: 'Internal DNS Name Resolution Failure (NXDOMAIN)',
      normalizedError: 'internal dns name resolution failure nxdomain dc-dns-01 corp internal',
      originalErrorDescription: 'Workstations receive NXDOMAIN error or "Server name cannot be resolved" when querying internal Active Directory domain controller (10.0.1.10).',
      errorCode: 'NXDOMAIN',
      category: 'NETWORK',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2022 Datacenter',
      productOrService: 'Active Directory Integrated DNS',
      environmentNotes: 'Enterprise internal corporate domain (.corp.internal) with dual DNS controllers.',
      symptoms: JSON.stringify([
        'DNS query returned NXDOMAIN error code',
        'Ping request could not find host dc-dns-01.corp.internal',
        'Kerberos authentication ticket failure due to missing SRV record',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Query Domain Controller DNS directly',
          command: 'Resolve-DnsName -Name dc-dns-01.corp.internal -Server 10.0.1.10',
          purpose: 'Test whether primary DNS authority resolves the hostname.',
          expectedResult: 'Type A record returned with IP 10.0.1.10',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Flush Client Resolver Cache',
          command: 'ipconfig /flushdns',
          purpose: 'Clear stale negative cached NXDOMAIN responses on the local machine.',
          expectedResult: 'Successfully flushed the DNS Resolver Cache',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Check DNS Client Server Address',
          command: 'Get-DnsClientServerAddress -InterfaceAlias "Ethernet*"',
          purpose: 'Verify adapter is configured with 10.0.1.10 and 10.0.1.11.',
          expectedResult: 'ServerAddresses: {10.0.1.10, 10.0.1.11}',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Flush stale client resolver cache: 'ipconfig /flushdns'.
2. Verify network adapter is configured with primary DNS 10.0.1.10 and secondary 10.0.1.11.
3. Verify DNS Server service is active on DC-DNS-01: 'Get-Service DNS'.
4. Re-register DNS dynamically from host: 'ipconfig /registerdns'.`,
      preventionNotes: 'Configure DHCP Option 006 strictly with primary DNS 10.0.1.10 and secondary 10.0.1.11 only.',
      status: 'VERIFIED',
      confidenceBasis: 'ADMIN_VERIFIED',
      successCount: 52,
      failureCount: 3,
      createdBy: 'Directory Services Team',
      verifiedBy: 'Senior Infrastructure Architect',
      lastUsedAt: new Date(now.getTime() - 43200_000),
    },
    {
      id: 'kb-103',
      workspaceId: workspace.id,
      title: 'Windows Service Failed to Start on System Boot (Event ID 7000)',
      normalizedError: 'windows service failed to start on system boot event id 7000 timeout logon failure',
      originalErrorDescription: 'System Event Log reports Event ID 7000: "The service did not respond to the start or control request in a timely fashion" or logon failure.',
      errorCode: 'EVENT_7000',
      category: 'INFRASTRUCTURE',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2022 Datacenter',
      productOrService: 'Windows Service Control Manager',
      environmentNotes: 'Enterprise server hosting background services with dedicated domain service accounts.',
      symptoms: JSON.stringify([
        'Event ID 7000: The service did not respond to the start or control request in a timely fashion',
        'Service status stuck in START_PENDING or stopped immediately after reboot',
        'Logon failure: the service did not start due to a logon failure',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Inspect System Event Log for Service Errors',
          command: 'Get-WinEvent -FilterHashtable @{LogName=\'System\'; Id=7000,7009} -MaxEvents 5',
          purpose: 'Retrieve exact service name and timeout reason from Event Viewer.',
          expectedResult: 'Event ID 7000 logged with service binary path',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Verify Dependency Service State',
          command: 'Get-Service -Name <ServiceName> -RequiredServices',
          purpose: 'Verify all dependent services are Running.',
          expectedResult: 'All dependent services in RUNNING state',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Open 'services.msc' and locate the target service.
2. Navigate to 'Log On' tab and re-enter the service account domain credentials.
3. Ensure the service account has 'Log on as a service' privilege in Local Security Policy (secpol.msc).
4. If service startup times out under heavy boot load, increase ServicesPipeTimeout registry DWORD to 60000ms under HKLM:\\SYSTEM\\CurrentControlSet\\Control.`,
      preventionNotes: 'Migrate static service accounts to Group Managed Service Accounts (gMSA) to eliminate password expiration.',
      status: 'VERIFIED',
      confidenceBasis: 'ADMIN_VERIFIED',
      successCount: 24,
      failureCount: 1,
      createdBy: 'System Operations Team',
      verifiedBy: 'Senior Infrastructure Architect',
      lastUsedAt: new Date(now.getTime() - 172800_000),
    },
    {
      id: 'kb-104',
      workspaceId: workspace.id,
      title: 'Print Spooler Hung or Print Queue Stuck with Corrupted Spool Files',
      normalizedError: 'print spooler hung print queue stuck corrupted spool files deleting offline',
      originalErrorDescription: 'Network printer jobs become stuck in "Deleting..." state, spoolsv.exe crashes or uses 100% CPU, preventing new documents from printing.',
      errorCode: 'PRT_SPOOL_DEADLOCK',
      category: 'HARDWARE',
      assetType: 'PRINTER',
      operatingSystem: 'Windows Server 2022 Datacenter',
      productOrService: 'Windows Print Spooler (spoolsv.exe)',
      environmentNotes: 'Corporate department network printers and central print server.',
      symptoms: JSON.stringify([
        'Print jobs stuck in Deleting... status',
        'Printer queue unresponsive to cancel commands',
        'Spooler service crashes or spikes CPU',
        'Printer displays Offline error',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Check Spooler Service Status',
          command: 'Get-Service -Name Spooler',
          purpose: 'Verify whether spoolsv service is stopped or frozen.',
          expectedResult: 'Status: Running (or Stopped)',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Inspect Spool Directory for Stuck Files',
          command: 'Get-ChildItem -Path C:\\Windows\\System32\\spool\\PRINTERS',
          purpose: 'Identify orphaned .SHD and .SPL payload files.',
          expectedResult: 'Files present: *.SHD, *.SPL',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Test Printer Port Reachability',
          command: 'Test-NetConnection -ComputerName 10.0.1.200 -Port 9100',
          purpose: 'Verify RAW/JetDirect port 9100 responds on target printer.',
          expectedResult: 'TcpTestSucceeded: True',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Stop the Print Spooler service: 'Stop-Service -Name Spooler -Force'.
2. Delete all orphaned spool files: 'Remove-Item -Path C:\\Windows\\System32\\spool\\PRINTERS\\* -Force'.
3. Restart the Print Spooler service: 'Start-Service -Name Spooler'.
4. Re-issue the print job from client.`,
      preventionNotes: 'Deploy Type 4 (v4) printer drivers in isolated process mode to insulate spoolsv.exe against third-party driver crashes.',
      status: 'VERIFIED',
      confidenceBasis: 'ADMIN_VERIFIED',
      successCount: 45,
      failureCount: 3,
      createdBy: 'Endpoint Support Team',
      verifiedBy: 'Senior Infrastructure Architect',
      lastUsedAt: new Date(now.getTime() - 259200_000),
    },
    {
      id: 'kb-105',
      workspaceId: workspace.id,
      title: 'Default Gateway Unreachable or ICMP Ping Echo Request Timeout',
      normalizedError: 'default gateway unreachable icmp ping echo request timeout packet loss err gateway timeout',
      originalErrorDescription: 'Destination host unreachable or 100% packet loss when pinging the upstream default gateway router (10.0.0.254).',
      errorCode: 'ERR_GATEWAY_TIMEOUT',
      category: 'NETWORK',
      assetType: 'ROUTER',
      operatingSystem: 'Windows Server 2022 Datacenter',
      productOrService: 'Edge Firewall & Default Gateway (10.0.0.254)',
      environmentNotes: 'Core routing and edge gateway infrastructure.',
      symptoms: JSON.stringify([
        'Destination host unreachable',
        'Default gateway 10.0.0.254 does not respond to ICMP ping',
        '100% packet loss to external subnets',
        'Request timed out',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Test Local Host Loopback',
          command: 'ping 127.0.0.1 -n 2',
          purpose: 'Verify local TCP/IP stack integrity.',
          expectedResult: 'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Inspect Local ARP Table for Gateway MAC',
          command: 'arp -a 10.0.0.254',
          purpose: 'Check whether gateway MAC address is resolved.',
          expectedResult: 'Valid physical MAC address listed',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Trace Route to Upstream Gateway',
          command: 'tracert -d -h 3 10.0.0.254',
          purpose: 'Pinpoint at which hop traffic drops.',
          expectedResult: 'Hop 1 reachable',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Inspect physical link LED on network adapter and core switch port.
2. Verify client IPv4 default gateway matches subnet definition (10.0.0.254).
3. Clear stale ARP table cache: 'netsh interface ip delete arpcache'.
4. If switch port VLAN changed, reassign port to correct production VLAN.`,
      preventionNotes: 'Enable redundant VRRP/HSRP on core routers and configure BPDU guard on edge access ports.',
      status: 'VERIFIED',
      confidenceBasis: 'ADMIN_VERIFIED',
      successCount: 62,
      failureCount: 2,
      createdBy: 'Network Operations Center',
      verifiedBy: 'Senior Infrastructure Architect',
      lastUsedAt: new Date(now.getTime() - 7200_000),
    },
    {
      id: 'kb-106',
      workspaceId: workspace.id,
      title: 'PostgreSQL Server Connection Refused on TCP Port 5432',
      normalizedError: 'postgresql server connection refused tcp port 5432 pg conn refused fatal',
      originalErrorDescription: 'Database client reports "could not connect to server: Connection refused" when connecting to PostgreSQL host 10.0.2.15:5432.',
      errorCode: 'PG_CONN_REFUSED',
      category: 'DATABASE',
      assetType: 'SERVER',
      operatingSystem: 'Ubuntu Linux 22.04 LTS',
      productOrService: 'PostgreSQL 15 RDBMS',
      environmentNotes: 'Linux database tier hosting production microservices.',
      symptoms: JSON.stringify([
        'could not connect to server: Connection refused',
        'Is the server running on host 10.0.2.15 and accepting TCP/IP connections on port 5432?',
        'ActiveRecord / Prisma connection timeout',
      ]),
      diagnosticSteps: JSON.stringify([
        {
          title: 'Check PostgreSQL Systemd Service',
          command: 'systemctl status postgresql',
          purpose: 'Verify service status is active (running).',
          expectedResult: 'Active: active (running)',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Verify Listening Sockets',
          command: 'ss -tlpn | grep 5432',
          purpose: 'Confirm if listening on 0.0.0.0:5432 or 127.0.0.1:5432.',
          expectedResult: 'LISTEN 0.0.0.0:5432',
          riskRating: 'SAFE_READ_ONLY',
        },
        {
          title: 'Inspect Client Host Access Control',
          command: 'grep -E \'host\' /etc/postgresql/15/main/pg_hba.conf',
          purpose: 'Verify client CIDR subnet is permitted.',
          expectedResult: 'host all all 10.0.0.0/16 scram-sha-256',
          riskRating: 'SAFE_READ_ONLY',
        },
      ]),
      verifiedSolution: `1. Ensure postgresql service is active: 'sudo systemctl restart postgresql'.
2. In postgresql.conf, set 'listen_addresses = "*"'.
3. In pg_hba.conf, append permitted client subnet: 'host all all 10.0.0.0/16 scram-sha-256'.
4. Reload config: 'sudo systemctl reload postgresql'.`,
      preventionNotes: 'Deploy PostgreSQL configuration via Ansible with standard pg_hba.conf subnet templates.',
      status: 'DRAFT',
      confidenceBasis: 'USER_CONFIRMED',
      successCount: 0,
      failureCount: 0,
      createdBy: 'Database Administrator',
      verifiedBy: null,
      lastUsedAt: null,
    },
  ];

  for (const article of knowledgeArticles) {
    await prisma.knowledgeArticle.create({
      data: article,
    });
  }

  console.log(`Seeded ${knowledgeArticles.length} Knowledge Base articles (5 verified, 1 draft).`);
  console.log('Seed completed successfully!');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
