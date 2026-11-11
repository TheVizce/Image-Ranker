const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
let errors=[];
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1600,height:900}})).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const T=v=>({value:v,showBadge:true});
  const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  for(let i=0;i<6;i++) tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob,elo:1500-i*50,wins:5,losses:1,streak:0,history:[1200],peak:1500,
    tags:{Form:T('F'+i),Type:T('Feuer'),Year:T('2000'),Zeta:T('Z'),Alt:T('weg')}, rivals: i===0?[{id:3,status:'confirmed'}]:[]});
  ['Zeta','Form','Year','Type'].forEach(n=>tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:n,options:[]}));
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1200);
 const order=()=>p.evaluate(async()=>(await getTagDefinitionsForTab('Standard')).map(d=>d.tagName).join(','));
 ok(await order()==='Zeta,Form,Year,Type','Standardreihenfolge (alte ordnung, dann Rest): '+await order());
 const badges=()=>p.$$eval('#properties-left > div',e=>e.map(x=>x.title.split(':')[0]).join(','));
 await p.waitForTimeout(500);
 ok(await badges()==='Zeta,Form,Year,Type','Duell-Badges: gelöschte Eigenschaft „Alt“ fehlt, Reihenfolge stimmt: '+await badges());
 // Einstellungen: Pfeile
 await p.evaluate(()=>openSettings()); await p.waitForSelector('button[title="Nach oben"]');
 const rowsNames=()=>p.$$eval('#modal-body table tbody tr',r=>r.map(x=>x.cells[1].innerText.split('\n')[0].split(' ▸')[0].split(' ▾')[0].trim()).join(','));
 ok(await rowsNames()==='Zeta,Form,Year,Type','Einstellungen zeigen Reihenfolge');
 await p.click('tr:has(td:text-is("Type")) button[title="Nach oben"]'); await p.waitForTimeout(600);
 await p.click('tr:has(td:text-is("Type")) button[title="Nach oben"]'); await p.waitForTimeout(600);
 ok(await rowsNames()==='Zeta,Type,Form,Year','Zeta per ▲ nach ganz oben: '+await rowsNames());
 ok(await order()==='Zeta,Type,Form,Year','Reihenfolge wirkt in getTagDefinitionsForTab');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ranker.settings')).tagOrder.Standard.join(','))==='Zeta,Type,Form,Year','In Einstellungen gespeichert');
 await p.waitForTimeout(400);
 ok(await badges()==='Zeta,Type,Form,Year','Duell-Badges sofort neu sortiert: '+await badges());
 // verwaiste Werte
 ok((await p.textContent('#modal-body')).includes('Alt')&&(await p.textContent('#modal-body')).includes('6 Bilder'),'Übrig gebliebene Werte „Alt“ (6 Bilder) angezeigt');
 await p.click('button[data-orphan="Alt"]'); await p.waitForTimeout(800);
 ok(!(await p.textContent('#modal-body')).includes('Übrig gebliebene'),'Nach Entfernen verschwindet der Block');
 ok(await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).every(i=>!('Alt' in i.tags))),'Werte aus allen Bildern gelöscht');
 // Reset
 await p.click('text=auf Standard zurücksetzen'); await p.waitForTimeout(600);
 ok(await order()==='Zeta,Form,Year,Type','Zurücksetzen stellt Standard her');
 await p.click('tr:has(td:text-is("Form")) button[title="Nach oben"]'); await p.waitForTimeout(600);
 await p.evaluate(()=>closeModal());
 // Studio
 await p.evaluate(()=>openMatchupStudio()); await p.waitForSelector('#studioLeftName'); await p.waitForTimeout(500);
 const chips=await p.$$eval('#studioLeftTags span',e=>e.map(x=>x.textContent.split(':')[0]).join(','));
 ok(chips==='Form,Zeta,Year,Type','Studio-Chips in eingestellter Reihenfolge, ohne „Alt“: '+chips);
 await p.click('text=🎲 Zufällig'); await p.waitForTimeout(300);
 const a=await p.inputValue('#leftCharSelect'), bb=await p.inputValue('#rightCharSelect');
 ok(a!==bb&&/Noch nie/.test(await p.textContent('#studioHint')),'Zufall: zwei verschiedene, noch nie gespielt: '+await p.textContent('#studioHint'));
 await p.selectOption('#leftCharSelect',{index:0}); await p.waitForTimeout(100);
 await p.click('text=🤝 Rivale von A'); await p.waitForTimeout(500);
 ok(await p.textContent('#studioRightName')==='N2'&&/Bestätigter Rivale/.test(await p.textContent('#studioHint')),'Rivale von N0 = N2 (id 3): '+await p.textContent('#studioRightName')+' / '+await p.textContent('#studioHint'));
 await p.selectOption('#leftCharSelect',{index:3}); await p.waitForTimeout(100);
 await p.click('text=🤝 Rivale von A'); await p.waitForTimeout(500);
 ok(/Vorschlag nach Eigenschaften|keine Rivalen/.test(await p.textContent('#studioHint')),'Ohne bestätigte Rivalen: Vorschlag/Hinweis: '+await p.textContent('#studioHint'));
 ok(errors.length===0,'Keine JS-Fehler '+errors.join('|'));
 await b.close();
})();
