/* Opens the portal in headless Chrome on ?store=mock and checks the rendered pages.
   Does not contact a database. Screenshots go to the path in SHOTS, then the caller copies them. */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..', '..');
const PORT = 8765;
const ORIGIN = 'http://127.0.0.1:' + PORT + '/shifts-secure/cj/client/';
const SHOTS = process.env.CJ_SHOTS || path.join('/tmp', 'cj-client-shots');
const CHROME = process.env.CHROME || '/opt/google/chrome/chrome';
const ASOF = '2026-10-28';

function startServer() {
  return new Promise(function (resolve, reject) {
    const child = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const timer = setTimeout(function () { reject(new Error('server did not listen')); }, 8000);
    function ready() {
      const req = http.get('http://127.0.0.1:' + PORT + '/', function (res) {
        res.resume();
        clearTimeout(timer);
        resolve(child);
      });
      req.on('error', function () { setTimeout(ready, 150); });
    }
    child.on('error', reject);
    setTimeout(ready, 200);
  });
}

function chrome(args) {
  return new Promise(function (resolve, reject) {
    const profile = fs.mkdtempSync(path.join('/tmp', 'cj-chrome-'));
    const child = spawn(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-first-run',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1280,1200',
      '--default-background-color=FFFFFFFF',
      '--user-data-dir=' + profile
    ].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(function () {
      child.kill('SIGKILL');
      reject(new Error('chrome timed out\n' + err.slice(-400)));
    }, 20000);
    child.stdout.on('data', function (b) { out += b; });
    child.stderr.on('data', function (b) { err += b; });
    child.on('error', function (e) { clearTimeout(timer); reject(e); });
    child.on('close', function (code) {
      clearTimeout(timer);
      if (code !== 0 && !out) reject(new Error('chrome ' + code + '\n' + err.slice(-500)));
      else resolve(out);
    });
  });
}

function portalData(dom) {
  const m = dom.match(/<main id="portal-data">([\s\S]*?)<\/main>/);
  return m ? m[1] : '';
}

function url(query, hash) {
  return ORIGIN + '?' + query + (hash || '');
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const failures = [];
  function check(name, ok, detail) {
    if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
  }
  try {
    const north = 'store=mock&demo=north&asof=' + ASOF;
    const pages = [
      ['visits', 'Visits', path.join(SHOTS, 'cj_client_visits.png')],
      ['checklists', 'Checklists', path.join(SHOTS, 'cj_client_checklists.png')],
      ['invoices', 'Invoices', path.join(SHOTS, 'cj_client_invoices.png')]
    ];
    for (const [page, heading, shot] of pages) {
      const dom = await chrome(['--dump-dom', url(north + '&page=' + page, '#/' + page)]);
      const data = portalData(dom);
      check(page + ' heading', data.indexOf('<h1>' + heading + '</h1>') >= 0, 'missing h1');
      check(page + ' own site', data.indexOf('NSP-01') >= 0 || page === 'invoices');
      check(page + ' other site hidden', data.indexOf('HSC-01') < 0);
      check(page + ' other client hidden', data.indexOf('Harbour Sample Clinic') < 0);
      check(page + ' worker name hidden', data.indexOf('Hiddenworker') < 0);
      check(page + ' pay hidden', data.indexOf('18.75') < 0 && data.indexOf('PAY-SECRET') < 0);
      check(page + ' rate hidden', data.indexOf('24.50') < 0 && data.indexOf('RATE-SECRET') < 0);
      check(page + ' other invoice hidden', data.indexOf('HB-SMC-008') < 0);
      await chrome(['--screenshot=' + shot, url(north + '&page=' + page, '#/' + page)]);
      check(page + ' screenshot', fs.existsSync(shot) && fs.statSync(shot).size > 1000);
    }

    const visits = portalData(await chrome(['--dump-dom', url(north, '#/visits')]));
    check('visits show times', visits.indexOf('18:00') >= 0 && visits.indexOf('21:30') >= 0);
    check('visits show crew numbers', visits.indexOf('Crew 1') >= 0 && visits.indexOf('Crew 2') >= 0 && visits.indexOf('Cleaner') >= 0);
    check('visits show both own sites', visits.indexOf('NSP-02') >= 0 && visits.indexOf('North lobby') >= 0);

    const hours = portalData(await chrome(['--dump-dom', url(north, '#/hours')]));
    check('hours total', hours.indexOf('9.50 h') >= 0);
    check('hours rows', hours.indexOf('3.50 h') >= 0 && hours.indexOf('3.00 h') >= 0);
    check('hours hide other site', hours.indexOf('HSC-01') < 0 && hours.indexOf('Hiddenworker') < 0);

    const harbour = portalData(await chrome(['--dump-dom', url('store=mock&demo=harbour&asof=' + ASOF, '#/visits')]));
    check('harbour sees own site', harbour.indexOf('HSC-01') >= 0 && harbour.indexOf('Clinic sample wing') >= 0);
    check('harbour cannot see North sites', harbour.indexOf('NSP-01') < 0 && harbour.indexOf('North lobby') < 0 && harbour.indexOf('NSP-02') < 0);
    check('harbour crew label', harbour.indexOf('Cleaner') >= 0);
    check('harbour hides worker name', harbour.indexOf('Hiddenworker') < 0 && harbour.indexOf('Sam Hiddenworker') < 0);

    const quiet = portalData(await chrome(['--dump-dom', url('store=mock&demo=quiet&asof=' + ASOF, '#/visits')]));
    check('quiet empty', quiet.indexOf('No visits in this period.') >= 0);
    check('quiet sees no sites', quiet.indexOf('NSP-01') < 0 && quiet.indexOf('HSC-01') < 0);

    const closed = await chrome(['--dump-dom', ORIGIN]);
    check('closed screen', closed.indexOf('does not call the database') >= 0);
    check('closed hides demo sites', closed.indexOf('NSP-01') < 0 && closed.indexOf('Hiddenworker') < 0 && closed.indexOf('id="portal-data"') < 0);

    const doc = portalData(await chrome(['--dump-dom', url(north, '#/invoice/NS-PLZ-035')]));
    check('invoice number', doc.indexOf('NS-PLZ-035') >= 0 && doc.indexOf('<h1>Invoice NS-PLZ-035</h1>') >= 0);
    check('tax line', doc.indexOf('GST/HST 755653946 RT0001 at 15%') >= 0);
    check('contact email', doc.indexOf('admin@chiefjanitorial.com') >= 0);
    check('e-transfer', doc.indexOf('e-transfer to admin@chiefjanitorial.com') >= 0);
    check('cheque address', doc.indexOf('cheque payable to Chief Janitorial Inc., mailed to Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1') >= 0);
    check('interest wording', doc.indexOf('2% a month') >= 0);
    check('invoice hides other client', doc.indexOf('HB-SMC-008') < 0 && doc.indexOf('Hiddenworker') < 0 && doc.indexOf('24.50') < 0);
    const shot = path.join(SHOTS, 'cj_client_invoice.png');
    await chrome(['--window-size=1280,1120', '--screenshot=' + shot, url(north, '#/invoice/NS-PLZ-035')]);
    check('invoice screenshot', fs.existsSync(shot) && fs.statSync(shot).size > 1000);

    const oldInv = portalData(await chrome(['--dump-dom', url(north, '#/invoice/NS-PLZ-033')]));
    check('stored older invoice', oldInv.indexOf('Invoice NS-PLZ-033') >= 0 && oldInv.indexOf('Payable within 30 days.') >= 0);
    check('older invoice is not rewritten', oldInv.indexOf('e-transfer') < 0 && oldInv.indexOf('755653946') < 0 && oldInv.indexOf('2% a month') < 0 && oldInv.indexOf('admin@chiefjanitorial.com') < 0);

    const chooser = await chrome(['--dump-dom', url('store=mock')]);
    check('chooser', chooser.indexOf('North Sample Plaza') >= 0 && chooser.indexOf('Harbour Sample Clinic') >= 0);
    check('chooser hides sites and names', chooser.indexOf('NSP-01') < 0 && chooser.indexOf('Hiddenworker') < 0);
  } finally {
    server.kill('SIGTERM');
  }

  if (failures.length) {
    console.error('FAILED\n' + failures.map(function (f) { return ' - ' + f; }).join('\n'));
    process.exit(1);
  }
  console.log('browser checks passed');
  console.log('screenshots: ' + SHOTS);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
