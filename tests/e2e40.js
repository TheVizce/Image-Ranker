const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// Bilder a..h. a-b 1:1 (unentschieden), a-c 4:0 (klar). Kreis x>y>z>x je 2:0. a-h 3:1 (klar, kein Kandidat)
await p.evaluate(async()=>{const names=['a','b','c','x','y','z','h','q'];const tx=db.transaction('images','readwrite');
names.forEach(n=>tx.objectStore('images').add({tab:'Standard',name:n,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}}));await new Promise(r=>tx.oncomplete=r);
const all=await idbGetAll(db.transaction('images').objectStore('images'));const id=n=>all.find(i=>i.name===n).id;
const M=[];const dd=(w,l,k)=>{for(let i=0;i<k;i++)M.push({tab:'Standard',leftId:id(w),rightId:id(l),winnerId:'left',delta:16,time:Date.now()-1000*(M.length+1)})};
dd('a','b',1);dd('b','a',1);dd('a','c',4);dd('x','y',2);dd('y','z',2);dd('z','x',2);dd('a','h',3);dd('h','a',1);
const tx2=db.transaction('matches','readwrite');M.forEach(m=>tx2.objectStore('matches').add(m));await new Promise(r=>tx2.oncomplete=r)});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1000);
const r=await p.evaluate(async()=>{const all=await idbGetAll(db.transaction('images').objectStore('images'));const mi=await getMatchIndex();const g=n=>all.find(i=>i.name===n);
const u=n=>{const x=undecidedOpponents(g(n),all.filter(i=>i.id!==g(n).id),mi);return [...x.arr.map(i=>i.name)].sort().join(',')+'|'+[...x.why.values()].join(';')};
settings.shareRival=0;settings.shareGroup=0;settings.shareSimilar=0;settings.shareUndecided=1;
let hit={};for(let k=0;k<40;k++){const o=targetedOpponent(g('x'),all.filter(i=>i.name!=='x'),mi,0.5);hit[o&&o.name]=1}
return {a:u('a'),x:u('x'),q:u('q'),hit:Object.keys(hit).sort().join(','),why:pickWhy&&pickWhy.k}});
ok(/^b\|unentschieden 1:1$/.test(r.a),'a: nur b (1:1), c/h klar: '+r.a);
ok(r.x.split('|')[0]==='y,z'&&/Widerspruch/.test(r.x),'x: Kreispartner y,z: '+r.x);
ok(r.q==='|','q ohne Duelle: kein Kandidat');
ok(r.hit==='y,z'&&r.why==='undecided','targetedOpponent wählt nur y/z, Grund: '+r.hit+' '+r.why);
ok(await p.evaluate(()=>{settings.shareUndecided=0.5;settings.shareRival=0.4;settings.shareGroup=0.4;settings.shareSimilar=0.2;return JSON.stringify(sanitizeSettings(settings))!==''&&(()=>{const s=sanitizeSettings({shareRival:.4,shareGroup:.4,shareSimilar:.2,shareUndecided:.5,shareOutside:.5});return s.shareRival+s.shareGroup+s.shareSimilar+s.shareUndecided+s.shareOutside<=1.0001})()}),'Anteile ergeben höchstens 100 %');
await p.evaluate(()=>openSettings&&openSettings());await p.waitForTimeout(400);
ok(await p.locator('#set-shareUndecided').count()===1,'Einstellung sichtbar');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
