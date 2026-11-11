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

// Cloud-Änderung von Gerät B erzwingen, damit A etwas übernehmen muss
const B2=await dev();await waitOk(B2);await B2.waitForTimeout(1200);
await B2.evaluate(async()=>{const st=db.transaction('images','readwrite').objectStore('images');const g=st.get(4);await new Promise(r=>g.onsuccess=r);const x=g.result;x.elo=1444;st.put(x);await new Promise(r=>setTimeout(r,200))});
await B2.evaluate(()=>RANKER_SYNC.syncNow());await waitOk(B2);await B2.waitForTimeout(500);
// B2 hat jetzt auch A's Duell?
const b2=await B2.evaluate(async()=>{const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));const im=await idbGetAll(db.transaction('images').objectStore('images'));return {m:ma.some(m=>m.leftId===5&&m.rightId===6),e5:im.find(i=>i.id===5).elo}});
ok(b2.m&&b2.e5===1777,'Während des Abgleichs entstandene Änderungen von A wurden danach hochgeladen: '+JSON.stringify(b2));
await B2.close();
// Sicherheitskopie
const bk=await A.evaluate(async()=>await RankerSyncBackup.info());
ok(bk.length>=1&&bk[0].matches>=5,'Sicherheitskopie vor Übernahme: '+JSON.stringify(bk));
// Sperre
let rel3;gh.gate=new Promise(r=>rel3=r);gh.waiting=0;
await A.evaluate(()=>{RANKER_SYNC.syncNow();});
for(let i=0;i<60&&!gh.waiting;i++)await new Promise(r=>setTimeout(r,100));
const lock=await A.evaluate(()=>{const e=document.getElementById('sync-lock');if(!e)return null;const r=e.getBoundingClientRect();const top=document.elementFromPoint(300,300);return {disp:getComputedStyle(e).display,hit:top&&top.id}});
ok(lock&&lock.disp==='flex'&&lock.hit==='sync-lock','Sperre blockiert die Oberfläche beim Abgleich: '+JSON.stringify(lock));
gh.gate=null;rel3();await waitOk(A);
ok(await A.evaluate(()=>getComputedStyle(document.getElementById('sync-lock')).display)==='none','Sperre danach weg');
// Offline weitervoten, dann wieder online
gh.offline=true;
await A.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');const st=tx.objectStore('images');const g=st.get(7);g.onsuccess=()=>{const x=g.result;x.elo=1666;st.put(x)};for(let i=0;i<3;i++)tx.objectStore('matches').add({tab:'Standard',leftId:7,rightId:8,winnerId:'right',delta:3,time:Date.now()});await new Promise(r=>tx.oncomplete=r)});
await A.evaluate(()=>{RANKER_SYNC.changed();});await A.waitForTimeout(6500);
console.log('dbg',await A.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('ranker-sync');q.onsuccess=()=>r(q.result)});const g=d.transaction('kv').objectStore('kv').get('syncedMatchCount');const v=await new Promise(r=>g.onsuccess=()=>r(g.result));const c=await new Promise(r=>{const q=db.transaction('matches').objectStore('matches').count();q.onsuccess=()=>r(q.result)});return {base:v,n:c,vis:document.visibilityState}}));const nt=await A.evaluate(async()=>{const e=document.getElementById('sync-note');return e?e.textContent+'|'+e.style.display+'|'+RANKER_SYNC.status:'none'});console.log(nt);ok(/ 3 Duelle/.test(nt),'Hinweis zeigt offene Duelle');
gh.offline=false;
await A.evaluate(()=>{RANKER_SYNC.syncNow();});await waitOk(A);await A.waitForTimeout(800);
const off=await A.evaluate(async()=>{const im=await idbGetAll(db.transaction('images').objectStore('images'));const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));return {e7:im.find(i=>i.id===7).elo,n:ma.length}});
ok(off.e7===1666&&off.n===9,'Offline-Stand bleibt nach Wiederverbindung: '+JSON.stringify(off));
const B3=await dev();await waitOk(B3);await B3.waitForTimeout(1500);
const b3=await B3.evaluate(async()=>{const im=await idbGetAll(db.transaction('images').objectStore('images'));const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));return {e7:im.find(i=>i.id===7).elo,n:ma.length}});
ok(b3.e7===1666&&b3.n===9,'und liegt in der Cloud: '+JSON.stringify(b3));
await B3.close();
await b.close();server.close();process.exit(f?1:0)})();
