// scripts/capture-screenshots.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

async function capture() {
  console.log(`Using browser at: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1600,1050']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  const screenshots = [
    { name: '01-login-screen.png', url: 'http://localhost:3000/login', wait: 1000 },
  ];

  // 1. Capture Login Page
  console.log('Capturing Login Screen...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '01-login-screen.png') });

  // 2. Perform Login via form or direct cookie
  console.log('Logging in as Admin...');
  await page.type('input[placeholder*="username" i], input[type="text"]', 'Admin');
  await page.type('input[type="password"]', 'Flexflow@i');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' })
  ]);
  await new Promise(r => setTimeout(r, 1000));

  const authScreens = [
    { name: '02-dashboard-overview.png', url: 'http://localhost:3000/', wait: 1500 },
    { name: '03-dependency-map.png', url: 'http://localhost:3000/dependency-map', wait: 2000 },
    { name: '04-diagnostic-workbench.png', url: 'http://localhost:3000/incident/INC-2026-0842', wait: 1500 },
    { name: '05-infrastructure-monitoring.png', url: 'http://localhost:3000/monitoring', wait: 1500 },
    { name: '06-knowledge-base.png', url: 'http://localhost:3000/knowledge-base', wait: 1500 },
    { name: '07-team-rbac-members.png', url: 'http://localhost:3000/members', wait: 1500 },
    { name: '08-asset-inventory.png', url: 'http://localhost:3000/assets', wait: 1500 }
  ];

  for (const s of authScreens) {
    console.log(`Capturing ${s.name} at ${s.url}...`);
    await page.goto(s.url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, s.wait));
    await page.screenshot({ path: path.join(OUT_DIR, s.name) });
  }

  await browser.close();
  console.log('All screenshots captured successfully in docs/screenshots!');
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
