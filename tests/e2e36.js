const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));const dl=[];p.on('dialog',d=>{dl.push(d.message());d.accept(d.type()==='prompt'?'{Verein} {Saison} {Art}':undefined)});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// Tab Trikots anlegen
await p.evaluate(async()=>{
 const tabs=JSON.parse(lsGet('tabs')||'["Standard"]');if(!tabs.includes('Trikots'))tabs.push('Trikots');lsSet('tabs',JSON.stringify(tabs));lsSet('activeTab','Trikots');
 const tx=db.transaction(['images','tagDefinitions'],'readwrite');
 const mk=(n,v,s,a)=>({tab:'Trikots',name:n,blob:new Blob([n],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{Saison:{value:s,showBadge:true},Liga:{value:'Bundesliga',showBadge:true},Art:{value:a,showBadge:true},Verein:{value:v,showBadge:true}}});
 tx.objectStore('images').add(mk('bayern-munchen-2026-27-heimtrikot','Bayern München','2026/27','Heim'));
 tx.objectStore('images').add(mk('eintracht-frankfurt-2025-26-auswarts-trikot','Eintracht Frankfurt','2025/26','Auswärts'));
 tx.objectStore('tagDefinitions').add({tab:'Trikots',tagName:'Saison',type:'exact',options:['2025/26','2026/27']});
 tx.objectStore('tagDefinitions').add({tab:'Trikots',tagName:'Verein',type:'exact',options:['Bayern München','Eintracht Frankfurt']});
 tx.objectStore('tagDefinitions').add({tab:'Trikots',tagName:'Liga',type:'exact',options:['Bundesliga']});
 tx.objectStore('tagDefinitions').add({tab:'Trikots',tagName:'Art',type:'exact',options:['Auswärts','Drittes','Heim']});
 await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1000);
ok(await p.isVisible('#links-btn'),'Links-Knopf im Trikots-Tab sichtbar');
await p.click('#links-btn');await p.waitForSelector('#lk-text');
const txt=`[Bayern München 2025-26 Drittes Trikot - Football Kit Archive](https://www.footballkitarchive.com/de/bayern-munchen-2025-26-drittes-trikot-359600/)
[Eintracht Frankfurt 2025-26 Auswärts-Trikot - Football Kit Archive](https://www.footballkitarchive.com/de/eintracht-frankfurt-2025-26-auswarts-trikot-383961/)
[Bayern München 2026-27 Heimtrikot - Football Kit Archive](https://www.footballkitarchive.com/de/bayern-munchen-2026-27-heimtrikot-441209/)
[Athletic Club 2026-27 TW-Heimtrikot - Football Kit Archive](https://www.footballkitarchive.com/de/athletic-club-2026-27-tw-heimtrikot-484445/)
[FC Barcelona 2026-27 Viertes Trikot - Football Kit Archive](https://www.footballkitarchive.com/de/fc-barcelona-2026-27-viertes-trikot-484000/)
[Deutschland 2026 Auswärts-Trikot - Football Kit Archive](https://www.footballkitarchive.com/de/deutschland-2026-auswarts-trikot-411038/)
https://www.footballkitarchive.com/de/1-fc-heidenheim-2025-26-heimtrikot-375657/`;
await p.fill('#lk-text',txt);await p.click('text=Zur Liste hinzufügen');await p.waitForSelector('#lk-root table');
const rows=await p.evaluate(()=>lk.rows.map(r=>[r.name,r.club,r.season,r.art,r.wett,r.mode,r.clubNew].join('|')));
console.log(rows.join('\n'));
ok(rows.length===7,'7 Zeilen');
ok(rows[0].startsWith('Bayern München 2025/26 Drittes|Bayern München|2025/26|Drittes|Bundesliga|new'),'Bayern Drittes');
ok(rows[1].includes('|link|')&&rows[2].includes('|link|'),'vorhandene Trikots erkannt (Link ergänzen)');
ok(rows[3].startsWith('Athletic Club 2026/27 TW Heim|Athletic Club|2026/27|TW Heim'),'TW-Heim');
ok(rows[4].includes('Viertes')&&rows[5].startsWith('Deutschland 2026 Auswärts|Deutschland|2026|Auswärts'),'Viertes / Nationalmannschaft ohne Saison-Teil');
ok(rows[6].startsWith('1. FC Heidenheim 2025/26 Heim')&&rows[6].endsWith('true'),'Nur-URL: Verein abgeleitet und als neu markiert: '+rows[6]);
const gu=await p.evaluate(()=>lk.rows.map(r=>r.wettGuess?'g':(r.wett?'s':'-')).join(''));
ok(gu[0]==='g'&&gu[1]==='s'&&gu[2]==='s','Wettbewerb: gleiche Saison sicher, andere Saison geschätzt ('+gu+')');
ok(/Wettbewerb geschätzt/.test(await p.textContent('#lk-root')),'Hinweis „geschätzt“ sichtbar');
await p.fill('#lk-bulk','2. Bundesliga');await p.click('text=Nur leeren/geschätzten');await p.waitForTimeout(300);
const w1=await p.evaluate(()=>lk.rows.map(r=>r.wett).join('|'));
ok(w1.split('|')[0]==='2. Bundesliga'&&w1.split('|')[2]==='Bundesliga'&&w1.split('|')[3]==='2. Bundesliga','Nur leere/geschätzte überschrieben, sichere bleiben: '+w1);
await p.fill('#lk-bulk','Bundesliga');await p.click('text=Allen zuweisen');await p.waitForTimeout(300);
ok(await p.evaluate(()=>lk.rows.every(r=>r.mode==='skip'||(r.wett==='Bundesliga'&&!r.wettGuess))),'Allen zuweisen');
await p.locator('#lk-root tr[data-i="1"] td:nth-child(3) input').fill('Eintracht Frankfurt');
// Anklicken: in Zeile 0 tippen, dann direkt in Zeile 3 klicken -> Zeile 3 ist ausgewählt und fokussiert
await p.locator('#lk-root tr[data-i="0"] td:nth-child(3) input').fill('Bayern München');
await p.locator('#lk-root tr[data-i="0"] td:nth-child(3) input').click();
await p.locator('#lk-root tr[data-i="0"] td:nth-child(3) input').fill('FC Bayern München');
await p.locator('#lk-root tr[data-i="3"] td:nth-child(2) input').click();
await p.waitForTimeout(300);
const act=await p.evaluate(()=>({sel:lk.sel,focusRow:document.activeElement.closest('tr')&&document.activeElement.closest('tr').dataset.i,hl:[...document.querySelectorAll('tr.lk-sel')].map(t=>t.dataset.i).join(),club0:lk.rows[0].club}));
ok(act.sel===3&&act.focusRow==='3'&&act.hl==='3'&&act.club0==='FC Bayern München','Klick in andere Zeile wählt diese aus ('+JSON.stringify(act)+')');
await p.locator('#lk-root tr[data-i="0"] td:nth-child(3) input').fill('Bayern München');await p.locator('#lk-root tr[data-i="2"] td:nth-child(4) input').click();
// Bild per Datei für Zeile 0
await p.evaluate(async()=>{const cv=document.createElement('canvas');cv.width=cv.height=40;cv.getContext('2d').fillStyle='#c00';cv.getContext('2d').fillRect(0,0,40,40);const bl=await new Promise(r=>cv.toBlob(r,'image/png'));lkSetFile(0,new File([bl],'x.png',{type:'image/png'}))});
await p.waitForTimeout(300);
await p.click('text=übernehmen');await p.waitForTimeout(1500);
const res=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));const d=await getTagDefinitionsForTab('Trikots');return {n:a.filter(i=>i.tab==='Trikots').length,bay:a.find(i=>i.name==='Bayern München 2025/26 Drittes'),linked:a.filter(i=>(i.links||[]).length).length,opts:d.find(x=>x.tagName==='Art').options,q:lsGet('linkQueue')}});
ok(res.n===3&&res.bay&&res.bay.links[0].url.includes('359600')&&res.bay.tags.Verein.value==='Bayern München','Neuer Eintrag mit Link und Eigenschaften');
ok(res.linked===3,'Links bei den 2 vorhandenen ergänzt (3 Einträge mit Link)');
ok(JSON.parse(res.q).Trikots.length===4,'Zeilen ohne Bild bleiben in der Warteschlange: '+JSON.parse(res.q).Trikots.length);
// Doppelte beim erneuten Einfügen
await p.evaluate(()=>openLinkImport());await p.waitForSelector('#lk-text');
await p.fill('#lk-text','https://www.footballkitarchive.com/de/bayern-munchen-2025-26-drittes-trikot-359600/');await p.click('text=Zur Liste hinzufügen');await p.waitForTimeout(300);
ok(/bereits vorhanden/.test(await p.textContent('#lk-root')),'Bereits importierter Link wird als vorhanden erkannt');
// Namen aus Eigenschaften
await p.evaluate(()=>{closeModal();openFullRanking()});await p.waitForSelector('#rank-table tbody tr');
await p.evaluate(()=>{rankImgMap.forEach((im,id)=>bulkSel.add(id));renderBulkBar()});
dl.length=0;await p.click('text=Namen aus Eigenschaften');await p.waitForTimeout(1500);
const names=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>i.tab==='Trikots').map(i=>i.name).sort()});
ok(names.includes('Bayern München 2026/27 Heim')&&names.includes('Eintracht Frankfurt 2025/26 Auswärts'),'Namen neu gesetzt: '+names);
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
