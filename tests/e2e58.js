// Zwei Geräte speichern unabhängig Duelle mit gleicher ID: nichts geht verloren
const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const dev=async()=>{const c=await b.newContext({viewport:{width:900,height:900}});await gh.attach(c);await c.addInitScript(()=>{try{localStorage.setItem('toolsync.config',JSON.stringify({token:'t',owner:'o',repo:'tool-daten'}))}catch(e){}});return c};
const open=async c=>{const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));p.on('dialog',d=>{console.log('DIALOG',d.message().slice(0,80));d.accept()});await p.goto(url+'/');await p.waitForFunction(()=>db!==null&&window.RANKER_SYNC);return p};
const ready=async(p)=>{for(let i=0;i<400;i++){try{if(await p.evaluate(()=>window.RANKER_SYNC&&RANKER_SYNC.status==='ok'&&!document.getElementById('sync-lock').style.display.includes('flex')))return true}catch(e){}await new Promise(r=>setTimeout(r,300))}return false};
const sync=async p=>{await p.waitForTimeout(300);try{await p.evaluate(()=>{RANKER_SYNC.syncNow()})}catch(e){}await p.waitForTimeout(1500);try{await p.waitForFunction(()=>window.RANKER_SYNC&&RANKER_SYNC.status==='ok',null,{timeout:120000})}catch(e){}await p.waitForTimeout(1500);try{await p.waitForFunction(()=>window.RANKER_SYNC&&RANKER_SYNC.status==='ok',null,{timeout:60000})}catch(e){}};
const dm=(w,t)=>`{tab:'Standard',leftId:1,rightId:2,winnerId:${w},delta:5,time:${t}}`;
const c1=await dev(),c2=await dev();
let A=await open(c1);
await A.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');for(let i=0;i<3;i++)tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob:new Blob(['b'+i],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});for(let i=0;i<3;i++)tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2,winnerId:1,delta:5,time:1000+i});await new Promise(r=>tx.oncomplete=r)});
await sync(A);
let B=await open(c2);await ready(B);await B.waitForTimeout(1500);
const nB=await B.evaluate(async()=>(await idbGetAll(db.transaction('matches').objectStore('matches'))).length);ok(nB===3,'Gerät 2 hat 3 Duelle: '+nB);
// beide speichern unabhängig ein Duell (gleiche ID 4, anderer Inhalt)
await B.evaluate(async()=>{const tx=db.transaction('matches','readwrite');tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2,winnerId:2,delta:7,time:5000});await new Promise(r=>tx.oncomplete=r)});
await A.evaluate(async()=>{const tx=db.transaction('matches','readwrite');tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2,winnerId:1,delta:9,time:6000});await new Promise(r=>tx.oncomplete=r)});
await sync(B);await sync(A);
B=await open(c2);await ready(B);await sync(B);
A=await open(c1);await ready(A);await sync(A);
const get=p=>p.evaluate(async()=>(await idbGetAll(db.transaction('matches').objectStore('matches'))).map(m=>m.time+':'+m.winnerId).sort().join());
const ga=await get(A),gb=await get(B);
ok(ga.includes('5000:2')&&ga.includes('6000:1'),'Gerät A hat beide Duelle: '+ga);
ok(gb.includes('5000:2')&&gb.includes('6000:1'),'Gerät B hat beide Duelle: '+gb);
ok(ga.split(',').length===5&&gb.split(',').length===5,'je 5 Duelle, keine Duplikate');
await b.close();server.close();process.exit(f?1:0)})();
