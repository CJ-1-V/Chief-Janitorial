/* Scroll position: buttons, checkboxes, href="#", and innerHTML rebuilds.
   Run: node js/v2-keepscroll.test.mjs   (from shifts-secure/cj, needs Google Chrome)
   Not loaded by the app. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const keep = readFileSync(join(dir, 'v2-keepscroll.js'), 'utf8');
const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>keepscroll</title>
<style>body{margin:0;padding-bottom:2400px} #pad{height:2200px} .tw{height:80px;width:220px;overflow:auto;border:1px solid #ccc} .inner{height:400px;width:900px}
#section{margin-top:1600px}</style></head><body>
<div id="app"><main id="main"><h1>People (3)</h1>
<div id="pad"><button type="button" id="btn" data-act="tick" data-id="a">Save</button>
<a href="#" id="hashlink" data-act="tick" data-id="b">Open</a>
<label><input type="checkbox" id="cb" data-act="cjacttick" data-id="c"> Active</label>
<div class="tw" id="box"><div class="inner">scroll me</div></div>
<a href="#" id="bare">Bare hash</a>
<a href="#/people" id="same">Same route</a>
<a href="#/other" id="nav">Other route</a>
<a href="#section" id="jumplink">Section</a>
<div id="section">Section target</div>
<button type="button" id="intent" data-act="intent">Intentional move</button>
</div></main></div>
<script>
var PAGE_STATE = {};
var ME = { type: 'admin', id: '1' };
var MODE = 'same';
var ACT = {
  tick: function () { render(); },
  cjacttick: function () { render(); },
  intent: function () { render(); var s = document.getElementById('section'); if (s) s.scrollIntoView({ block: 'start' }); }
};
function render() {
  var app = document.getElementById('app');
  var html = app.innerHTML;
  if (MODE === 'head') html = html.replace('People (3)', 'Crew list');
  app.innerHTML = html;
  window.scrollTo(0, 0);
  var f = document.querySelector('[data-autofocus]');
  if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) return;
  var f = ACT[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
});
var renderBeforeKeep = render;
window.addEventListener('hashchange', renderBeforeKeep);
location.hash = '#/people';
</script>
<script>${keep}</script>
<script>
window.results = [];
function log(name, ok, extra) { results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function run() {
  log('wrapped', /capture\\(/.test(Function.prototype.toString.call(render)));
  var box = document.getElementById('box');
  box.scrollTop = 40; box.scrollLeft = 30;
  window.scrollTo(0, 900); await sleep(40);
  var y0 = window.scrollY;
  document.getElementById('btn').click(); await sleep(220);
  var box2 = document.getElementById('box');
  log('button keeps window', Math.abs(window.scrollY - y0) < 3, 'y=' + window.scrollY);
  log('button keeps box', !!box2 && Math.abs(box2.scrollTop - 40) < 2 && Math.abs(box2.scrollLeft - 30) < 2, 't=' + (box2 && box2.scrollTop) + ' l=' + (box2 && box2.scrollLeft));

  window.scrollTo(0, 1000); await sleep(30);
  var y1 = window.scrollY;
  document.getElementById('cb').click(); await sleep(220);
  log('checkbox keeps window', Math.abs(window.scrollY - y1) < 3, 'y=' + window.scrollY);

  window.scrollTo(0, 640); await sleep(30);
  var yH = window.scrollY;
  document.getElementById('hashlink').click(); await sleep(220);
  log('action link href=# keeps place', Math.abs(window.scrollY - yH) < 3 && location.hash === '#/people', 'y=' + window.scrollY + ' hash=' + location.hash);

  window.scrollTo(0, 1100); await sleep(30);
  var y2 = window.scrollY, h2 = location.hash;
  document.getElementById('bare').click(); await sleep(220);
  log('bare # keeps place and hash', Math.abs(window.scrollY - y2) < 3 && location.hash === h2, 'y=' + window.scrollY + ' hash=' + location.hash);

  window.scrollTo(0, 800); await sleep(30);
  var y3 = window.scrollY;
  document.getElementById('same').click(); await sleep(80);
  log('repeat route does not jump', Math.abs(window.scrollY - y3) < 3 && location.hash === '#/people', 'y=' + window.scrollY);

  window.scrollTo(0, 700); await sleep(30);
  var btn = document.getElementById('btn');
  try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
  var y4 = window.scrollY;
  document.getElementById('app').innerHTML = document.getElementById('app').innerHTML;
  await sleep(220);
  log('innerHTML rebuild keeps window', Math.abs(window.scrollY - y4) < 3, 'y=' + window.scrollY);

  window.scrollTo(0, 650); await sleep(30);
  var y5 = window.scrollY, old = document.getElementById('pad');
  var holder = document.createElement('div'); holder.innerHTML = old.outerHTML;
  old.parentNode.replaceChild(holder.firstElementChild, old);
  await sleep(220);
  log('replaceChild keeps window', Math.abs(window.scrollY - y5) < 3, 'y=' + window.scrollY);

  window.scrollTo(0, 400); await sleep(30);
  document.getElementById('jumplink').click(); await sleep(80);
  log('in-page #section still navigates', location.hash === '#section', 'hash=' + location.hash + ' y=' + window.scrollY);

  location.hash = '#/people'; await sleep(60);
  MODE = 'head';
  window.scrollTo(0, 720); await sleep(30);
  var y6 = window.scrollY;
  document.getElementById('btn').click(); await sleep(220);
  log('heading change still starts at top', window.scrollY < 3, 'y=' + window.scrollY + ' h=' + (document.querySelector('h1') && document.querySelector('h1').textContent));

  location.hash = '#/people'; await sleep(60);
  MODE = 'same';
  window.scrollTo(0, 500); await sleep(30);
  document.getElementById('intent').click(); await sleep(220);
  var sec2 = document.getElementById('section').getBoundingClientRect().top;
  log('scrollIntoView after render still wins', Math.abs(sec2) < 80, 'top=' + Math.round(sec2) + ' y=' + window.scrollY);

  window.scrollTo(0, 600); await sleep(30);
  PAGE_STATE.ksTop = true; render(); await sleep(80);
  log('ksTop still starts at top', window.scrollY < 3, 'y=' + window.scrollY);

  window.scrollTo(0, 550); await sleep(30);
  document.getElementById('nav').click(); await sleep(220);
  log('route change still starts at top', location.hash === '#/other' && window.scrollY < 3, 'hash=' + location.hash + ' y=' + window.scrollY);

  var p = document.createElement('pre');
  p.id = 'ksout';
  p.textContent = results.join(String.fromCharCode(10));
  document.body.appendChild(p);
}
window.addEventListener('load', function () { setTimeout(run, 40); });
</script></body></html>`;

const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/t.html?t=${Date.now()}`;
const chrome = process.env.CHROME || 'google-chrome';
const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-cache', '--window-size=900,700', '--virtual-time-budget=8000', '--dump-dom', url];
const code = await new Promise((resolve) => {
  const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; });
  child.stderr.on('data', () => {});
  const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 124, buf }); }, 25000);
  child.on('exit', (c) => { clearTimeout(timer); resolve({ code: c, buf }); });
});
server.close();
const text = code.buf || '';
const all = [...text.matchAll(/<pre id="ksout">([\s\S]*?)<\/pre>/g)];
const m = all.length ? all[all.length - 1] : null;
if (!m) {
  const hits = text.match(/PASS [^\n<]+|FAIL [^\n<]+/g);
  console.error(hits ? hits.join('\n') : 'no result lines');
  console.error('bytes', text.length, 'chrome exit', code.code);
  process.exit(1);
}
const lines = m[1].replace(/&lt;/g, '<').split('\n').filter(Boolean);
let failed = 0;
for (const line of lines) {
  console.log(line);
  if (line.startsWith('FAIL')) failed++;
}
if (failed) process.exit(1);
