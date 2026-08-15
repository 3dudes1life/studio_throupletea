(function(){
'use strict';
const $=s=>document.querySelector(s);
let stage='tech',mediaReady=false,speakerReady=false,timer;
const toast=$('#toast');
let checkinSocket=null;

const SESSION_KEY='TT_GUEST_CODE_SESSION_V1';

function workerBase(){
  return String(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');
}
function show(msg,error){
  toast.textContent=msg;toast.classList.toggle('error',!!error);toast.classList.add('show');
  clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2400);
}
function set(sel,text,good){const n=$(sel);n.textContent=text;n.classList.toggle('good',good)}
function readSession(){
  try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}
}
function saveSession(value){sessionStorage.setItem(SESSION_KEY,JSON.stringify(value))}
function clearSession(){sessionStorage.removeItem(SESSION_KEY)}
function roomParams(){
  const session=readSession();
  if(session&&session.room&&session.token)return{room:session.room,token:session.token};
  // Legacy migration: accept old token URL once, then remove it from the address bar.
  const q=new URLSearchParams(location.search);
  const room=q.get('room')||'',token=q.get('token')||'';
  if(room&&token){
    saveSession({room,token,legacy:true});
    history.replaceState({},document.title,location.pathname);
  }
  return{room,token};
}
async function resolveCode(raw){
  const code=String(raw||'').replace(/\D/g,'');
  if(code.length!==6)throw new Error('Enter all six digits.');
  const response=await fetch(`${workerBase()}/code/resolve`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code})
  });
  let data={};
  try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'That guest code could not be opened.');
  saveSession({
    room:data.room,token:data.token,code:data.code,
    expiresAt:data.expiresAt,guest:data.guest||{},episode:data.episode||{}
  });
  return data;
}
function hydrateResolved(data){
  TTStudio.update(next=>{
    const g=data.guest||{},e=data.episode||{};
    next.guest.name=g.name||'Guest';
    next.guest.pronouns=g.pronouns||'';
    next.guest.title=g.title||'';
    next.guest.social=g.social||'';
    next.guest.promo=g.promo||'';
    next.guest.status='tech';
    next.episode.season=e.season||next.episode.season;
    next.episode.number=e.number||next.episode.number;
    next.episode.title=e.title||next.episode.title;
    next.episode.mainTopic=e.mainTopic||next.episode.mainTopic;
    next.liveRoom.roomId=data.room;
    next.liveRoom.token=data.token;
  },'guest-code-resolved');
}
function authorizeUI(){
  $('#codeGate').hidden=true;
  $('#guestShell').hidden=false;
  openCheckinSignal();
  setTimeout(()=>$('#testDevices').focus(),50);
}
async function bootstrapAccess(){
  const existing=readSession();
  const rp=roomParams();

  if(existing&&existing.room&&existing.token){
    if(existing.guest||existing.episode)hydrateResolved(existing);
    authorizeUI();
    return;
  }
  if(rp.room&&rp.token){
    authorizeUI();
    return;
  }
  $('#codeGate').hidden=false;
  $('#guestShell').hidden=true;
  setTimeout(()=>$('#codeInput').focus(),80);
}

function openCheckinSignal(){
  const cfg=window.TT_LIVE_GUEST_CONFIG||{},rp=roomParams();
  if(!cfg.signalingBaseUrl||!rp.room||!rp.token)return;
  try{
    if(checkinSocket){try{checkinSocket.close()}catch{}}
    const u=new URL(cfg.signalingBaseUrl);
    u.protocol=u.protocol==='https:'?'wss:':'ws:';
    u.pathname=`/room/${encodeURIComponent(rp.room)}/websocket`;
    u.search=`?role=guest&token=${encodeURIComponent(rp.token)}`;
    checkinSocket=new WebSocket(u.href);
    checkinSocket.addEventListener('open',()=>sendGuestState());
  }catch{}
}
function sendGuestState(){
  if(!checkinSocket||checkinSocket.readyState!==WebSocket.OPEN)return;
  const s=TTStudio.getState(),g=s.guest||{};
  checkinSocket.send(JSON.stringify({type:'guest-state',guest:{
    name:g.name||'Guest',pronouns:g.pronouns||'',title:g.title||'',social:g.social||'',promo:g.promo||'',
    ready:Boolean(g.ready),admitted:Boolean(g.admitted),status:g.status||stage,
    episode:{season:s.episode.season||'',number:s.episode.number||'',title:s.episode.title||''}
  }}));
}

const media=new TTMediaController({
  video:$('#previewVideo'),meter:$('#audioMeter'),cameraSelect:$('#cameraSelect'),micSelect:$('#micSelect'),
  onStatus(s){
    mediaReady=!!(s.ready&&s.camera&&s.microphone);
    $('#previewEmpty').hidden=!!s.camera;
    set('#cameraStatus',s.camera?'Ready':'Unavailable',!!s.camera);
    set('#micStatus',s.microphone?'Ready':'Unavailable',!!s.microphone);
    updateTech();
  }
});

function updateTech(){$('#techContinue').disabled=!(mediaReady&&speakerReady)}
function browser(){const good=!!(isSecureContext&&navigator.mediaDevices);set('#browserStatus',good?'Ready':'Needs HTTPS',good)}
function network(){set('#networkStatus',navigator.onLine?'Online':'Offline',navigator.onLine)}
function intro(){
  const name=$('#guestName').value.trim()||'Guest',title=$('#guestTitle').value.trim(),social=$('#social').value.trim();
  $('#introPreviewName').textContent=name;$('#introPreviewMeta').textContent=[title,social].filter(Boolean).join(' · ');$('#introPreviewPromo').textContent=$('#promo').value.trim();
}
function prepReady(){$('#prepContinue').disabled=![...document.querySelectorAll('.prep-check')].every(x=>x.checked)||!$('#releaseAccepted').checked}
function showStage(next){
  stage=next;
  document.querySelectorAll('.stage').forEach(n=>n.classList.toggle('active',n.id===`stage-${next}`));
  const order=['tech','intro','prep','done'];
  document.querySelectorAll('.steps button').forEach(b=>{
    const i=order.indexOf(b.dataset.stage),c=order.indexOf(next);
    b.classList.toggle('active',i===c);b.classList.toggle('done',i<c);b.querySelector('i').textContent=i<c?'✓':i+1;
  });
  scrollTo({top:$('.steps').offsetTop-10,behavior:'smooth'});
}
function render(state){
  const g=state.guest||{};
  $('#welcomeTitle').innerHTML=`Welcome${g.name&&g.name!=='Future Guest'?', '+g.name:''}.<span>We’ll handle the tech.</span>`;
  $('#episodeTitle').textContent=`S${state.episode.season} Ep${state.episode.number} · ${state.episode.title}`;
  $('#episodeMeta').textContent='Private guest check-in';
  $('#episodeTopic').textContent=state.episode.mainTopic||'';
  if(document.activeElement!==$('#guestName'))$('#guestName').value=g.name==='Future Guest'?'':g.name||'';
  if(document.activeElement!==$('#pronouns'))$('#pronouns').value=g.pronouns||'';
  if(document.activeElement!==$('#guestTitle'))$('#guestTitle').value=g.title||'';
  if(document.activeElement!==$('#social'))$('#social').value=g.social||'';
  if(document.activeElement!==$('#promo'))$('#promo').value=g.promo||'';
  intro();
}
function save(){
  TTStudio.update(n=>{
    n.guest.name=$('#guestName').value.trim()||'Guest';
    n.guest.pronouns=$('#pronouns').value.trim();
    n.guest.title=$('#guestTitle').value.trim();
    n.guest.social=$('#social').value.trim();
    n.guest.promo=$('#promo').value.trim();
    n.guest.status='tech';
  },'guest-details');
}

$('#codeInput').addEventListener('input',event=>{
  const digits=event.target.value.replace(/\D/g,'').slice(0,6);
  event.target.value=digits.length>3?`${digits.slice(0,3)} ${digits.slice(3)}`:digits;
});
$('#codeForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=$('#codeGateStatus');
  status.className='code-gate-status';
  status.textContent='Checking your private guest code…';
  try{
    const data=await resolveCode($('#codeInput').value);
    hydrateResolved(data);
    status.className='code-gate-status good';
    status.textContent='Code accepted. Opening your guest studio…';
    authorizeUI();
  }catch(error){
    clearSession();
    status.className='code-gate-status error';
    status.textContent=error.message;
  }
});

TTStudio.subscribe(state=>{render(state);sendGuestState()});
browser();network();bootstrapAccess();
addEventListener('online',network);addEventListener('offline',network);

$('#testDevices').onclick=async()=>{try{await media.start();show('Camera and microphone are live. Say a few words.')}catch{show('Camera or microphone permission is blocked.',true)}};
$('#testSpeaker').onclick=()=>{speakerReady=true;updateTech();show('Headphone check marked ready.')};
$('#techContinue').onclick=()=>{TTStudio.update(n=>{n.guest.status='tech'},'guest-tech');showStage('intro')};
$('#introBack').onclick=()=>showStage('tech');
['#guestName','#pronouns','#guestTitle','#social','#promo'].forEach(s=>$(s).oninput=intro);
$('#introContinue').onclick=()=>{save();showStage('prep')};
$('#prepBack').onclick=()=>showStage('intro');
document.querySelectorAll('.prep-check').forEach(x=>x.onchange=prepReady);
$('#releaseAccepted').onchange=prepReady;

$('#prepContinue').onclick=()=>{
  save();
  TTStudio.update(n=>{
    n.guest.releaseAccepted=true;n.guest.ready=true;n.guest.status='ready';n.guest.checkInCompletedAt=new Date().toISOString()
  },'guest-ready');
  showStage('done');
  $('#readyPill').classList.add('ready');$('#readyPill').querySelector('span').textContent='Ready';
};

$('#enterStudio').onclick=async()=>{
  TTStudio.update(n=>{n.guest.status='waiting';n.guest.waitingSince=new Date().toISOString();n.guest.admitted=false},'guest-waiting');
  await media.stop();
  location.href='guest-room.html';
};

addEventListener('beforeunload',()=>{try{if(checkinSocket)checkinSocket.close()}catch{};media.destroy()});
})();