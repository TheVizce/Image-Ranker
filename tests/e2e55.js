const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
const r=await p.evaluate(()=>{const mk=n=>({wins:n,losses:0});const o={};settings.uncertainBelow=10;o.a=[isNewcomerImg(mk(4)),isNewcomerImg(mk(9)),isNewcomerImg(mk(10))];o.pk=peakMinDuels();settings.uncertainBelow=0;o.b=[isNewcomerImg(mk(0))];o.pk0=peakMinDuels();settings.uncertainBelow=10;return o});
ok(JSON.stringify(r.a)==='[true,true,false]','🆕 gilt bis 9 Duelle bei Grenze 10: '+r.a);ok(r.pk===10&&r.pk0===5,'⭐ erst ab Grenze (ohne Grenze 5)');ok(r.b[0]===false,'Grenze 0: nichts ist neu');
await p.evaluate(()=>openSettings());await p.waitForSelector('#set-uncertainBelow');
const t=await p.textContent('body');ok(/Neu \/ „noch unsicher“ unter/.test(t)&&/Eine Grenze für alles „Neue“/.test(t)&&/Neulinge.*weniger als 10 Duellen/.test(t),'Einstellungstexte');
ok(errs.length===0,'keine JS-Fehler '+errs);await b.close();process.exit(f?1:0)})();
