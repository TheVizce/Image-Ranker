// Statischer Server (Ranker + /startseite) und gemockte GitHub-API für Sync-Tests
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const RANKER=process.env.RANKER_DIR||require('path').join(__dirname,'..'), START=process.env.START_DIR||'/home/claude/thevizce/startseite';
function startServer(){return new Promise(res=>{const st={sync:null};const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/ranker-sync.js'&&st.sync){r.writeHead(200,{'content-type':'text/javascript'});r.end(fs.readFileSync(st.sync));return}let f=u.startsWith('/startseite/')?path.join(START,u.slice(11)):path.join(RANKER,u==='/'?'index.html':u);
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end('nf');return}const t={'.html':'text/html;charset=utf-8','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream';r.writeHead(200,{'content-type':t});r.end(d)})});
 s.listen(0,()=>res({server:s,url:'http://localhost:'+s.address().port,setSync:p=>{st.sync=p}}))})}
// Speicher: repo -> Map(pfad -> {buf, sha})
function makeGithub(){const repos={};const log=[];const api={repos,log,delay:0,offline:false};
 const sha1=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
 api.attach=async(ctx)=>{await ctx.route('https://api.github.com/**',async route=>{
  const req=route.request(),u=new URL(req.url()),m=u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  api.count=(api.count||0)+1;
  if(api.offline){await route.abort('internetdisconnected');return}
  if(api.delay)await new Promise(r=>setTimeout(r,api.delay));
  if(!m){await route.fulfill({status:404,body:'{}'});return}
  const repo=m[2],rest=m[3]||'';const files=repos[repo]||(repos[repo]=new Map());
  const J=(s,o)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(!rest){return J(200,{name:repo})}
  const cm=rest.match(/^\/contents\/(.*)$/);
  if(cm){const p=decodeURIComponent(cm[1]);
   if(req.method()==='PUT'){const b=JSON.parse(req.postData());const cur=files.get(p);if(cur&&b.sha!==cur.sha)return J(409,{message:'conflict'});if(!cur&&b.sha)return J(422,{message:'sha'});
    const buf=Buffer.from(b.content,'base64');const sha=sha1(buf);files.set(p,{buf,sha});log.push('PUT '+repo+'/'+p);return J(200,{content:{sha}})}
   const f=files.get(p);
   if(f&&api.gate&&repo==='tool-daten'){api.waiting=(api.waiting||0)+1;await api.gate}
   if(f){const raw=(req.headers()['accept']||'').includes('raw');if(raw)return route.fulfill({status:200,contentType:'application/octet-stream',body:f.buf});return J(200,{sha:f.sha,encoding:'base64',content:f.buf.toString('base64')})}
   const kids=[...files.keys()].filter(k=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/'));
   if(kids.length)return J(200,kids.map(k=>({type:'file',name:k.slice(p.length+1),sha:files.get(k).sha})));
   return J(404,{message:'Not Found'})}
  return J(404,{message:'?'})})};
 return api}
module.exports={startServer,makeGithub};
