/**
 * Slim browser error overlay (dev only).
 * Supports multiple errors with prev/next switch.
 */

let errorSeq = 0;

export function serializeError(error) {
  const stack = String(error?.stack ?? '');
  const loc = parseStackLocation(stack);

  return {
    id: ++errorSeq,
    name: error?.name ?? 'Error',
    message: String(error?.message ?? error ?? 'Unknown error'),
    stack,
    file: loc.file,
    line: loc.line,
    column: loc.column,
  };
}

export function renderOverlayPage(errors, { scriptSrc = '/_Taand/live.js', cssSrc = '/_Taand/overlay.css' } = {}) {
  const list = Array.isArray(errors) ? errors : [errors];
  const payload = JSON.stringify(list).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(list[0]?.name ?? 'Error')} — Taand</title>
  <link rel="stylesheet" href="${cssSrc}">
</head>
<body style="margin:0;background:#0a0a0a;min-height:100vh">
  <template id="taand-errors">${payload}</template>
  <script src="${scriptSrc}" defer></script>
</body>
</html>`;
}

/** Client JS appended to live.js — mounts overlay + SSE error events. */
export const OVERLAY_CLIENT_JS = `(function(){
var ROOT_ID="taand-error-overlay";
var errors=[];
var index=0;
var root=null;

function parseBoot(){
  var t=document.getElementById("taand-errors");
  if(!t)return;
  var raw=(t.content&&t.content.textContent!=null)?t.content.textContent:t.innerHTML;
  try{
    var list=JSON.parse(raw||"[]");
    if(Array.isArray(list)&&list.length){errors=list;index=0;render();}
  }catch(e){}
}

function ensureRoot(){
  if(root&&document.body.contains(root))return root;
  root=document.getElementById(ROOT_ID);
  if(root)return root;
  root=document.createElement("div");
  root.id=ROOT_ID;
  document.documentElement.appendChild(root);
  if(!document.getElementById("taand-overlay-css")){
    var s=document.createElement("link");
    s.id="taand-overlay-css";
    s.rel="stylesheet";
    s.href="/_Taand/overlay.css";
    document.head.appendChild(s);
  }
  return root;
}

function esc(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function hide(){
  if(root){root.innerHTML="";root.style.display="none";}
}

function render(){
  if(!errors.length){hide();return;}
  if(index<0)index=0;
  if(index>=errors.length)index=errors.length-1;
  var e=errors[index];
  var el=ensureRoot();
  el.style.display="block";
  var nav=errors.length>1
    ?('<div class="t-nav">'
      +'<button type="button" data-t="prev" aria-label="Previous error" '+(index===0?"disabled":"")+'>‹</button>'
      +'<span class="t-count">'+(index+1)+' / '+errors.length+'</span>'
      +'<button type="button" data-t="next" aria-label="Next error" '+(index>=errors.length-1?"disabled":"")+'>›</button>'
      +'</div>')
    :'';
  var loc=(e.file?('<div class="t-file">'+esc(e.file)+(e.line!=null?':'+e.line:'')+'</div>'):'');
  el.innerHTML='<div class="t-backdrop" data-t="close"></div>'
    +'<div class="t-panel" role="alertdialog" aria-modal="true">'
    +'<div class="t-top">'
    +'<div class="t-label">'+esc(e.name||"Error")+'</div>'
    +nav
    +'<button type="button" class="t-x" data-t="close" aria-label="Dismiss">×</button>'
    +'</div>'
    +'<div class="t-msg">'+esc(e.message)+'</div>'
    +loc
    +(e.stack?('<pre class="t-stack">'+esc(e.stack)+'</pre>'):'')
    +'</div>';

  el.onclick=function(ev){
    var t=ev.target.closest("[data-t]");
    if(!t)return;
    var a=t.getAttribute("data-t");
    if(a==="close")hide();
    else if(a==="prev"&&index>0){index--;render();}
    else if(a==="next"&&index<errors.length-1){index++;render();}
  };
}

function pushErrors(list){
  if(!list||!list.length)return;
  errors=list.slice();
  index=errors.length-1;
  render();
}

function onPayload(data){
  if(data==="reload"){location.reload();return;}
  if(data==="connected"||!data)return;
  try{
    var msg=JSON.parse(data);
    if(msg.type==="error"){
      if(msg.errors)pushErrors(msg.errors);
      else if(msg.error)pushErrors([msg.error]);
    }else if(msg.type==="clear-errors"){
      errors=[];hide();
    }else if(msg.type==="reload"){
      location.reload();
    }
  }catch(err){
    if(data==="reload")location.reload();
  }
}

window.__TAAND_OVERLAY__={push:pushErrors,clear:function(){errors=[];hide();},show:render};
window.__TAAND_LIVE_MESSAGE__=onPayload;

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",parseBoot);
else parseBoot();

document.addEventListener("keydown",function(ev){
  if(!errors.length||!root||root.style.display==="none")return;
  if(ev.key==="Escape")hide();
  if(ev.key==="ArrowLeft"&&index>0){index--;render();}
  if(ev.key==="ArrowRight"&&index<errors.length-1){index++;render();}
});
})();`;

export const OVERLAY_CSS = `
#taand-error-overlay{position:fixed;inset:0;z-index:2147483646;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
#taand-error-overlay .t-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
#taand-error-overlay .t-panel{position:absolute;left:50%;top:12%;transform:translateX(-50%);width:min(640px,calc(100vw - 24px));max-height:76vh;overflow:auto;background:#111;color:#fafafa;border:1px solid #333;border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45);padding:14px 16px 16px}
#taand-error-overlay .t-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#taand-error-overlay .t-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f87171}
#taand-error-overlay .t-nav{display:flex;align-items:center;gap:6px;margin-left:auto}
#taand-error-overlay .t-nav button{appearance:none;border:1px solid #333;background:#1a1a1a;color:#ddd;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1}
#taand-error-overlay .t-nav button:disabled{opacity:.35;cursor:default}
#taand-error-overlay .t-nav button:not(:disabled):hover{background:#222;border-color:#444}
#taand-error-overlay .t-count{font-size:12px;color:#a3a3a3;min-width:3.2em;text-align:center;font-variant-numeric:tabular-nums}
#taand-error-overlay .t-x{margin-left:auto;appearance:none;border:0;background:transparent;color:#a3a3a3;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}
#taand-error-overlay .t-nav + .t-x{margin-left:4px}
#taand-error-overlay .t-x:hover{color:#fff}
#taand-error-overlay .t-msg{font-size:15px;font-weight:600;line-height:1.45;color:#fff;margin:0 0 8px;white-space:pre-wrap;word-break:break-word}
#taand-error-overlay .t-file{font-size:12px;color:#fbbf24;margin:0 0 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
#taand-error-overlay .t-stack{margin:0;padding:10px 12px;background:#0a0a0a;border:1px solid #222;border-radius:8px;font-size:11.5px;line-height:1.5;color:#a3a3a3;overflow:auto;max-height:42vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
`.replace(/\n/g, '');

function parseStackLocation(stack) {
  const lines = String(stack).split('\n');
  for (const line of lines) {
    const m = line.match(/(?:at\s+)?(?:.+?\s+\()?((?:file:\/\/|[A-Za-z]:[\\/]|\/)[^:)\s]+):(\d+)(?::(\d+))?/);
    if (!m) continue;
    return {
      file: m[1].replace(/^file:\/\//, ''),
      line: Number(m[2]),
      column: m[3] != null ? Number(m[3]) : null,
    };
  }
  return { file: null, line: null, column: null };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
