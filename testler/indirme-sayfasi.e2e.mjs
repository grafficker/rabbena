// Rabbena indirme sayfasi (index.html) icin gercek-tarayici (Chrome/CDP) davranis testi.
// Kullanim: node indirme-sayfasi.e2e.mjs <sayfa-url> <axe.min.js yolu> <cikti-dizini>
// Magaza istekleri Fetch.failRequest ile durdurulur; yalnizca hedef URL kaydedilir.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [BASE, AXE, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const IOS = 'https://apps.apple.com/app/id6818886786';
const PLAY = 'https://play.google.com/store/apps/details?id=com.velnomi.rabbena';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const prof = mkdtempSync(join(tmpdir(), 'chr-'));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9333', '--no-sandbox',
  '--user-data-dir=' + prof, '--hide-scrollbars=false', 'about:blank'], { stdio: 'ignore' });
let ver;
for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:9333/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const listeners = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else listeners.forEach(l => l(m)); };
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

async function oturum(opts = {}) {
  const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
  const sessionId = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  const s = (m, p) => send(m, p, sessionId);
  const istekler = [];
  const l = m => { if (m.sessionId === sessionId && m.method === 'Fetch.requestPaused') {
      const u = m.params.request.url;
      if (/apps\.apple\.com|play\.google\.com/.test(u)) { istekler.push(u); s('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Aborted' }); }
      else s('Fetch.continueRequest', { requestId: m.params.requestId }); } };
  listeners.push(l);
  await s('Page.enable'); await s('Runtime.enable');
  await s('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  if (opts.ua) await s('Emulation.setUserAgentOverride', { userAgent: opts.ua });
  if (opts.touch) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: opts.touch });
  if (opts.w) await s('Emulation.setDeviceMetricsOverride', { width: opts.w, height: opts.h || 800, deviceScaleFactor: 1, mobile: !!opts.mobile });
  const ev = async expr => { const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (process.env.DBG && r.result?.result?.value === undefined) console.log('EVDBG', JSON.stringify(r).slice(0, 400)); return r.result?.result?.value; };
  const git = async url => { const n = await s('Page.navigate', { url }); if (process.env.DBG) console.log('NAV', JSON.stringify(n).slice(0, 300)); await sleep(900); };
  const kapat = () => { listeners.splice(listeners.indexOf(l), 1); return send('Target.closeTarget', { targetId }); };
  return { s, ev, git, istekler, kapat };
}

const sonuc = []; let gecen = 0, kalan = 0;
function kontrol(ad, ok, ayrinti) { ok ? gecen++ : kalan++; sonuc.push({ ad, ok, ayrinti }); console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (ayrinti ? '  -> ' + ayrinti : '')); }

// 1) Masaustu: kampanya parametresi senaryolari
const uzun = 'a'.repeat(100);
const durumlar = [
  ['yok', '', null], ['bos', '?k=', ''], ['normal', '?k=cuma_2026-10', 'cuma_2026-10'],
  ['bosluk+etiket', '?k=' + encodeURIComponent('a b<script>alert(1)</script>'), 'abscriptalert1script'],
  ['img-onerror', '?k=' + encodeURIComponent('"><img src=x onerror=alert(1)>'), 'imgsrcxonerroralert1'],
  ['url-ayiraclari', '?k=' + encodeURIComponent('a&b=c#d?e/f'), 'abcdef'],
  ['yol-gecisi', '?k=' + encodeURIComponent('../../etc/passwd'), 'etcpasswd'],
  ['cok-uzun-100', '?k=' + uzun, 'a'.repeat(40)],
  ['unicode', '?k=' + encodeURIComponent('ağüşİı١٢'), 'a'],
  ['nul-yuzde', '?k=%00%0d%0aX', 'X'],
  ['javascript-sema', '?k=' + encodeURIComponent('javascript:alert(1)'), 'javascriptalert1'],
  ['yinelenen-k', '?k=ilk&k=ikinci', 'ilk'],
  ['buyuk-harf', '?k=ABC_def', 'ABC_def'],
];
for (const [ad, qs, beklenenK] of durumlar) {
  const t = await oturum();
  let dialog = false; const dl = m => { if (m.method === 'Page.javascriptDialogOpening') dialog = true; }; listeners.push(dl);
  await t.git(BASE + qs);
  console.log('DBG2', await t.ev('location.href+" "+document.readyState+" "+document.title'));
  const h = await t.ev('JSON.stringify({ios:document.getElementById("ios").href,and:document.getElementById("android").href,url:location.href,inj:document.querySelectorAll("img[src=x],script:not([src])").length})');
  const o = JSON.parse(h);
  const kBek = beklenenK === '' || beklenenK === null ? '' : beklenenK;
  const iosBek = kBek ? IOS + '?ct=' + kBek : IOS;
  const playBek = kBek ? PLAY + '&referrer=' + encodeURIComponent('utm_source=rabbena&utm_medium=paylasim&utm_campaign=' + kBek) : PLAY;
  kontrol(`[masaustu] ${ad}: iOS hedefi`, o.ios === iosBek, o.ios);
  kontrol(`[masaustu] ${ad}: Android hedefi`, o.and === playBek, o.and);
  kontrol(`[masaustu] ${ad}: sayfada kalir, enjekte eleman/dialog yok`, o.url.startsWith(BASE) && t.istekler.length === 0 && !dialog && o.inj === 1, `istek=${t.istekler.length} inj=${o.inj} dialog=${dialog}`);
  listeners.splice(listeners.indexOf(dl), 1); await t.kapat();
}

// 2) Masaustu tarayici ile baglanti tiklamasi ve baglanti hedefleri
{
  const t = await oturum();
  await t.git(BASE + '?k=test1');
  const hrefler = JSON.parse(await t.ev('JSON.stringify([...document.querySelectorAll("a")].map(a=>({t:a.textContent,h:a.href,rel:a.rel,target:a.target})))'));
  writeFileSync(join(OUT, 'baglantilar.json'), JSON.stringify(hrefler, null, 1));
  kontrol('[masaustu] 4 baglanti, hepsi https', hrefler.length === 4 && hrefler.every(a => a.h.startsWith('https://')), JSON.stringify(hrefler.map(a => a.h)));
  await t.ev('document.getElementById("ios").click()'); await sleep(600);
  kontrol('[masaustu] App Store dugmesi tiklaninca ct=test1 ile gider', t.istekler.some(u => u === IOS + '?ct=test1'), t.istekler.join(' '));
  await t.kapat();
}

// 3) UA emulasyonu (GERCEK CIHAZ DEGIL): yonlendirme mantigi
const uas = {
  'iPhone Safari': ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 0, 'ios'],
  'iPad (iPadOS UA Macintosh + dokunmatik)': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 5, 'ios'],
  'Mac masaustu Safari (dokunmatik yok)': ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 0, 'kal'],
  'Android Chrome': ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 0, 'play'],
  'Windows Chrome': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 0, 'kal'],
  'Android "masaustu site" modu (Linux UA)': ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 0, 'kal'],
};
for (const [ad, [ua, touch, bek]] of Object.entries(uas)) {
  for (const qs of ['', '?k=cuma']) {
    const t = await oturum({ ua, touch });
    await t.git(BASE + qs);
    const k = qs ? 'cuma' : '';
    const iosH = k ? IOS + '?ct=cuma' : IOS;
    const playH = k ? PLAY + '&referrer=' + encodeURIComponent('utm_source=rabbena&utm_medium=paylasim&utm_campaign=cuma') : PLAY;
    const hedef = bek === 'ios' ? iosH : bek === 'play' ? playH : null;
    const ok = hedef ? (t.istekler.length === 1 && t.istekler[0] === hedef) : t.istekler.length === 0;
    kontrol(`[UA emulasyonu] ${ad} ${qs || '(k yok)'} -> ${bek}`, ok, t.istekler.join(' ') || 'sayfada kaldi');
    await t.kapat();
  }
}

// 4) axe-core + klavye + odak + yakinlastirma/dar ekran
{
  const axeSrc = readFileSync(AXE, 'utf8');
  const t = await oturum({ w: 1280, h: 800 });
  await t.git(BASE);
  await t.ev(axeSrc);
  const axe = JSON.parse(await t.ev('axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]}}).then(r=>JSON.stringify({v:axe.version,viol:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>n.target.join(" ")+" :: "+(n.any[0]||n.all[0]||n.none[0]||{}).message)})),inc:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target.join(" "))})),pass:r.passes.length}))'));
  writeFileSync(join(OUT, 'axe.json'), JSON.stringify(axe, null, 1));
  console.log('AXE', axe.v, 'ihlal:', axe.viol.length, 'belirsiz:', axe.inc.length, 'gecen kural:', axe.pass); console.log(JSON.stringify(axe.viol, null, 1)); console.log('INCOMPLETE', JSON.stringify(axe.inc));
  kontrol('[axe] ihlal yok (wcag2a/aa/21/22aa + best-practice)', axe.viol.length === 0, axe.viol.map(v => v.id).join(','));

  // Klavye: Tab sirasi ve gorunur odak
  const sira = [];
  for (let i = 0; i < 5; i++) {
    await t.s('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await t.s('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const d = JSON.parse(await t.ev('(()=>{const e=document.activeElement;const c=getComputedStyle(e);return JSON.stringify({id:e.id,t:e.textContent.slice(0,20),fv:e.matches(":focus-visible"),ol:c.outlineStyle+" "+c.outlineWidth+" "+c.outlineColor})})()'));
    sira.push(d);
    if (i < 4) { const clip = await t.ev('(()=>{const r=document.activeElement.getBoundingClientRect();return JSON.stringify({x:Math.max(0,r.x-12),y:Math.max(0,r.y-12),width:r.width+24,height:r.height+24,scale:1})})()'); const sc = await t.s('Page.captureScreenshot', { format: 'png', clip: JSON.parse(clip) }); writeFileSync(join(OUT, `odak-${i + 1}.png`), Buffer.from(sc.result.data, 'base64')); }
  }
  writeFileSync(join(OUT, 'klavye-sirasi.json'), JSON.stringify(sira, null, 1));
  console.log('TAB SIRASI', JSON.stringify(sira));
  kontrol('[klavye] 4 etkilesimli oge, gorsel sirayla (iOS, Android, Gizlilik, Destek) ve odak gorunur', sira[0].id === 'ios' && sira[1].id === 'android' && /Gizlilik/.test(sira[2].t) && /Destek/.test(sira[3].t) && sira.slice(0, 4).every(d => d.fv && !d.ol.startsWith('none')), JSON.stringify(sira.slice(0, 4).map(d => d.ol)));

  // Hedef boyutu ve kontrast
  const olc = JSON.parse(await t.ev(`JSON.stringify([...document.querySelectorAll("a")].map(a=>{const r=a.getBoundingClientRect();return {t:a.textContent,w:Math.round(r.width),h:Math.round(r.height)}}))`));
  writeFileSync(join(OUT, 'hedef-boyutlari.json'), JSON.stringify(olc, null, 1)); console.log('HEDEF', JSON.stringify(olc));
  // SC 2.5.8: 24x24'ten kucuk hedefler icin ortalanmis 24px dairenin baska hedefe degmemesi (bosluk istisnasi)
  const kutu = JSON.parse(await t.ev(`JSON.stringify([...document.querySelectorAll("a")].map(a=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))`));
  const daireDegiyor = (a, b) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w)), dy = Math.max(b.y - cy, 0, cy - (b.y + b.h)); return Math.hypot(dx, dy) < 12; };
  const ihlal258 = kutu.filter((a, i) => (a.w < 24 || a.h < 24) && kutu.some((b, j) => i !== j && daireDegiyor(a, b)));
  kontrol('[hedef] WCAG 2.2 SC 2.5.8: <24px hedeflerde bosluk istisnasi saglanir', ihlal258.length === 0, JSON.stringify(olc));
  console.log('BILGI 44px (AAA 2.5.5, sayilmaz):', olc.filter(a => a.w < 44 || a.h < 44).map(a => `${a.t} ${a.w}x${a.h}`).join('; '));
  const sg = await t.s('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, 'masaustu-1280.png'), Buffer.from(sg.result.data, 'base64'));
  await t.kapat();

  // Dar ekran / yakinlastirma: 320px (= 1280px @ %400 esdegeri), 200% = 640px
  for (const [ad, w, h] of [['320px (WCAG 1.4.10 / %400 esdeger)', 320, 640], ['640px (%200 esdeger)', 640, 800], ['375x667 telefon', 375, 667]]) {
    const u = await oturum({ w, h, mobile: false });
    await u.git(BASE);
    const o = JSON.parse(await u.ev('JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight})'));
    kontrol(`[dar ekran] ${ad}: yatay kaydirma yok`, o.sw <= o.cw, JSON.stringify(o));
    const sc = await u.s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(join(OUT, `genislik-${w}.png`), Buffer.from(sc.result.data, 'base64'));
    await u.kapat();
  }
  // Metin boyutu 200% (varsayilan font iki katina)
  const u = await oturum({ w: 640, h: 800 }); await u.git(BASE);
  await u.ev('document.documentElement.style.fontSize="200%"');
  const o2 = JSON.parse(await u.ev('JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})'));
  kontrol('[metin %200] yatay kaydirma yok (640px + font %200)', o2.sw <= o2.cw, JSON.stringify(o2));
  await u.kapat();
}

writeFileSync(join(OUT, 'sonuc.json'), JSON.stringify({ base: BASE, gecen, kalan, sonuc }, null, 1));
console.log(`\nTOPLAM gecen=${gecen} kalan=${kalan}`);
ws.close(); chrome.kill(); process.exit(kalan > 0 ? 1 : 0);
