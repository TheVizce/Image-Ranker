const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const c=await b.newContext({viewport:{width:900,height:900}});await gh.attach(c);await c.addInitScript(()=>{try{localStorage.setItem('toolsync.config',JSON.stringify({token:'t',owner:'o',repo:'tool-daten'}))}catch(e){}});
const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(url+'/');await p.waitForFunction(()=>db!==null&&window.RANKER_SYNC);
await p.evaluate(async()=>{const tx=db.transaction('images','readwrite');for(let i=0;i<3;i++)tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob:new Blob(['x'+i],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});await new Promise(r=>tx.oncomplete=r)});
const waitOk=async()=>{for(let i=0;i<150;i++){try{if(await p.evaluate(()=>RANKER_SYNC.status==='ok'))return true}catch(e){}await p.waitForTimeout(200)}return false};
await p.evaluate(()=>RANKER_SYNC.syncNow());ok(await waitOk(),'Abgleich per Knopf läuft');await p.waitForTimeout(25000-0>0?500:0);
// Zeit vorspulen: lastSync >20 s zurück simulieren, indem wir Date.now verschieben
await p.evaluate(()=>{const o=Date.now;Date.now=()=>o()+60000});
const n0=gh.count;
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('pagehide'))});
await p.waitForTimeout(4000);
ok(gh.count===n0,'Tab-Wechsel, Wieder-Online und Verlassen lösen keinen Abgleich aus ('+(gh.count-n0)+' Anfragen)');
// offene Duelle -> Hinweis antippbar
await p.evaluate(async()=>{const tx=db.transaction('matches','readwrite');for(let i=0;i<3;i++)tx.objectStore('matches').add({tab:'Standard',leftId:1,rightId:2,winnerId:'left',delta:3,time:Date.now()});await new Promise(r=>tx.oncomplete=r)});
await p.waitForTimeout(6000);
const txt=await p.evaluate(()=>{const e=document.getElementById('sync-note');return e&&e.style.display!=='none'?e.textContent:null});
ok(/3 Duelle hochladen/.test(txt||''),'Hinweis: '+txt);
const n1=gh.count;await p.click('#sync-note');ok(await (async()=>{await p.waitForTimeout(500);return await waitOk()})(),'Antippen gleicht ab');ok(gh.count>n1,'Anfragen gingen raus');
await p.waitForTimeout(1500);
const txt2=await p.evaluate(()=>{const e=document.getElementById('sync-note');return e&&e.style.display!=='none'?e.textContent:null});
await p.waitForTimeout(5500);const txt3=await p.evaluate(()=>{const e=document.getElementById('sync-note');return e&&e.style.display!=='none'?e.textContent:null});
ok(!txt3,'Hinweis weg nach dem Abgleich: '+txt3);
// Neuladen = Start-Abgleich
const n2=gh.count;await p.reload();await p.waitForFunction(()=>window.RANKER_SYNC);await p.waitForTimeout(4000);ok(gh.count>n2,'Start gleicht ab');
await b.close();server.close();process.exit(f?1:0)})();
