const {chromium}=require('playwright');
const path='file://'+process.cwd()+'/Ranking.html';
let errors=[];
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text())});
 p.on('dialog',d=>d.accept());
 await p.goto(path); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'});
  const tx=db.transaction(['images'],'readwrite');
  for(let i=0;i<6;i++) tx.objectStore('images').add({tab:'Standard',name:'I'+i,blob,elo:1200,wins:0,losses:0,streak:0,history:[1200],peak:1200,tags:{}});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(800);
 let t=await p.textContent('#daily-status'); ok(/0 \/ 30/.test(t),'Standard-Tagesziel 30 (6 Bilder): '+t.trim());
 ok(/Cov: 0%/.test(await p.textContent('#stats-left'))&&/Duelle: 0/.test(await p.textContent('#stats-left')),'Duell zeigt Cov und Duelle: '+await p.textContent('#stats-left'));
 for(let k=0;k<3;k++){await p.evaluate(()=>submitVote('left'));await p.waitForTimeout(500);}
 t=await p.textContent('#daily-status'); ok(/3 \/ 30/.test(t)&&/10 %/.test(t),'Fortschritt 3 / 30 nach 3 Duellen: '+t.trim());
 const sl=await p.textContent('#stats-left'), sr=await p.textContent('#stats-right');
 ok(/Cov: [1-9]/.test(sl+sr)&&/Duelle: [1-9]/.test(sl+sr),'Cov/Duelle steigen: '+sl+' // '+sr);
 await p.evaluate(()=>undoLastMatch()); await p.waitForTimeout(600);
 ok(/2 \/ 30/.test(await p.textContent('#daily-status')),'Undo senkt Fortschritt auf 2');
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#set-dailyGoal');
 ok(await p.getAttribute('#set-dailyGoal','placeholder')==='30','Einstellung zeigt automatischen Wert 30 als Platzhalter');
 await p.fill('#set-dailyGoal','8'); await p.dispatchEvent('#set-dailyGoal','change'); await p.waitForTimeout(500);
 ok(await p.evaluate(()=>settings.dailyGoals.Standard===8&&JSON.parse(localStorage.getItem('ranker.settings')).dailyGoals.Standard===8),'Eigenes Ziel 8 gespeichert');
 await p.evaluate(()=>closeModal());
 ok(/2 \/ 8/.test(await p.textContent('#daily-status'))&&/25 %/.test(await p.textContent('#daily-status')),'Anzeige nutzt Ziel 8');
 await p.evaluate(()=>openStats()); await p.waitForTimeout(600);
 ok((await p.textContent('#modal-body')).includes('Ziel: 8'),'Statistik nutzt Ziel 8');
 await p.evaluate(()=>closeModal());
 await p.evaluate(()=>openFullRanking()); await p.waitForSelector('#rank-table');
 const heads=await p.$$eval('#rank-table thead th',e=>e.map(x=>x.innerText.trim()));
 ok(heads.map(x=>x.toUpperCase()).includes('COV'),'Rangliste hat Cov-Spalte: '+heads.join(','));
 const ci=heads.map(x=>x.toUpperCase()).indexOf('COV'); const vals=await p.$$eval('#rank-table tbody tr',(r,i)=>r.map(x=>x.cells[i].innerText.trim()),ci);
 ok(vals.every(v=>/^\d+%$/.test(v))&&vals.some(v=>v!=='0%'),'Cov-Werte: '+vals.join(' '));
 await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{});
 // zurück auf automatisch
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#set-dailyGoal');
 await p.fill('#set-dailyGoal',''); await p.dispatchEvent('#set-dailyGoal','change'); await p.waitForTimeout(400);
 ok(await p.evaluate(()=>settings.dailyGoals.Standard===undefined),'Leeren stellt automatisch wieder her');
 ok(errors.length===0,'Keine JS-Fehler '+errors.join(' || '));
 await b.close();
})();
