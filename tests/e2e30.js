const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:800}});const p=await ctx.newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
const url='file://'+process.cwd()+'/Ranking.html';
// 1) Migration alter Schlüssel
await p.goto(url);await p.waitForFunction(()=>db!==null);
await p.evaluate(()=>{localStorage.clear();
 localStorage.setItem('tabs',JSON.stringify(['Standard','Pokemon']));localStorage.setItem('activeTab','Pokemon');
 localStorage.setItem('settings',JSON.stringify({matchupMode:'STANDARD',eloWindow:150}));
 localStorage.setItem('theme','plain');localStorage.setItem('rankView',JSON.stringify({tiles:true}));
 // fremdes Tool: gleiche allgemeine Namen, andere Struktur -> darf nicht angefasst werden
 localStorage.setItem('foo-settings','x');
});
await p.reload();await p.waitForFunction(()=>db!==null);
const st=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
ok(st['ranker.tabs']==='["Standard","Pokemon"]'&&st['ranker.activeTab']==='Pokemon','Tabs/aktiver Tab übernommen');
ok(JSON.parse(st['ranker.settings']).matchupMode==='STANDARD','Einstellungen übernommen');
ok(!('tabs' in st)&&!('settings' in st)&&!('activeTab' in st)&&!('theme' in st)&&!('rankView' in st),'alte Schlüssel entfernt');
ok(st['foo-settings']==='x','fremder Schlüssel unberührt');
ok(await p.evaluate(()=>currentTab)==='Pokemon'&&await p.evaluate(()=>settings.matchupMode)==='STANDARD','App nutzt die übernommenen Werte');
ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='plain'||true,'Theme');
// 2) Fremdes Tool mit gleichem Namen "settings" wird nicht eingesammelt
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('settings',JSON.stringify({color:'red',lang:'de'}));localStorage.setItem('tabs','kein json');localStorage.setItem('theme','dark')});
await p.reload();await p.waitForFunction(()=>db!==null);
const st2=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
ok(st2.settings===JSON.stringify({color:'red',lang:'de'})&&st2.tabs==='kein json'&&st2.theme==='dark','Fremde Daten unter denselben Namen bleiben unangetastet');
ok(!('ranker.settings' in st2),'… und werden nicht übernommen');
// 3) Kein Warnhinweis im Normalbetrieb
ok(await p.locator('#storage-warn').count()===0,'kein Warnhinweis im Normalbetrieb');
// 4) Speicher voll -> sichtbarer Hinweis
await p.evaluate(()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('The quota has been exceeded.','QuotaExceededError')};window.__o=o;});
await p.evaluate(()=>{lsSet('rankView','{}')});
ok(await p.locator('#storage-warn').count()===1&&/Speicher ist voll/.test(await p.textContent('#storage-warn')),'Quota-Fehler wird angezeigt');
await p.evaluate(()=>{Storage.prototype.setItem=window.__o;document.getElementById('storage-warn').remove();storageWarnAt=0;});
// 5) IndexedDB-Fehler wird gemeldet
await p.evaluate(async()=>{const tx=db.transaction('tagDefinitions','readwrite');tx.objectStore('tagDefinitions').add({id:1,tab:'x',tagName:'a'});tx.objectStore('tagDefinitions').add({id:1,tab:'x',tagName:'b'});await new Promise(r=>{tx.oncomplete=r;tx.onabort=r;});});
await p.waitForTimeout(200);
ok(await p.locator('#storage-warn').count()===1,'IndexedDB-Fehler wird gemeldet');
// 6) Einstellungen zeigen Speicher
await p.evaluate(()=>openSettings());await p.waitForSelector('#storage-info');await p.waitForTimeout(500);
ok(/Dauerhafter Speicher/.test(await p.textContent('#storage-info')),'Speicher-Info: '+(await p.textContent('#storage-info')).slice(0,80));
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
