// Handy: erster Download in Paketen, Abbruch, Fortsetzen ohne erneutes Laden
const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const CFG=JSON.stringify({token:'t',owner:'o',repo:'tool-daten'});
async function dev(extra={},ls={}){const c=await b.newContext(Object.assign({viewport:{width:390,height:844}},extra));await gh.attach(c);await c.addInitScript(([cfg,ls])=>{try{localStorage.setItem('toolsync.config',cfg);for(const k in ls)localStorage.setItem(k,ls[k])}catch(e){}},[CFG,ls]);const p=await c.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('PAGEERR',e.message));await p.goto(url+'/');await p.waitForFunction(()=>typeof db!=='undefined'&&db!==null);return p}
const alive=async(p)=>{try{await p.waitForFunction(()=>!!window.RANKER_SYNC,null,{timeout:2500});return true}catch(e){return false}};
const waitOk=async(p,t=170000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await p.evaluate(()=>window.RANKER_SYNC&&RANKER_SYNC.status==='ok'))return true}catch(e){}await new Promise(r=>setTimeout(r,200))}return false};
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
// PC lädt 12 Bilder hoch, jedes in einem eigenen Paket
const A=await dev({}, {'ranker.packMax':'1'});await A.waitForFunction(()=>window.RANKER_SYNC);
await A.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');for(let i=0;i<12;i++)tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob:new Blob(['bild-'+i+'-'.repeat(50)],{type:'image/png'}),elo:1200+i,wins:0,losses:0,history:[1200],tags:{}});for(let i=0;i<5;i++)tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2+i,winnerId:'left',delta:5,time:Date.now()});await new Promise(r=>tx.oncomplete=r)});
const t0=Date.now();await A.evaluate(()=>{RANKER_SYNC.syncNow()});ok(await waitOk(A),'PC hat hochgeladen');console.log('dauer',(Date.now()-t0)/1000,'status',await A.evaluate(()=>RANKER_SYNC.status+' '+(document.title)));
const packs=[...gh.repos['ranker-bilder'].keys()].filter(k=>k.startsWith('packs/'));ok(packs.length===12,'12 Pakete: '+packs.length);
// Handy ohne Schalter: Sync aus
const P0=await dev({userAgent:IPHONE});await P0.waitForTimeout(800);ok(!(await alive(P0)),'Handy ohne Schalter: kein Sync');await P0.close();
// Handy mit Schalter: nach 4 Paketen Verbindung kappen
let packGets=0;const phoneCtxPage=await dev({userAgent:IPHONE},{'ranker.syncOnMobile':'1'});
ok(await alive(phoneCtxPage),'Handy mit Schalter: Sync aktiv');
await phoneCtxPage.close();
// neu, mit Zählung der Paket-Downloads und Abbruch nach 4
const ctx=await b.newContext({userAgent:IPHONE,viewport:{width:390,height:844}});await ctx.addInitScript(([cfg])=>{try{localStorage.setItem('toolsync.config',cfg);localStorage.setItem('ranker.syncOnMobile','1')}catch(e){}},[CFG]);
await gh.attach(ctx);
await ctx.route('https://api.github.com/**',async route=>{const r=route.request();if(/ranker-bilder\/contents\/packs\//.test(r.url())&&r.method()==='GET'){packGets++;if(gh.cutAfter&&packGets>gh.cutAfter){await route.abort('internetdisconnected');return}}await route.fallback()});

const P=await ctx.newPage();P.on('dialog',d=>d.accept());P.on('pageerror',e=>console.log('PAGEERR',e.message));
gh.cutAfter=4;await P.goto(url+'/');await P.waitForFunction(()=>window.RANKER_SYNC);
await P.waitForFunction(()=>window.RANKER_SYNC&&['offline','error'].includes(RANKER_SYNC.status),null,{timeout:60000});
const n1=await P.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length);
ok(n1===0,'nach Abbruch noch keine halben Bilder in der Datenbank: '+n1);
const staged=await P.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('ranker-sync');q.onsuccess=()=>r(q.result)});const g=d.transaction('blobs').objectStore('blobs').count();return await new Promise(r=>g.onsuccess=()=>r(g.result))});
ok(staged===4,'4 Bilder zwischengespeichert: '+staged);
const getsBefore=packGets;gh.cutAfter=0;
await P.reload();await P.waitForFunction(()=>window.RANKER_SYNC);ok(await waitOk(P),'zweiter Anlauf fertig');
for(let i=0;i<40;i++){try{const st=await P.evaluate(()=>RANKER_SYNC.status);if(st==='ok'&&await P.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length)===12)break}catch(e){}await new Promise(r=>setTimeout(r,250))}
await P.waitForFunction(()=>window.RANKER_SYNC);
const res=await P.evaluate(async()=>{const im=await idbGetAll(db.transaction('images').objectStore('images'));const ma=await idbGetAll(db.transaction('matches').objectStore('matches'));let okb=0;for(const i of im){if(i.blob instanceof Blob&&(await i.blob.text()).startsWith('bild-'+(i.name.slice(1))+'-'))okb++}return {n:im.length,okb,m:ma.length}});
ok(res.n===12&&res.okb===12&&res.m===5,'alle 12 Bilder korrekt, 5 Duelle: '+JSON.stringify(res));
ok(packGets-getsBefore<=8+1,'nur fehlende Pakete nachgeladen ('+(packGets-getsBefore)+' statt 12)');
const st2=await P.evaluate(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('ranker-sync');q.onsuccess=()=>r(q.result)});const g=d.transaction('blobs').objectStore('blobs').count();return await new Promise(r=>g.onsuccess=()=>r(g.result))});
ok(st2===0,'Zwischenspeicher danach leer: '+st2);
// Prüfsummen bekannt: nächster Abgleich lädt nichts, hasht nichts neu
const before=packGets;await P.evaluate(()=>{RANKER_SYNC.syncNow()});await new Promise(r=>setTimeout(r,2500));ok(packGets===before,'weiterer Abgleich lädt keine Pakete');
ok(await P.evaluate(()=>RANKER_SYNC.status)==='ok','Status ok');
await b.close();server.close();process.exit(f?1:0)})();
