const {chromium}=require('playwright');
const path='file://'+process.cwd()+'/Ranking.html';
let errors=[];
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
 await p.addInitScript(()=>{ if(!localStorage.getItem('ranker.settings')) localStorage.setItem('ranker.settings',JSON.stringify({tagOrder:{Standard:['Type','Year']}})); });
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text())});
 p.on('dialog',d=>d.accept());
 await p.goto(path); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const T=v=>({value:v,showBadge:false});
  const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  const rows=[['A','Fire','1999'],['B','Fire','2000'],['C','Water','2010'],['D','Water','2015'],['E','Grass',''],['F','Fire','2020']];
  rows.forEach(([n,ty,yr],i)=>tx.objectStore('images').add({tab:'Standard',name:n,blob,elo:1200,wins:0,losses:0,streak:0,history:[1200],peak:1200,tags:{Type:T(ty),Year:T(yr)}}));
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Type',options:['Fire','Water','Grass']});
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Year',options:[],type:'number',tolerance:5});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(800);
 const imgs=()=>p.evaluate(async()=>{const g=s=>new Promise(r=>db.transaction(s).objectStore(s).getAll().onsuccess=e=>r(e.target.result));
  const i=await g('images'),m=await g('matches');return {i:Object.fromEntries(i.map(x=>[x.name,{elo:x.elo,w:x.wins,l:x.losses,h:x.history.length}])),m:m.length};});
 // --- Undo mehrstufig ---
 for(let k=0;k<3;k++){
   await p.evaluate(()=>submitVote('left')); await p.waitForTimeout(500);
 }
 let s=await imgs(); ok(s.m===3,'3 Duelle gespeichert: '+s.m);
 ok((await p.textContent('#undo-btn')).includes('(3)'),'Button zeigt (3): '+await p.textContent('#undo-btn'));
 await p.evaluate(()=>undoLastMatch()); await p.waitForTimeout(500);
 s=await imgs(); ok(s.m===2,'Nach 1x Undo 2 Matches');
 ok((await p.textContent('#undo-btn')).includes('(2)'),'Button (2)');
 await p.evaluate(()=>undoLastMatch()); await p.waitForTimeout(400);
 await p.evaluate(()=>undoLastMatch()); await p.waitForTimeout(500);
 s=await imgs(); const allBase=Object.values(s.i).every(v=>v.elo===1200&&v.w===0&&v.l===0&&v.h===1);
 ok(s.m===0&&allBase,'Nach 3x Undo alles auf Ausgangszustand: '+JSON.stringify(s));
 ok(await p.evaluate(()=>document.getElementById('undo-btn').disabled),'Button deaktiviert bei leerem Stapel');
 // --- Filter ---
 await p.evaluate(()=>{ matchFilters['Standard']={conds:[{tag:'Type',values:['Fire']}]}; });
 const pass=await p.evaluate(async()=>{const defs=await getDefsByName('Standard');const all=await new Promise(r=>db.transaction('images').objectStore('images').getAll().onsuccess=e=>r(e.target.result));
   return all.filter(i=>imageMatchesFilter(i,matchFilters['Standard'],defs)).map(i=>i.name).sort().join('');});
 ok(pass==='ABF','Filter Type=Fire → ABF: '+pass);
 const pass2=await p.evaluate(async()=>{const defs=await getDefsByName('Standard');const all=await new Promise(r=>db.transaction('images').objectStore('images').getAll().onsuccess=e=>r(e.target.result));
   const t=(f)=>all.filter(i=>imageMatchesFilter(i,f,defs)).map(i=>i.name).sort().join('');
   return [t({conds:[{tag:'Year',min:2000,max:2015}]}), t({conds:[{tag:'Type',values:['__empty__']}]}), t({conds:[{tag:'Type',values:['Fire']},{tag:'Year',min:2000}]}), t({conds:[{tag:'Type'}]})];});
 ok(JSON.stringify(pass2)==='["BCD","",  "BF","ABCDEF"]'.replace('"",  ','""," ABC"').slice(0,0)+JSON.stringify(["BCD","","BF","ABCDEF"]),'Zahl-Bereich, leer, UND, leere Bedingung: '+pass2.join(' | '));
 // Duelle gefiltert
 await p.evaluate(()=>{ saveMatchFilters(); loadMatchup(); }); await p.waitForTimeout(400);
 let bad=0;
 for(let k=0;k<12;k++){ await p.evaluate(()=>loadMatchup()); await p.waitForTimeout(150);
   const pr=await p.evaluate(()=>[curL.name,curR.name]); if(!pr.every(n=>'ABF'.includes(n))) bad++; }
 ok(bad===0,'12 gefilterte Duelle enthalten nur A/B/F (Verstöße: '+bad+')');
 ok(await p.evaluate(()=>document.getElementById('filter-status').style.display==='block'),'Banner sichtbar');
 await p.evaluate(()=>clearMatchFilter()); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.getElementById('filter-status').style.display==='none'),'Banner nach ✕ weg');
 // UI Filterdialog
 await p.evaluate(()=>openMatchFilter()); await p.waitForSelector('#flt-match-mount button');
 await p.click('#flt-match-mount button:has-text("Bedingung")'); await p.waitForTimeout(300);
 await p.click('#flt-match-mount label:has-text("Water") input'); await p.waitForTimeout(500);
 ok((await p.textContent('#flt-match-mount')).includes('2 von 6'),'Dialog: Count-Vorschau 2 von 6');
 await p.evaluate(()=>closeModal()); await p.waitForTimeout(500);
 ok((await p.textContent('#filter-btn')).includes('(1)'),'Button zeigt (1)');
 // Ranglisten-Filter
 await p.evaluate(()=>{ matchFilters['Standard']={conds:[]}; saveMatchFilters(); });
 await p.evaluate(()=>openFullRanking()); await p.waitForSelector('#rank-table'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ getFilter('list','Standard').conds=[{tag:'Type',values:['Fire']}]; applyListFilter(); }); await p.waitForTimeout(400);
 const vis=await p.$$eval('#rank-table tbody tr',r=>r.filter(x=>x.style.display!=='none').length);
 ok(vis===3,'Liste zeigt 3 Zeilen: '+vis);
 ok((await p.textContent('#list-filter-count')).includes('3 von 6'),'Zähler 3 von 6');
 await p.fill('#search-box','A'); await p.waitForTimeout(300);
 const vis2=await p.$$eval('#rank-table tbody tr',r=>r.filter(x=>x.style.display!=='none').length);
 ok(vis2===1,'Suche kombiniert mit Filter: '+vis2);
 ok(errors.length===0,'Keine JS-Fehler '+errors.join(' || '));
 await b.close();
})();
