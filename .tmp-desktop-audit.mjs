import express from 'express';
import path from 'node:path';
import { chromium } from 'patchright';

const dist = path.resolve('desktop/dist');
const app = express();
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const now = Date.now();
const d = (days) => new Date(now - days * 86400000).toISOString();
const product = {
  id: 'mikrotik-crs326-24s', name: 'MikroTik CRS326-24S+2Q+RM', modelNumber: 'CRS326-24S+2Q+RM',
  brand: 'MikroTik', category: 'Networking Switch', description: '24-port switch',
  addedAt: d(30), lastRefreshed: d(0), isWatched: true, tags: [],
  listings: [
    { distributorId: 'server2u-my', productId: 'mikrotik-crs326-24s', price: 5568, currency: 'MYR', stockStatus: 'in_stock', url: 'https://server2u.com/p', lastChecked: d(0), priceHistory: [{date:d(30),price:5900,currency:'MYR',stockStatus:'in_stock'},{date:d(10),price:5700,currency:'MYR',stockStatus:'in_stock'},{date:d(0),price:5568,currency:'MYR',stockStatus:'in_stock'}] },
    { distributorId: 'getic-gr', productId: 'mikrotik-crs326-24s', price: 394.25, currency: 'EUR', stockStatus: 'in_stock', url: 'https://getic.com/p', lastChecked: d(0), priceHistory: [{date:d(20),price:420,currency:'EUR',stockStatus:'in_stock'},{date:d(0),price:394.25,currency:'EUR',stockStatus:'in_stock'}] },
    { distributorId: 'linitx-uk', productId: 'mikrotik-crs326-24s', price: 320, currency: 'GBP', stockStatus: 'back_order', url: 'https://linitx.com/p', lastChecked: d(0), priceHistory: [] },
  ],
};
const alert = { id: 'a1', productId: product.id, targetPrice: 350, currency: 'EUR', isActive: true, createdAt: d(5), direction: 'drop' };
const reminder = { id: 'r1', productId: product.id, productName: product.name, distributorId: 'getic-gr', distributorName: 'Getic', reminderDate: new Date(now + 7 * 86400000).toISOString(), createdAt: d(2), reminderType: 'date' };

const LAYOUT = () => {
  const vw = window.innerWidth; const problems = []; const seen = new Map();
  const clipped = (el) => { const r = el.getBoundingClientRect(); let n = el.parentElement; while (n && n !== document.documentElement) { const s = getComputedStyle(n); if (s.overflowX === 'hidden' || s.overflowX === 'clip') { const b = n.getBoundingClientRect(); if (r.right > b.right + 1 || r.left < b.left - 1) return true; } n = n.parentElement; } return false; };
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], a, [role="tab"], [role="checkbox"], [role="radio"]'))) {
    const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim(); if (!label) continue;
    seen.set(label, (seen.get(label) || 0) + 1);
    if (r.left < -1 || r.right > vw + 1) problems.push('off-screen: ' + label); else if (clipped(el)) problems.push('clipped: ' + label);
    if (r.width < 40 || r.height < 40) problems.push('small ' + Math.round(r.width) + 'x' + Math.round(r.height) + ': ' + label);
  }
  for (const [label, n] of seen) if (n > 1) problems.push('duplicate x' + n + ': ' + label);
  if (document.documentElement.scrollWidth - vw > 1) problems.push('overflow ' + (document.documentElement.scrollWidth - vw));
  return Array.from(new Set(problems));
};
const CONTRAST = () => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r:p[0],g:p[1],b:p[2],a:p[3]??1 }; };
  const blend=(f,bg)=>({r:f.r*f.a+bg.r*(1-f.a),g:f.g*f.a+bg.g*(1-f.a),b:f.b*f.a+bg.b*(1-f.a),a:1});
  const lum=({r,g,b})=>{const f=(c)=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const ratio=(a,b2)=>{const l1=lum(a),l2=lum(b2);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const bgOf=(el)=>{let bg={r:255,g:255,b:255,a:1};let n=el;while(n&&n!==document.documentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0){bg=blend(c,bg);if(c.a>=1)break;}n=n.parentElement;}return bg;};
  const out=[];
  for(const el of Array.from(document.querySelectorAll('*'))){const text=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!text)continue;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)continue;const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;const fg=parse(s.color);if(!fg)continue;const bg=bgOf(el);const eff=fg.a<1?blend(fg,bg):fg;const cr=ratio(eff,bg);const size=parseFloat(s.fontSize);const wt=parseInt(s.fontWeight,10)||400;const icon=/^[\uE000-\uF8FF\s]+$/.test(text);const need=(icon||size>=24||(size>=18.66&&wt>=700))?3:4.5;if(cr+0.01<need)out.push({t:text.slice(0,30),r:Math.round(cr*100)/100,need,size:Math.round(size)});}
  const seen=new Set();return out.filter(f=>{const k=f.t+f.r+f.size;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
};
const routes = ['/', '/watchlist', '/alerts', '/drops', '/restock-watches', '/search', '/rates', '/stats', '/health', '/distributor-analysis', '/settings', '/product/mikrotik-crs326-24s', '/compare/mikrotik-crs326-24s', '/health/server2u-my', '/w/00000000-0000-4000-8000-000000000000'];
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  for (const width of [1024, 1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    await ctx.addInitScript(({ product, alert, reminder }) => {
      localStorage.setItem('has_seen_onboarding', 'true');
      localStorage.setItem('watchlist_products', JSON.stringify([product]));
      localStorage.setItem('price_alerts', JSON.stringify([alert]));
      localStorage.setItem('back_order_reminders', JSON.stringify([reminder]));
    }, { product, alert, reminder });
    const p = await ctx.newPage();
    for (const route of routes) {
      await p.goto(base + '/#' + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await p.waitForTimeout(800);
      const layout = await p.evaluate(LAYOUT);
      const contrast = await p.evaluate(CONTRAST);
      if (layout.length || contrast.length) {
        console.log(`\n${scheme} ${width} ${route}`);
        for (const x of layout.slice(0, 10)) console.log('  L', x);
        for (const x of contrast.slice(0, 6)) console.log('  C', JSON.stringify(x));
      }
    }
    await ctx.close();
    console.log(`${scheme} ${width} done`);
  }
}
await browser.close();
server.close();
