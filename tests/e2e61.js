const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
 tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Cup',type:'exact',options:['A','B','C','D','DD','G','J']});
 const cups=['A','B','C','DD','G','J','34D',''];
 cups.forEach((c,i)=>tx.objectStore('images').add({tab:'Standard',name:'P'+i,blob:new Blob(['x']),elo:1200-i,wins:5,losses:5,history:[1200],tags:c?{Cup:{value:c}}:{}}));
 await new Promise(r=>tx.oncomplete=r)});
const r=await p.evaluate(async()=>{const all=await idbGetAll(db.transaction('images').objectStore('images'));const ctx=await loadFilterContext('Standard');
 const g=n=>getTagValuesAs(all.find(i=>i.name===n),CUPG_TAG,'multi').join();
 const d=ctx.defsByName.get(CUPG_TAG);
 const mf={conds:[{tag:CUPG_TAG,values:['Mittel (C–D)']}]};
 const hit=all.filter(i=>imageMatchesFilter(i,mf,ctx.defsByName)).map(i=>i.name).sort().join();
 return {a:g('P0'),b:g('P1'),c:g('P2'),dd:g('P3'),gg:g('P4'),j:g('P5'),n34d:g('P6'),empty:g('P7'),opts:d&&d.options.join('|'),hit}});
ok(r.a==='Klein (AA–B)'&&r.b==='Klein (AA–B)','A, B → Klein');
ok(r.c==='Mittel (C–D)'&&r.n34d==='Mittel (C–D)','C und „34D“ → Mittel: '+r.c+' / '+r.n34d);
ok(r.dd==='Groß (DD–F)'&&r.gg==='Sehr groß (G–I)'&&r.j==='Extrem (J+)','DD, G, J');
ok(r.empty==='','leer bleibt leer');
ok(r.opts==='Klein (AA–B)|Mittel (C–D)|Groß (DD–F)|Sehr groß (G–I)|Extrem (J+)','Optionen in Stufen-Reihenfolge: '+r.opts);
ok(r.hit==='P2,P6','Filter „Mittel“ trifft P2,P6: '+r.hit);
// Tab ohne Cup-Eigenschaft: keine Cup-Gruppe
const none=await p.evaluate(async()=>{const c=await loadFilterContext('Andere');return c.defsByName.has(CUPG_TAG)});ok(!none,'Tab ohne Cup: Eigenschaft nicht vorhanden');
// Gruppenregel + Prüfung
const diff=await p.evaluate(async()=>{await editGroups([1,2],im=>{im.groups=['📏 Mittel']});settings.groupRules=settings.groupRules||{};settings.groupRules.Standard={...(settings.groupRules.Standard||{}),[groupKey('📏 Mittel')]:{conds:[{tag:CUPG_TAG,values:['Mittel (C–D)']}]}};
 await saveSettings();await openRivalHub('groups');await new Promise(r=>setTimeout(r,1500));const d=grpRuleDiff();window.__d=d.rows.map(r=>r.g.name)+'|'+d.plain.map(g=>g.name)+'|imgs'+rivalHub.images.length;const x=d.rows.find(r=>/Mittel/.test(r.g.name));return x?{cand:x.cand.map(i=>i.name).sort().join(),bad:x.bad.map(i=>i.name).sort().join()}:null});
ok(diff&&diff.cand==='P2,P6'&&diff.bad==='P0,P1','Prüfung: +P2,P6 (C, 34D), −P0,P1 (A, B): '+JSON.stringify(diff));
ok(errs.length===0,'keine JS-Fehler '+errs);await b.close();process.exit(f?1:0)})();
