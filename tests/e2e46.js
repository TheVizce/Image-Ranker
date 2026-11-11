const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// ohne BO-DB: darf keine anlegen
let had=await p.evaluate(async()=>{await ensureBoCache(true);return (await indexedDB.databases()).some(d=>d.name==='bp-organizer')});
ok(!had,'keine leere bp-organizer-DB angelegt');
// BO-DB fälschen
await p.evaluate(async()=>{await new Promise((res,rej)=>{const r=indexedDB.open('bp-organizer',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const d=r.result;const tx=d.transaction('kv','readwrite');tx.objectStore('kv').put([
{_id:'a',Professions:'Sportswoman: Wrestler, Model','Years active':'2012–2020',Twitch:'x'},
{_id:'b',Professions:'Sportswoman: Wrestler','Years active':'1975-'},
{_id:'c',Professions:'Sportswoman: Football Player, Musican: DJ',YouTube:'y'},
{_id:'d',Professions:'Model'}],'entries');tx.oncomplete=()=>{d.close();res()}};r.onerror=rej})});
await p.evaluate(async()=>{const tx=db.transaction('images','readwrite');
['a','b','c','d'].forEach(id=>tx.objectStore('images').add({tab:'Standard',name:'W'+id,boId:id,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}}));
await new Promise(r=>tx.oncomplete=r)});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
const v=await p.evaluate(async()=>{await ensureBoCache(true);const all=await idbGetAll(db.transaction('images').objectStore('images'));const g=n=>all.find(i=>i.name===n);
return {a:boValues(g('Wa'),BO_PROF),c:boValues(g('Wc'),BO_PROF),la:boValues(g('Wa'),BO_LINK),lc:boValues(g('Wc'),BO_LINK),sa:boValues(g('Wa'),BO_START),sb:boValues(g('Wb'),BO_START)}});
ok(v.a.includes('Sportswoman: Wrestler')&&v.a.includes('Sportswoman')&&v.a.includes('Model'),'Professions + Oberbegriff: '+v.a);
ok(v.c.includes('Musician: DJ'),'Tippfehler Musican korrigiert: '+v.c);
ok(v.la.join()==='Twitch'&&v.lc.join()==='YouTube','Hat Link: '+v.la+' / '+v.lc);
ok(v.sa[0]==='2010er'&&v.sb[0]==='1970er und früher','Karrierestart: '+v.sa+' / '+v.sb);
// Gruppe + Regel
await p.evaluate(async()=>{await editGroups([4],im=>{im.groups=['🤼 Wrestler']})});
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg .rh-n');
await p.evaluate(()=>rhgPanel(0));await p.waitForSelector('#rhg-rule summary');await p.click('#rhg-rule summary');await p.waitForSelector('#flt-grp-mount');
await p.click('#flt-grp-mount button:has-text("Bedingung")');await p.waitForTimeout(300);
ok(await p.locator('#flt-grp-mount option:has-text("Professions")').count()>0||await p.locator('#flt-grp-mount :text("Professions")').count()>0,'Professions als Filter wählbar');
await p.evaluate(async()=>{grpEditFilter={conds:[{tag:BO_PROF,values:['Sportswoman: Wrestler']}]};await rhgRuleChanged();});
await p.waitForTimeout(500);
ok(/2 passende Einträge/.test(await p.textContent('#rhg-rulestat')),'2 Kandidaten: '+(await p.textContent('#rhg-rulestat')).slice(0,120));
await p.evaluate(()=>rhgCandToggleOpen());await p.waitForSelector('#rhg-rulestat input[type=checkbox]');
ok(await p.locator('#rhg-rulestat input[type=checkbox]').count()===2,'2 Häkchen');
await p.locator('#rhg-rulestat input[type=checkbox]').nth(1).uncheck();await p.waitForTimeout(300);
await p.screenshot({path:'cand.png'});
await p.evaluate(()=>rhgCandAdd());await p.waitForTimeout(800);
let mem=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>getGroups(i).length).map(i=>i.name).sort().join()});
ok(/Wa/.test(mem)&&!/Wb|Wc/.test(mem),'markierter hinzugefügt: '+mem);
ok(!(await p.textContent('#rhg-rulestat')).match(/Alle hinzufügen/)||/1 passende/.test(await p.textContent('#rhg-rulestat')),'noch 1 Kandidat übrig');
await p.evaluate(()=>{rivalHub.candOpen=true;rhgCandRefresh()});
await p.evaluate(()=>rhgCandAll(false));await p.evaluate(()=>rhgCandRejectOff());await p.waitForTimeout(600);
ok(!/passende Einträge sind noch nicht/.test(await p.textContent('#rhg-rulestat')),'abgelehnter nicht mehr vorgeschlagen');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
