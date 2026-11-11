// Duelle im eigenen Ordner: wenige Dateien pro Abgleich, Migration vom alten Format
const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url,setSync}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const c=await b.newContext({viewport:{width:900,height:900}});await gh.attach(c);await c.addInitScript(()=>{try{localStorage.setItem('toolsync.config',JSON.stringify({token:'t',owner:'o',repo:'tool-daten'}))}catch(e){}});
const mk=async()=>{const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));p.on('dialog',d=>d.accept());await p.goto(url+'/');await p.waitForFunction(()=>db!==null&&window.RANKER_SYNC);return p};
const waitOk=async(p,t=240000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await p.evaluate(()=>RANKER_SYNC.status==='ok'))return true}catch(e){}await new Promise(r=>setTimeout(r,250))}return false};
const sync=async p=>{await p.waitForTimeout(300);await p.evaluate(()=>{RANKER_SYNC.syncNow()});await p.waitForTimeout(800);return waitOk(p)};
// 1) ALTES Format: alter Code lädt Bilder + Duelle in den Haupt-Ordner
setSync(''+__dirname+'/ranker-sync.old.js');
let p=await mk();
await p.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');for(let i=0;i<40;i++)tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob:new Blob(['b'+i],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});for(let i=0;i<1300;i++)tx.objectStore('matches').add({tab:'Standard',leftId:1+i%40,rightId:1+(i*7+3)%40,winnerId:i%2?'left':'right',delta:5,time:Date.now()-i*1000});await new Promise(r=>tx.oncomplete=r)});
ok(await sync(p),'alter Code hat abgeglichen');
const oldFiles=[...gh.repos['tool-daten'].keys()].filter(k=>k.startsWith('image-ranker/')).length;ok(oldFiles>=60,'alter Ordner image-ranker/ gefüllt: '+oldFiles);
// 2) NEUER Code, gleiche Daten: Duelle ziehen in den neuen Ordner um
setSync(null);await p.reload();await p.waitForFunction(()=>window.RANKER_SYNC);ok(await waitOk(p),'neuer Code: erster Abgleich fertig');
await p.waitForTimeout(500);
const dFiles=[...gh.repos['tool-daten'].keys()].filter(k=>k.startsWith('image-ranker-duelle/'));ok(dFiles.length>=30,'neuer Ordner image-ranker-duelle/ angelegt: '+dFiles.length);
const loc=await p.evaluate(async()=>{const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));const im=await idbGetAll(db.transaction('images').objectStore('images'));return {m:ma.length,i:im.length}});
ok(loc.m===1300&&loc.i===40,'lokal nichts verloren: '+JSON.stringify(loc));
// 3) 25 Duelle -> Abgleich: wenige Duell-Dateien, Zeitmessung über Anzahl PUTs
await p.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');const st=tx.objectStore('images');for(let i=0;i<25;i++){const a=1+(i*3)%40,bb=1+(i*5+1)%40;for(const id of [a,bb]){const g=st.get(id);g.onsuccess=()=>{const x=g.result;x.elo+=3;x.wins++;st.put(x)}}tx.objectStore('matches').add({tab:'Standard',leftId:a,rightId:bb,winnerId:'left',delta:3,time:Date.now()})}await new Promise(r=>tx.oncomplete=r)});
const log0=gh.log.length;ok(await sync(p),'Abgleich nach 25 Duellen');
const puts=gh.log.slice(log0);const pd=puts.filter(l=>/image-ranker-duelle\//.test(l)).length,pi=puts.filter(l=>/tool-daten\/image-ranker\//.test(l)).length;
ok(pd>=1&&pd<=2,'Duell-Dateien hochgeladen: '+pd);console.log('Bild-Dateien hochgeladen:',pi,'(von 64)');
// 4) zweites Gerät holt alles
const c2=await b.newContext();await gh.attach(c2);await c2.addInitScript(()=>{try{localStorage.setItem('toolsync.config',JSON.stringify({token:'t',owner:'o',repo:'tool-daten'}))}catch(e){}});
const q=await c2.newPage();q.on('dialog',d=>d.accept());await q.goto(url+'/');await q.waitForFunction(()=>db!==null&&window.RANKER_SYNC);
let got=null;for(let i=0;i<400&&!got;i++){await q.waitForTimeout(500);try{const r=await q.evaluate(async()=>{const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));const im=await idbGetAll(db.transaction('images').objectStore('images'));return {m:ma.length,i:im.length,st:RANKER_SYNC.status}});if(r.m===1325&&r.i===40&&r.st==='ok')got=r}catch(e){}}
ok(!!got,'zweites Gerät hat 1325 Duelle + 40 Bilder: '+JSON.stringify(got));
await b.close();server.close();process.exit(f?1:0)})();
