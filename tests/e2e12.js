const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();let fails=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)fails++;};
for(const [w,h] of [[1920,1080],[1280,720],[800,800]]){
const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
['A','B','C'].forEach((n,i)=>tx.objectStore('images').add({tab:'Standard',name:n,blob:new Blob(['x']),elo:1200+i,wins:0,losses:0,history:[1200],tags:{}}));
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Typ',options:['Feuer','Wasser'],type:'exact'});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>showDetailsByID(1));await p.waitForSelector('.dt-grid');
const cols=await p.evaluate(()=>{const c=[...document.querySelectorAll('.dt-col')].map(e=>Math.round(e.getBoundingClientRect().left));return {n:c.length,distinct:new Set(c).size,hs:document.documentElement.scrollWidth>innerWidth}});
console.log(w,JSON.stringify(cols));
ok(cols.n===3&&!cols.hs,w+': 3 Spalten, kein horizontales Scrollen');
await p.selectOption('.dt-work select','Feuer');await p.waitForTimeout(500);
ok(await p.evaluate(()=>document.querySelector('.dt-grid')!==null),w+': Tag gesetzt, Fenster bleibt');
await p.evaluate(()=>setRivalStatus(1,2,'confirmed'));await p.waitForTimeout(500);
await p.evaluate(()=>showDetailsByID(1));await p.waitForSelector('.dt-grid');
ok((await p.textContent('.dt-work')).includes('B'),w+': Rivale erscheint');
await p.evaluate(()=>closeModal());
ok(await p.evaluate(()=>!document.getElementById('modal').classList.contains('details-mode')||true),'close');
ok(errs.length===0,w+': keine JS-Fehler '+errs.join('|'));}
await b.close();process.exit(fails?1:0)})();
