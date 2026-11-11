// sync-v1.js: Option autoSync:false schaltet Tab-Wechsel/Online/Verlassen-Abgleich ab, Standard bleibt wie bisher
const {chromium}=require('playwright');const {startServer,makeGithub}=require('./syncharness');
(async()=>{const {server,url}=await startServer();const gh=makeGithub();const b=await chromium.launch();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};
const c=await b.newContext();await gh.attach(c);await c.addInitScript(()=>{try{localStorage.setItem('toolsync.config',JSON.stringify({token:'t',owner:'o',repo:'tool-daten'}))}catch(e){}});
const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto(url+'/');await p.waitForFunction(()=>db!==null&&window.RANKER_SYNC&&ToolSync);
await p.waitForTimeout(4000);
const r=await p.evaluate(async()=>{
  const n={a:0,b:0};
  const mk=(name,key,extra)=>ToolSync.create(Object.assign({tool:name,collections:{items:'array'},fields:[],badge:false,home:false,get:()=>{n[key]++;return {items:[{id:1,v:1}]}},apply:async()=>false},extra));
  const A=mk('t-default','a',{}),B=mk('t-manual','b',{autoSync:false});
  A.start();B.start();await new Promise(r=>setTimeout(r,6000));
  const base={a:n.a,b:n.b};
  window.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,6000));
  return {base,after:{a:n.a,b:n.b}};
});
console.log(JSON.stringify(r));
ok(r.after.a>r.base.a,'Standard: Online löst Abgleich aus');
ok(r.after.b===r.base.b,'autoSync:false: Online löst nichts aus');
await b.close();server.close();process.exit(f?1:0)})();
