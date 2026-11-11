const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
let errors=[];
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const tx=db.transaction(['images','matches'],'readwrite');
  for(let i=0;i<8;i++) tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob,elo:1200,wins:0,losses:0,streak:0,history:[1200],peak:1200,tags:{}});
  // gestern und vorgestern je 40 Duelle (Ziel 30) -> Serie
  for(let d=1;d<=2;d++) for(let k=0;k<40;k++) tx.objectStore('matches').add({leftId:1,rightId:2,winnerId:'left',delta:1,tab:'Standard',time:Date.now()-d*86400000-k*1000});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1200);
 let t=await p.textContent('#daily-status');
 ok(/🔥 2 Tage/.test(t),'Serie: 2 Tage (gestern+vorgestern, heute noch offen): '+t.replace(/\s+/g,' ').slice(0,160));
 ok(/Heute 0 \/ 30/.test(t)&&/noch 30 bis zum Ziel/.test(t),'Heute 0 / 30');
 ok(await p.$$eval('.wk-bar',e=>e.length)===7&&await p.$$eval('.wk-bar.hit',e=>e.length)===2,'7-Tage-Diagramm: 7 Balken, 2 mit Ziel');
 ok((await p.textContent('#meta-left')).includes('noch nie')||(await p.textContent('#meta-left')).includes('zuletzt'),'Meta-Zeile unter Bild: '+(await p.textContent('#meta-left')).trim());
 ok(/Elo Abstand|Augenhöhe/.test(await p.textContent('#elo-gap')),'Elo-Abstand angezeigt: '+(await p.textContent('#elo-gap')).trim());
 // Tastatur
 await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
 ok(await p.evaluate(async()=>(await new Promise(r=>db.transaction('matches').objectStore('matches').count().onsuccess=e=>r(e.target.result)))===81),'← stimmt ab (81 Duelle)');
 await p.keyboard.press('ArrowRight'); await p.waitForTimeout(900);
 ok(await p.evaluate(async()=>(await new Promise(r=>db.transaction('matches').objectStore('matches').count().onsuccess=e=>r(e.target.result)))===82),'→ stimmt ab (82)');
 await p.keyboard.press('Control+z'); await p.waitForTimeout(900);
 ok(await p.evaluate(async()=>(await new Promise(r=>db.transaction('matches').objectStore('matches').count().onsuccess=e=>r(e.target.result)))===81),'Strg+Z macht rückgängig (81)');
 // Modal offen: keine Abstimmung
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#set-keys'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
 ok(await p.evaluate(async()=>(await new Promise(r=>db.transaction('matches').objectStore('matches').count().onsuccess=e=>r(e.target.result)))===81),'Bei offenem Fenster kein Voting per Pfeiltaste');
 // Schalter
 await p.click('#set-keys'); await p.evaluate(()=>closeModal()); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(600);
 ok(await p.evaluate(async()=>(await new Promise(r=>db.transaction('matches').objectStore('matches').count().onsuccess=e=>r(e.target.result)))===81),'Tastatur abgeschaltet: keine Reaktion');
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#set-extras'); await p.click('#set-extras'); await p.waitForTimeout(500); await p.evaluate(()=>closeModal());
 ok(await p.evaluate(()=>document.documentElement.dataset.extras)==='off'&&!(await p.isVisible('.cp-meta'))&&/📅 Heute/.test(await p.textContent('#daily-status')),'Zusatzanzeigen aus: einfache Tagesanzeige, Meta/7-Tage ausgeblendet');
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(800);
 ok(await p.evaluate(()=>document.documentElement.dataset.extras)==='off','Einstellung bleibt nach Neuladen');
 ok(errors.length===0,'Keine JS-Fehler '+errors.join('|'));
 await b.close();
})();
