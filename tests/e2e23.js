const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
for(const th of ['arena','plain']){
await p.evaluate(t=>{document.documentElement.setAttribute('data-theme',t)},th);
const c=()=>p.evaluate(()=>[...['#chance-l','#h2h-bar-fill'].map(s=>getComputedStyle(document.querySelector(s)).backgroundColor),getComputedStyle(document.querySelector('#h2h-win-l')).color,getComputedStyle(document.querySelector('#prob-text')).color].join('|'));
const a=await c();
await p.evaluate(()=>document.documentElement.style.setProperty('--accent','#e91e63'));
const d=await c();
ok(a===d,th+': Duell-Blau unabhängig von Akzent '+a);
await p.evaluate(()=>document.documentElement.style.removeProperty('--accent'));
}
await b.close();process.exit(f?1:0)})();
