const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  // alte Daten: Badge-Haken bei einem Tag aus, beim anderen an, dritter leer
  for(let i=0;i<3;i++) tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob,elo:1500-i*50,wins:0,losses:0,streak:0,history:[1200],peak:1200,tags:{Typ:{value:'Feuer',showBadge:false},Jahr:{value:'2001',showBadge:true},Leer:{value:'',showBadge:true}}});
  ['Typ','Jahr','Leer'].forEach(n=>tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:n,options:n==='Typ'?['Feuer']:[]}));
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1200);
 const t=await p.$$eval('#properties-left > div',e=>e.map(x=>x.textContent.trim()));
 ok(t.length===2&&t.includes('Feuer')&&t.includes('2001'),'Alle Tags mit Wert erscheinen, auch mit altem Badge=aus; leere nicht: '+t.join(' | '));
 await p.evaluate(()=>showDetailsByID(1)); await p.waitForTimeout(600);
 ok((await p.$$eval('#modal-body input[type=checkbox]',e=>e.length))===0&&!(await p.textContent('#modal-body')).includes('Badge'),'Details: kein Badge-Haken mehr');
 await p.evaluate(()=>closeModal());
 // Wert setzen wirkt sofort in der Anzeige
 await p.evaluate(async()=>{await setImageTagValues(curL.id,(await getTagDefinitionsForTab('Standard')).find(d=>d.tagName==='Leer').id,'neu'); curL=await idbGet(db.transaction('images').objectStore('images'),curL.id); await renderTagBadges('left',curL);});
 ok((await p.$$eval('#properties-left > div',e=>e.length))===3,'Neu gesetzter Wert erscheint sofort als Badge');
 ok(errs.length===0,'Keine JS-Fehler '+errs.join('|'));
 await b.close();
})();
