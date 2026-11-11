const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:900,height:1500}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction('images','readwrite');for(let i=0;i<8;i++)tx.objectStore('images').add({tab:'Standard',name:'E'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});await new Promise(r=>tx.oncomplete=r);
const all=await idbGetAll(db.transaction('images').objectStore('images'));const M=[];
for(let j=1;j<=6;j++)M.push({tab:'Standard',leftId:all[0].id,rightId:all[j].id,winnerId:'left',delta:16,time:Date.now()-j*1000});  // E0 kennt E1..E6, nicht E7
const t2=db.transaction('matches','readwrite');M.forEach(m=>t2.objectStore('matches').add(m));await new Promise(r=>t2.oncomplete=r)});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const all=await idbGetAll(db.transaction('images').objectStore('images'));const mi=await getMatchIndex();const e0=all.find(i=>i.name==='E0'),pool=all.filter(i=>i!==e0);
const run=(pref,n)=>{settings.preferNewPair=pref;settings.shareRival=0;settings.shareGroup=0;settings.shareSimilar=0;settings.shareUndecided=0;settings.shareOutside=0;let c=0;for(let k=0;k<n;k++){const o=pickStandardOpponent(e0,pool,mi);if(o.name==='E7')c++}return c};
return {p1:run(1,60),p0:run(0,200),why:pickWhy&&pickWhy.d}});
ok(r.p1===60,'100 %: immer das neue Paar E7 ('+r.p1+'/60)');
ok(r.p0>5&&r.p0<60,'0 %: zufällig, E7 nur etwa 1/7 ('+r.p0+'/200)');
for(const mode of ['STANDARD','COVERAGE']){
 await p.evaluate(m=>{updateSetting('matchupMode',m);updateSetting('shareRival',0.15);updateSetting('shareGroup',0.1);updateSetting('shareSimilar',0.2);updateSetting('shareUndecided',0.1);updateSetting('shareOutside',0.1);updateSetting('preferNewPair',0.7)},mode);
 await p.evaluate(()=>openSettings());await p.waitForTimeout(500);
 await p.screenshot({path:'set_'+mode+'.png'});
 const bar=await p.textContent('#set-sharebar');ok(/Elo-Nähe|Abdeckung/.test(bar),mode+' Balken: '+bar.replace(/\s+/g,' ').slice(0,120));
 await p.evaluate(()=>{const m=document.getElementById('modal');m&&m.querySelector('.close,[onclick*=close]')&&m.querySelector('.close,[onclick*=close]').click()});}
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
