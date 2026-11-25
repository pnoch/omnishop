import express from 'express';
import path from 'node:path';
import { chromium } from 'patchright';
const dist = path.resolve('desktop/dist');
const app = express(); app.use(express.static(dist)); app.get('*', (_q,res)=>res.sendFile(path.join(dist,'index.html')));
const server = app.listen(0); await new Promise((r)=>server.once('listening',r));
const base = `http://127.0.0.1:${server.address().port}`;
const now=Date.now(); const d=(n)=>new Date(now-n*86400000).toISOString();
const product={id:'mikrotik-crs326-24s',name:'MikroTik CRS326-24S+2Q+RM',modelNumber:'CRS326-24S+2Q+RM',brand:'MikroTik',category:'Networking Switch',description:'x',addedAt:d(30),lastRefreshed:d(0),isWatched:true,tags:[],listings:[{distributorId:'server2u-my',productId:'mikrotik-crs326-24s',price:5568,currency:'MYR',stockStatus:'in_stock',url:'https://server2u.com/p',lastChecked:d(0),priceHistory:[{date:d(20),price:5900,currency:'MYR',stockStatus:'in_stock'},{date:d(0),price:5568,currency:'MYR',stockStatus:'in_stock'}]},{distributorId:'getic-gr',productId:'mikrotik-crs326-24s',price:394.25,currency:'EUR',stockStatus:'in_stock',url:'https://getic.com/p',lastChecked:d(0),priceHistory:[]}]};
const alert={id:'a1',productId:product.id,targetPrice:350,currency:'EUR',isActive:true,createdAt:d(5),direction:'drop'};
const reminder={id:'r1',productId:product.id,productName:product.name,distributorId:'getic-gr',distributorName:'Getic',reminderDate:new Date(now+7*86400000).toISOString(),createdAt:d(2),reminderType:'date'};
const CONTRAST = () => {
  const cv=document.createElement('canvas'); const cx=cv.getContext('2d');
  const norm=(s)=>{ if(!s) return null; cx.fillStyle='#000'; cx.fillStyle=s; const v=cx.fillStyle; if(typeof v!=='string') return null; if(v.startsWith('#')){ const n=parseInt(v.slice(1),16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255,a:1}; } const m=v.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(',').map(Number); return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}; };
  const blend=(f,bg)=>({r:f.r*f.a+bg.r*(1-f.a),g:f.g*f.a+bg.g*(1-f.a),b:f.b*f.a+bg.b*(1-f.a),a:1});
  const lum=({r,g,b})=>{const f=(c)=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const bgOf=(el)=>{let bg={r:255,g:255,b:255,a:1};let n=el;while(n&&n!==document.documentElement){const c=norm(getComputedStyle(n).backgroundColor);if(c&&c.a>0){bg=blend(c,bg);if(c.a>=1)break;}n=n.parentElement;}return bg;};
  const out=[];
  for(const el of Array.from(document.querySelectorAll('*'))){const text=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!text)continue;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)continue;const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;const fg=norm(s.color);if(!fg)continue;const bg=bgOf(el);const eff=fg.a<1?blend(fg,bg):fg;const cr=ratio(eff,bg);const size=parseFloat(s.fontSize);const wt=parseInt(s.fontWeight,10)||400;const icon=/^[\uE000-\uF8FF\s]+$/.test(text);const need=(icon||size>=24||(size>=18.66&&wt>=700))?3:4.5;if(cr+0.01<need)out.push({t:text.slice(0,28),r:Math.round(cr*100)/100,need,size:Math.round(size),color:s.color,bg:`${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}`,cls:el.className.toString().slice(0,80)});}
  const seen=new Set();return out.filter(f=>{const k=f.t+f.r+f.size;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,20);
};
const b=await chromium.launch();
for(const scheme of ['light','dark']){
  const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:scheme});
  await ctx.addInitScript(({product,alert,reminder})=>{localStorage.setItem('has_seen_onboarding','true');localStorage.setItem('watchlist_products',JSON.stringify([product]));localStorage.setItem('price_alerts',JSON.stringify([alert]));localStorage.setItem('back_order_reminders',JSON.stringify([reminder]));},{product,alert,reminder});
  const p=await ctx.newPage();
  for(const route of ['/','/watchlist','/alerts','/drops','/search','/rates','/stats','/health','/distributor-analysis','/settings','/product/mikrotik-crs326-24s','/compare/mikrotik-crs326-24s']){
    await p.goto(base+'/#'+route,{waitUntil:'networkidle'}).catch(()=>{});
    await p.waitForTimeout(600);
    const c=await p.evaluate(CONTRAST);
    if(c.length){console.log(`\n${scheme} ${route}`);for(const x of c)console.log(' ',JSON.stringify(x));}
  }
  await ctx.close();
}
await b.close();server.close();
