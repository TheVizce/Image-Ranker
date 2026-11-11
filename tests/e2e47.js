// Wettlauf: Duelle während eines Abgleichs, der Cloud-Änderungen übernimmt
const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const CFG=JSON.stringify({token:'t',owner:'o',repo:'tool-daten'});
async function dev(){const c=await b.newContext({viewport:{width:900,height:900}});await gh.attach(c);await c.addInitScript(cfg=>{try{localStorage.setItem('toolsync.config',cfg)}catch(e){}},CFG);const p=await c.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('PAGEERR',e.message));await p.goto(url+'/');await p.waitForFunction(()=>typeof db!=='undefined'&&db!==null&&window.RANKER_SYNC);return p}
const status=p=>p.evaluate(()=>RANKER_SYNC&&RANKER_SYNC.status);
const waitOk=async(p,t=60000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await p.evaluate(()=>window.RANKER_SYNC&&RANKER_SYNC.status==='ok'))return}catch(e){}await new Promise(r=>setTimeout(r,200))}throw new Error('waitOk timeout')};
// Gerät A: Daten anlegen
const A=await dev();
await A.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');for(let i=0;i<8;i++)tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob:new Blob(['img'+i],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});for(let i=0;i<5;i++)tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2+i,winnerId:'left',delta:5,time:Date.now()});await new Promise(r=>tx.oncomplete=r)});
await A.evaluate(()=>RANKER_SYNC.syncNow());await waitOk(A);
ok(gh.log.some(l=>/ranker-bilder\/packs/.test(l)),'A hat Bilder hochgeladen');
// Gerät B holt, ändert Bild 3
const B=await dev();await waitOk(B);await B.waitForTimeout(1500);
const nB=await B.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length);ok(nB===8,'B hat 8 Bilder geholt: '+nB);
await B.evaluate(async()=>{const st=db.transaction('images','readwrite').objectStore('images');const g=st.get(3);await new Promise(r=>g.onsuccess=r);const x=g.result;x.elo=1999;st.put(x);await new Promise(r=>setTimeout(r,200));RANKER_SYNC.changed()});
await B.waitForTimeout(500);await B.evaluate(()=>RANKER_SYNC.syncNow());await waitOk(B);await B.waitForTimeout(500);
await B.close();
// A: Abgleich mit Verzögerung; währenddessen Duell auf A
let release;gh.gate=new Promise(r=>release=r);gh.waiting=0;
await A.evaluate(()=>{RANKER_SYNC.syncNow();});
for(let i=0;i<100&&!gh.waiting;i++)await new Promise(r=>setTimeout(r,100));
ok(gh.waiting>0,'Abgleich wartet auf Cloud-Dateien');
const voted=await A.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');const st=tx.objectStore('images');const g=st.get(5);g.onsuccess=()=>{const x=g.result;x.elo=1777;st.put(x)};tx.objectStore('matches').add({tab:'Standard',leftId:5,rightId:6,winnerId:'left',delta:9,time:Date.now()});await new Promise(r=>tx.oncomplete=r);return true});
gh.gate=null;release();

await waitOk(A);await A.waitForTimeout(2500);
const res=await A.evaluate(async()=>{const im=await idbGetAll(db.transaction('images').objectStore('images'));const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));return {elo5:im.find(i=>i.id===5).elo,elo3:im.find(i=>i.id===3).elo,hasMatch:ma.some(m=>m.leftId===5&&m.rightId===6),n:ma.length}});
console.log(JSON.stringify(res));
ok(res.elo3===1999,'Änderung von B wurde übernommen');
ok(res.elo5===1777,'Elo-Änderung während des Abgleichs bleibt erhalten');
ok(res.hasMatch,'Duell während des Abgleichs bleibt erhalten');
await b.close();server.close();process.exit(f?1:0)})();
