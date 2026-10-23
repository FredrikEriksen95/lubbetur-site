# Bygger public/ (Netlify) fra src/lubbetur.html + src/site/*
import re, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
D = R + 'src/'
h=open(D+'lubbetur.html').read()
fb=D+'vendor/'
strip=lambda s: re.sub(r'//# sourceMappingURL=\S+','',s)
app=strip(open(fb+'firebase-app-compat.js').read()); fst=strip(open(fb+'firebase-firestore-compat.js').read())
shim=open(D+'site/shim.js').read(); live=open(D+'site/live.js').read()
def rep(x,y,n=1):
  global h
  assert h.count(x)==n,(h.count(x),x[:60]); h=h.replace(x,y)
import datetime
VER=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2))).strftime('%d.%m %H:%M')
head_add=('<script>window.__LUB_VER="'+VER+'";</script><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0b1316"><link rel="apple-touch-icon" href="icon-192.png">'
  '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  '<script>'+app+'\n</script><script>'+fst+'\n</script><script>'+shim+'\n</script>'
  '<script>if("serviceWorker" in navigator){var hadSW=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener("controllerchange",function(){if(hadSW&&!window.__swr){window.__swr=1;location.reload();}});addEventListener("load",function(){navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(function(r){try{r.update();}catch(e){}}).catch(function(){});});}</script>')
rep('</style></head><body>','</style>'+head_add+'</head><body>')
rep("  // ---------- Oppstart ----------\n  const remember", live+"  // ---------- Oppstart ----------\n  const remember")
rep("    try { sJet(); if (DATA.geo) {","    try { window.__lubShareKey && window.__lubShareKey(); window.__lubFetchLive && window.__lubFetchLive(); } catch (e) {}\n    try { sJet(); if (DATA.geo) {")
rep(" + ' NOK, hentet fra Wise ' + when", " + ' NOK, oppdatert ' + when")
games=open(D+'site/games.js').read()
rep("  const PEOPLE = ['Fredrik', 'Elias', 'Vetle', 'Lasse', 'Eirik'];\n", "  const PEOPLE = ['Fredrik', 'Elias', 'Vetle', 'Lasse', 'Eirik'];\n  if (window.__LUB_GAMES) { PEOPLE.length = 0; try { (JSON.parse(localStorage.getItem('lub-spill-navn') || '[]') || []).forEach((n) => { if (typeof n === 'string' && n) PEOPLE.push(n); }); } catch (e) {} }\n")
rep("  setTimeout(() => { if (!curWho) whoSheet(); }, 2200);", "  if (!window.__LUB_GAMES) setTimeout(() => { if (!curWho) whoSheet(); }, 2200);")
rep("  if (remembered) unlock(remembered, true);\n  else if (REVEAL_KEY", "  if (window.__LUB_GAMES) {}\n  else if (remembered) unlock(remembered, true);\n  else if (REVEAL_KEY")
rep("  // ---------- Hvem er du: gjenopprett eller spør én gang ----------", games+"  // ---------- Hvem er du: gjenopprett eller spør én gang ----------")
rep("    p.append(c); w.append(p);\n  }\n", "    if (window.__lubAddName) { const f = h('form', 'gm-add'); const i = h('input'); i.type = 'text'; i.maxLength = 18; i.placeholder = 'Nytt navn'; i.setAttribute('aria-label', 'Nytt navn'); const ab = h('button', '', 'Legg til'); ab.type = 'submit'; f.append(i, ab); f.onsubmit = async (e) => { e.preventDefault(); const n = await window.__lubAddName(i.value); if (!n) return; UI.key = null; if (done) done(); render(); if (setupState) renderSetup(); }; p.append(c, f); } else p.append(c);\n    w.append(p);\n  }\n")
gcss=open(D+'site/games.css').read()
rep("</style>"+head_add, gcss+"</style>"+head_add)
O=R+'public/'
os.makedirs(O,exist_ok=True)
# Dokumentsidene flyttes ut av index.html til egne filer (lastes først når de åpnes) – gjør appen lett nok til at iPhone ikke kaster den ut
import json, shutil
m=re.search(r"\n  const SEALED_DOCS = (\{.*?\});", h)
DOCS=[]
if m:
  sd=json.loads(m.group(1)); shutil.rmtree(O+'docs', ignore_errors=True); os.makedirs(O+'docs')
  for k,v in sd['d'].items():
    fn=re.sub(r'[^A-Za-z0-9_.-]','_',k)
    assert fn==k,k
    open(O+'docs/'+k+'.json','w').write(json.dumps(v,separators=(',',':'))); DOCS.append('./docs/'+k+'.json')
  h=h[:m.start()]+"\n  const SEALED_DOCS = "+json.dumps({'salt':sd['salt'],'iter':sd['iter'],'u':'docs/'},separators=(',',':'))+";"+h[m.end():]
for f in ['manifest.webmanifest','icon-192.png','icon-512.png']:
  open(O+f,'wb').write(open(D+'site/'+f,'rb').read())
open(O+'index.html','w').write(h)
sw=open(D+'site/sw.js').read(); assert 'const DOCS = [];' in sw
open(O+'sw.js','w').write(sw.replace('const DOCS = [];','const DOCS = '+json.dumps(DOCS)+';'))
print('ok',len(h))
