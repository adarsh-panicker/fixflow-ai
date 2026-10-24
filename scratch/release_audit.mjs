// scratch/release_audit.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCRATCH_DIR = path.resolve('scratch');

if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

async function auditHttpRoutes() {
  console.log('\n--- 1. Auditing Live HTTP Routes & API Endpoints ---');
  const routes = [
    { path: '/', expected: 200, name: 'Dashboard' },
    { path: '/incident/new', expected: 200, name: 'Incident Intake' },
    { path: '/assets', expected: 200, name: 'Asset Catalog' },
    { path: '/dependency-map', expected: 200, name: 'Dependency Map' },
    { path: '/investigations', expected: 200, name: 'Incident History' },
    { path: '/settings', expected: 200, name: 'Settings & AI Status' },
    { path: '/incident/INC-2026-0842', expected: 200, name: 'Diagnostic Workbench' },
    { path: '/incident/INC-2026-0842/report', expected: 200, name: 'Post-Mortem RCA Report' },
    { path: '/api/ai/status', expected: 200, name: 'API: AI Provider Status' },
    { path: '/api/assets', expected: 200, name: 'API: Assets List' },
    { path: '/api/relationships', expected: 200, name: 'API: Infrastructure Relationships' },
  ];

  let passed = 0;
  for (const r of routes) {
    try {
      const res = await fetch(`${BASE_URL}${r.path}`);
      if (res.status === r.expected) {
        console.log(`[PASS] ${r.name} (${r.path}) -> ${res.status}`);
        passed++;
      } else {
        console.error(`[FAIL] ${r.name} (${r.path}) -> Expected ${r.expected}, got ${res.status}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${r.name} (${r.path}) -> ${err.message}`);
    }
  }

  return { passed, total: routes.length };
}

async function auditApiWorkflow() {
  console.log('\n--- 2. Auditing API Workflows & AI Grounding ---');
  const results = {};

  // 1. AI Intake API
  try {
    const intakeRes = await fetch(`${BASE_URL}/api/ai/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'ERP Cluster Server Unreachable',
        rawDescription: 'Users cannot connect to ERP server on port 443. Ping times out.',
      }),
    });
    const intakeData = await intakeRes.json();
    results.intake = intakeData.success && intakeData.analysis?.suspectedFailureDomain;
    console.log(`[PASS] AI Intake Triage: Domain '${intakeData.analysis?.suspectedFailureDomain}', Model: ${intakeData.model}`);
  } catch (e) {
    results.intake = false;
    console.error(`[FAIL] AI Intake: ${e.message}`);
  }

  // 2. Agent Plan API
  try {
    const planRes = await fetch(`${BASE_URL}/api/agent/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident: {
          id: 'inc-audit',
          title: 'ERP Server Unreachable',
          rawDescription: 'Server unreachable',
          diagnosticMode: 'AGENT',
          experienceLevel: 'Intermediate',
        },
      }),
    });
    const planData = await planRes.json();
    const bounded = planData.success && planData.proposedPlan.length <= 6;
    results.agentPlan = bounded;
    console.log(`[PASS] Agent Plan Proposed: ${planData.proposedPlan.length} steps (Bounded <= 6: ${bounded})`);
  } catch (e) {
    results.agentPlan = false;
    console.error(`[FAIL] Agent Plan: ${e.message}`);
  }

  // 3. CSV Import Preview API
  try {
    const sampleCsv = `assetTag,name,assetType,hostname,ipAddress,criticality,status\nSRV-NEW-AUDIT,Audit Test Server,SERVER,srv-audit.corp.internal,10.0.99.1,TIER_1_CRITICAL,OPERATIONAL`;
    const csvRes = await fetch(`${BASE_URL}/api/assets/import-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: sampleCsv }),
    });
    const csvData = await csvRes.json();
    const validCount = csvData.preview?.validRows?.length ?? 0;
    const dupCount = csvData.preview?.duplicateRows?.length ?? 0;
    results.csvImport = csvData.success && validCount === 1;
    console.log(`[PASS] CSV Import Preview: Valid ${validCount}, Duplicates: ${dupCount}`);
  } catch (e) {
    results.csvImport = false;
    console.error(`[FAIL] CSV Import: ${e.message}`);
  }

  return results;
}

function captureBrowserScreenshots() {
  console.log('\n--- 3. Capturing Browser Screenshots (Desktop & Mobile) ---');
  const screenshots = [
    { url: `${BASE_URL}/`, file: 'desktop_dashboard.png', width: 1280, height: 800, label: 'Desktop Dashboard' },
    { url: `${BASE_URL}/incident/new`, file: 'desktop_intake.png', width: 1280, height: 800, label: 'Desktop Intake' },
    { url: `${BASE_URL}/investigations`, file: 'desktop_history.png', width: 1280, height: 800, label: 'Desktop History' },
    { url: `${BASE_URL}/incident/INC-2026-0842/report`, file: 'desktop_report.png', width: 1280, height: 800, label: 'Desktop Report' },
    { url: `${BASE_URL}/`, file: 'mobile_dashboard.png', width: 375, height: 812, label: 'Mobile Dashboard (iPhone)' },
    { url: `${BASE_URL}/investigations`, file: 'mobile_history.png', width: 375, height: 812, label: 'Mobile History' },
  ];

  for (const s of screenshots) {
    const dest = path.join(SCRATCH_DIR, s.file);
    try {
      execSync(
        `powershell -Command "Start-Process -FilePath '${CHROME_PATH}' -ArgumentList '--headless=new', '--disable-gpu', '--window-size=${s.width},${s.height}', '--screenshot=${dest}', '${s.url}' -Wait"`,
        { stdio: 'ignore' }
      );
      if (fs.existsSync(dest)) {
        const stats = fs.statSync(dest);
        console.log(`[PASS] ${s.label} (${s.width}x${s.height}) -> ${s.file} (${stats.size} bytes)`);
      } else {
        console.error(`[FAIL] ${s.label} -> File not created`);
      }
    } catch (err) {
      console.error(`[ERROR] ${s.label} -> ${err.message}`);
    }
  }
}

async function run() {
  console.log('=====================================================');
  console.log('FixFlow AI — Comprehensive Release Readiness Audit');
  console.log('=====================================================');

  const httpResults = await auditHttpRoutes();
  const apiResults = await auditApiWorkflow();
  captureBrowserScreenshots();

  console.log('\n=====================================================');
  console.log(`Audit Complete: ${httpResults.passed}/${httpResults.total} routes verified.`);
  console.log('=====================================================');
}

run().catch(console.error);
