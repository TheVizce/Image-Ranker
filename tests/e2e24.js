const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
for(let i=0;i<8;i++)tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{G:{value:i<4?'A':'B'}}});
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'G',type:'exact',options:['A','B']});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>{updateSetting('matchupMode','COVERAGE');getFilter('match','Standard').conds=[{tag:'G',values:['A']}];saveMatchFilters&&saveMatchFilters();});
await p.evaluate(()=>setFocus(1));await p.waitForTimeout(500);
ok(await p.evaluate(()=>duelCtx.n===4&&duelCtx.filtered),'Coverage-Kontext = gefilterter Pool (4)');
ok(/Cov \(Filter\)/.test(await p.textContent('#stats-left')),'Anzeige "Cov (Filter)"');
// Duelle: Bild 1 gegen die 3 anderen im Pool
let flashSeen=false;
for(let k=0;k<3;k++){
  ok(await p.evaluate(()=>!document.getElementById('cov-done')||getComputedStyle(document.getElementById('cov-done')).display==='none'),'Runde 1, Duell '+(k+1)+': kein Hinweis');
  await p.evaluate(()=>submitVote('left'));await p.waitForTimeout(700);
}
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('cov-done')).display!=='none'),'Hinweis nach allen 3 Gegnern: '+await p.textContent('#cov-done'));
ok(await p.evaluate(()=>document.getElementById('cov-flash').classList.contains('show')),'Flash-Hinweis');
ok(/Alle 3 Gegner/.test(await p.textContent('#cov-done')),'Text nennt 3 Gegner');
ok(await p.evaluate(()=>document.getElementById('h2h-count').classList.contains('cov-all')),'Duelle-Zähler hervorgehoben');
// Ohne Filter-Pool (B hat nie gespielt): Hinweis weg bei Fokuswechsel
await p.evaluate(()=>setFocus(5));await p.waitForTimeout(500);
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('cov-done')).display==='none'||duelCtx.filtered),'Anderes Bild ohne Hinweis (oder Filter greift)');
// Import: Fehler -> genau ein alert
const alerts=[];p.removeAllListeners('dialog');p.on('dialog',d=>{alerts.push(d.message());d.accept()});
const zip=await p.evaluate(async()=>{await exportFullSystem;return 1});
await p.evaluate(()=>{window.__n=0;const o=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(++window.__n>3)throw new DOMException('kaputt','DataError');return o.apply(this,a)}});
const bk=await p.evaluate(()=>{const j=JSON.stringify({images:[1,2,3,4,5,6].map(i=>({id:i,tab:'Standard',name:'x'+i,elo:1200,wins:0,losses:0,history:[],tags:{},blob:'data:text/plain;base64,eA=='})),matches:[],tabs:['Standard']});return j});
require('fs').writeFileSync('t23.json',bk);
await p.setInputFiles('#backup-input','t23.json');await p.waitForTimeout(1500);
const errAlerts=alerts.filter(a=>/Fehler|Schreiben/.test(a));
ok(errAlerts.length===1,'genau eine Fehlermeldung: '+errAlerts.length+' / '+JSON.stringify(errAlerts).slice(0,200));
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
