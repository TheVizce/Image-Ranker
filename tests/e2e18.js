const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','matches'],'readwrite');
for(let i=0;i<5;i++)tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});
const now=Date.now(), old=now-20*86400000;
const M=(a,c,w,t,n)=>{for(let k=0;k<n;k++)tx.objectStore('matches').add({leftId:a,rightId:c,winnerId:w,delta:10,tab:'Standard',time:t+k});};
M(1,2,'left',old,3); M(2,3,'left',old+100,3); M(3,1,'left',old+200,3); // Kreis 1>2>3>1
M(4,5,'left',now-86400000,4); M(1,4,'right',now-3600000,3);
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>openStats());await p.waitForSelector('text=Widersprüche');
const t=await p.textContent('#modal-body');
ok(/1 Dreierkreis/.test(t),'1 Kreis erkannt');
ok(/Auf- und Absteiger/.test(t)&&/N3/.test(t),'Auf-/Absteiger mit N3');
ok(/Noch unsicher/.test(t),'Unsicher-Block');
await p.screenshot({path:'shots/stats_new.png',fullPage:false});
await p.evaluate(()=>closeModal());
// K-Faktor
await p.evaluate(()=>updateSetting('newbieBoost',true));
const d=await p.evaluate(async()=>{await loadMatchup();const a=curL.elo,b=curR.elo;await submitVote('left');await new Promise(r=>setTimeout(r,500));const ms=await getMatches();return ms[ms.length-1].delta});
ok(Math.abs(d-24)<0.5,'Delta bei K=48 und gleicher Elo ≈ 24: '+d);
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
