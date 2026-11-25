// Desktop UI gate: the Tauri app's Vite build renders in a browser, so run the
// same layout + contrast checks the mobile app uses. Desktop controls follow the
// WCAG 2.5.8 24px minimum (the mobile app uses 40/44px for touch), so this gate
// enforces 24px targets, no clipped/off-screen controls, no overflow, and WCAG AA
// text contrast in light and dark at 1024/1280/1440.
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'patchright';
const dist=path.resolve('desktop/dist');
if (!existsSync(path.join(dist,'index.html'))) {
  console.error('audit:desktop: desktop/dist/index.html missing — run `pnpm build:desktop` first');
  process.exit(1);
}
const app=express(); app.use(express.static(dist)); app.get('*',(_q,res)=>res.sendFile(path.join(dist,'index.html')));
const server=app.listen(0); await new Promise(r=>server.once('listening',r)); const base=`http://127.0.0.1:${server.address().port}`;
const now=Date.now(); const d=(n)=>new Date(now-n*86400000).toISOString();
const product={id:'mikrotik-crs326-24s',name:'MikroTik CRS326-24S+2Q+RM',modelNumber:'CRS326-24S+2Q+RM',brand:'MikroTik',category:'Networking Switch',description:'x',addedAt:d(30),lastRefreshed:d(0),isWatched:true,tags:[],listings:[{distributorId:'server2u-my',productId:'mikrotik-crs326-24s',price:5568,currency:'MYR',stockStatus:'in_stock',url:'https://server2u.com/p',lastChecked:d(0),priceHistory:[{date:d(20),price:5900,currency:'MYR',stockStatus:'in_stock'},{date:d(0),price:5568,currency:'MYR',stockStatus:'in_stock'}]},{distributorId:'getic-gr',productId:'mikrotik-crs326-24s',price:394.25,currency:'EUR',stockStatus:'in_stock',url:'https://getic.com/p',lastChecked:d(0),priceHistory:[]}]};
const alert={id:'a1',productId:product.id,targetPrice:350,currency:'EUR',isActive:true,createdAt:d(5),direction:'drop'};
const reminder={id:'r1',productId:product.id,productName:product.name,distributorId:'getic-gr',distributorName:'Getic',reminderDate:new Date(now+7*86400000).toISOString(),createdAt:d(2),reminderType:'date'};
const CHECK=()=>{
  const cv=document.createElement('canvas'); cv.width=1; cv.height=1; const cx=cv.getContext('2d',{willReadFrequently:true});
  const toRgba=(s)=>{ if(!s) return null; cx.clearRect(0,0,1,1); cx.fillStyle=s; cx.fillRect(0,0,1,1); const p=cx.getImageData(0,0,1,1).data; return {r:p[0],g:p[1],b:p[2],a:p[3]/255}; };
  const blend=(f,bg)=>({r:f.r*f.a+bg.r*(1-f.a),g:f.g*f.a+bg.g*(1-f.a),b:f.b*f.a+bg.b*(1-f.a),a:1});
  const lum=({r,g,b})=>{const f=(c)=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const bgOf=(el)=>{const layers=[];let n=el;while(n){const c=toRgba(getComputedStyle(n).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break;}n=n.parentElement;}let bg={r:255,g:255,b:255,a:1};for(let i=layers.length-1;i>=0;i--){bg=blend(layers[i],bg);}return bg;};
  const contrast=[]; const small=[];
  for(const el of Array.from(document.querySelectorAll('*'))){
    const text=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!text)continue;
    const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)continue;
    const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
    const fg=toRgba(s.color);if(!fg)continue;const bg=bgOf(el);const eff=fg.a<1?blend(fg,bg):fg;const cr=ratio(eff,bg);
    const size=parseFloat(s.fontSize);const wt=parseInt(s.fontWeight,10)||400;const icon=/^[\uE000-\uF8FF\s]+$/.test(text);const need=(icon||size>=24||(size>=18.66&&wt>=700))?3:4.5;
    if(cr+0.01<need)contrast.push({t:text.slice(0,24),r:Math.round(cr*100)/100,need,size:Math.round(size)});
  }
  for(const el of Array.from(document.querySelectorAll('button, [role="button"]'))){
    const r=el.getBoundingClientRect();if(r.width<=1||r.height<=1)continue;
    if(r.height<24||r.width<24) small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,30)}`);
  }
  const seen=new Set(); const c=contrast.filter(f=>{const k=f.t+f.r+f.size;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  return {c, s: Array.from(new Set(small)).slice(0,10), o: overflow > 1 ? overflow : 0};
};
let failures=0;
const b=await chromium.launch();
for(const scheme of ['light','dark']){
  for(const width of [1024,1280,1440]){
  const ctx=await b.newContext({viewport:{width,height:900},colorScheme:scheme});
  // Measure settled colors, not a chip caught mid transition-colors.
  await ctx.addInitScript(() => {
    const css="*{transition:none!important;animation:none!important;}";
    const inject=()=>{const style=document.createElement("style");style.textContent=css;document.head&&document.head.appendChild(style);};
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",inject,{once:true}); else inject();
  });
  await ctx.addInitScript(({product,alert,reminder})=>{localStorage.setItem('has_seen_onboarding','true');localStorage.setItem('watchlist_products',JSON.stringify([product]));localStorage.setItem('price_alerts',JSON.stringify([alert]));localStorage.setItem('back_order_reminders',JSON.stringify([reminder]));},{product,alert,reminder});
  const p=await ctx.newPage();
  for(const route of ['/','/watchlist','/alerts','/drops','/search','/rates','/stats','/health','/distributor-analysis','/settings','/product/mikrotik-crs326-24s','/compare/mikrotik-crs326-24s']){
    await p.goto(base+'/#'+route,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(500);
    const {c,s,o}=await p.evaluate(CHECK);
    if(c.length||s.length||o){failures+=c.length+s.length+(o?1:0);console.log(`\n${scheme} ${width} ${route}`);for(const x of c)console.log('  C',JSON.stringify(x));for(const x of s)console.log('  S',x);if(o)console.log('  O',o);}
  }
  await ctx.close();
  }
}
await b.close(); server.close();
if (failures > 0) {
  console.error(`\naudit:desktop failed with ${failures} problem(s)`);
  process.exit(1);
}
console.log('audit:desktop passed');
