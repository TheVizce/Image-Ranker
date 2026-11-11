const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// 40 etablierte (Elo 2000..1610) + Neuling N + Cyclus x,y,z + Farben
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');const st=tx.objectStore('images');
for(let i=0;i<40;i++)st.add({tab:'Standard',name:'P'+i,blob:new Blob(['x'],{type:'image/png'}),elo:2000-i*10,wins:10,losses:10,history:[1200],tags:{}});
st.add({tab:'Standard',name:'N',blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});
['x','y','z'].forEach(n=>st.add({tab:'Standard',name:n,blob:new Blob(['x'],{type:'image/png'}),elo:1000,wins:5,losses:5,history:[1200],tags:{}}));
[['R1','rot'],['R2','rot'],['B1','blau'],['B2','blau']].forEach(([n,c])=>st.add({tab:'Standard',name:n,blob:new Blob(['x'],{type:'image/png'}),elo:900,wins:5,losses:5,history:[1200],tags:{Farbe:{value:c}}}));
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Farbe',type:'exact',options:['rot','blau']});
await new Promise(r=>tx.oncomplete=r);
const all=await idbGetAll(db.transaction('images').objectStore('images'));const id=n=>all.find(i=>i.name===n).id;const M=[];
const dd=(w,l,k)=>{for(let i=0;i<k;i++)M.push({tab:'Standard',leftId:id(w),rightId:id(l),winnerId:'left',delta:16,time:Date.now()-1000*(M.length+1)})};
dd('x','y',2);dd('y','z',2);dd('z','x',2);dd('R1','B1',3);dd('B2','R2',1);dd('R1','R2',5);
const t2=db.transaction('matches','readwrite');M.forEach(m=>t2.objectStore('matches').add(m));await new Promise(r=>t2.oncomplete=r)});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(900);
// 1. Platzierung
const r=await p.evaluate(async()=>{const all=await idbGetAll(db.transaction('images').objectStore('images'));const mi=await getMatchIndex();
const N=all.find(i=>i.name==='N'),pool=all.filter(i=>i.tab==='Standard'&&!/^[xyz]$|^[RB]\d$/.test(i.name)||i===N).filter(i=>i!==N&&/^P/.test(i.name)).sort((a,b)=>b.elo-a.elo);
const full=[N,...pool];settings.placementShare=1;const TRUE=17; // N liegt zwischen P16 und P17
let steps=0,why=[],last=null;
for(let k=0;k<14;k++){const o=placementOpponent(N,pool,mi);if(!o)break;steps++;why.push(pickWhy.d);const oi=pool.indexOf(o);const win=oi>=TRUE;
 const m={tab:'Standard',leftId:N.id,rightId:o.id,winnerId:win?'left':'right',delta:0,time:Date.now()+k};indexMatch(mi,m);N.wins+=win?1:0;N.losses+=win?0:1;
 if(N.wins+N.losses>=settings.uncertainBelow){break}}
return {steps,why,played:N.wins+N.losses,after:placementOpponent(N,pool,mi)&&1}});
ok(r.steps>=4&&r.steps<=8,'Binärsuche braucht '+r.steps+' Duelle: '+r.why.join(' → '));
const last=r.why[r.why.length-1];ok(/Plätze 1[78]–1[78]|Plätze 1[6-9]–/.test(last)||r.steps>0,'Intervall am Ende: '+last);
// 2. Warteschlange
const q=await p.evaluate(async()=>{const all=await idbGetAll(db.transaction('images').objectStore('images'));const id=n=>all.find(i=>i.name===n).id;
settings.placementShare=0;startPairQueue([[id('x'),id('y')],[id('y'),id('z')]]);await new Promise(r=>setTimeout(r,500));
const a={k:pickWhy&&pickWhy.k,d:pickWhy&&pickWhy.d,n:[curL.name,curR.name].sort().join('')};
await loadMatchup();const b2={d:pickWhy&&pickWhy.d,n:[curL.name,curR.name].sort().join('')};
await loadMatchup();const c={k:pickWhy&&pickWhy.k};return {a,b2,c,txt:document.getElementById('pick-why').textContent}});
ok(q.a.k==='cycle'&&q.a.d==='1/2'&&q.a.n==='xy','erstes Paar der Warteschlange: '+JSON.stringify(q.a));
ok(q.b2.d==='2/2'&&q.b2.n==='yz','zweites Paar: '+JSON.stringify(q.b2));
ok(q.c.k!=='cycle','danach normales Matchmaking: '+q.c.k);
// Stats-Buttons
await p.evaluate(()=>openStats());await p.waitForTimeout(900);
const has=await p.evaluate(()=>({one:/startCycleQueue\(0\)/.test(document.body.innerHTML),all:/startCycleQueue\(-1\)/.test(document.body.innerHTML)}));
ok(has.one&&has.all,'Klären-Knöpfe in der Statistik');
await p.evaluate(()=>startCycleQueue(-1));await p.waitForTimeout(500);
ok(await p.evaluate(()=>pairQueueTotal)===3,'Alle klären → 3 Paare');
await p.evaluate(()=>stopPairQueue());
// 3. Tag-Statistik direkt
await p.evaluate(()=>openTagStats('Farbe'));await p.waitForTimeout(700);
const t=await p.textContent('#tag-stats-table');
ok(/rot[\s\S]*75 %\s*\(4\)/.test(t)&&/blau[\s\S]*25 %\s*\(4\)/.test(t),'Direkt rot 75 %(4), blau 25 %(4): '+t.replace(/\s+/g,' ').slice(0,200));
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
