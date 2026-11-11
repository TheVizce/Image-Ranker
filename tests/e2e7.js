const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
let errors=[];
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1440,height:800}})).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const tx=db.transaction(['images','matches','tagDefinitions'],'readwrite'); tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Typ',options:[]});
  for(let i=0;i<6;i++) tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob,elo:1500-i*50,wins:5,losses:1,streak:0,history:[1200],peak:1500,tags:{Typ:{value:'Feuer',showBadge:true}}});
  const m=(l,r,w,t)=>tx.objectStore('matches').add({leftId:l,rightId:r,winnerId:w,delta:1,tab:'Standard',time:t||Date.now()});
  m(1,2,'left');m(2,1,'left');m(1,2,'left');m(1,3,'left');m(2,3,'right');m(1,4,'left');
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(800);
 await p.evaluate(()=>openMatchupStudio()); await p.waitForSelector('#studioLeftName'); await p.waitForTimeout(500);
 ok(await p.textContent('#studioLeftName')==='N0'&&await p.textContent('#studioRightName')==='N1','Start mit den Top 2');
 // 1 vs 2: Duelle: (1,2 left)=A, (2,1 left)=B wins(2 is left → B), (1,2 left)=A → 2:1
 ok(await p.textContent('#studioScoreLeft')==='2'&&await p.textContent('#studioScoreRight')==='1','Direktes Duell 2:1');
 ok((await p.textContent('#studioMatchCount')).startsWith('3 Duelle'),'3 Duelle gezählt');
 ok((await p.$$eval('#studioMatchHistoryList li',e=>e.length))===3,'Liste hat 3 Einträge');
 const cmp=await p.$$eval('#studioCompare > div',e=>e.map(x=>x.textContent));
 ok(cmp.includes('Platz')&&cmp[0]==='#1'&&cmp[2]==='#2','Vergleichstabelle: Platz #1 vs #2');
 const wins=await p.$$eval('#studioCompare .v.win',e=>e.length); ok(wins>=2,'Besserer Wert hervorgehoben ('+wins+')');
 ok((await p.textContent('#studioIndirectComparison')).includes('N2'),'Gemeinsamer Gegner N2: '+(await p.textContent('#studioIndirectComparison')).replace(/\s+/g,' ').slice(0,80));
 ok((await p.textContent('#studioLeftTags')).includes('Typ: Feuer'),'Eigenschaften als Chips');
 await p.selectOption('#rightCharSelect', {index:4}); await p.waitForTimeout(200);
 ok(await p.textContent('#studioRightName')==='N4'&&await p.textContent('#studioScoreLeft')==='0'&&(await p.textContent('#studioMatchCount')).startsWith('0 Duelle'),'Wechsel auf N4 (noch kein Duell)');
 await p.evaluate(()=>swapMatchupSelection());
 ok(await p.textContent('#studioLeftName')==='N4','Tauschen');
 await p.click('#btnForceMatch'); await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>getComputedStyle(document.getElementById('modal')).display)==='none','Fenster schließt');
 ok(await p.evaluate(()=>curL.name+'/'+curR.name)==='N4/N0','Duell erzwungen: '+await p.evaluate(()=>curL.name+'/'+curR.name));
 // Normales Fenster danach nicht im Studio-Modus
 await p.evaluate(()=>openSettings()); await p.waitForTimeout(300);
 ok(!(await p.evaluate(()=>document.getElementById('modal').classList.contains('studio-mode'))),'Andere Fenster ohne Studio-Breite');
 ok(errors.length===0,'Keine JS-Fehler '+errors.join('|'));
 await b.close();
})();
