(function(){
'use strict';
const $=s=>document.querySelector(s);
let muted=false,camOff=false,roomId='',token='';
let live=null,obsSender=null;
let isoRecorder=null,isoChunks=[],isoStartedAt=null,isoMime='',isoUploading=false;
const toast=$('#toast');let toastTimer;

function show(msg,error){
  toast.textContent=msg;
  toast.style.background=error?'#ff6266':'white';
  toast.style.color=error?'white':'#111';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2400);
}
function params(){const p=new URLSearchParams(location.search);return{room:p.get('room')||'',token:p.get('token')||''}}
function connectionText(state){
  return({connecting:'Connecting',waiting:'Waiting for hosts',connected:'Excellent',reconnecting:'Reconnecting',error:'Connection error','setup-required':'Needs setup'})[state]||state;
}
function guestPayload(state){
  const g=state.guest||{};
  return {
    name:g.name||'Guest',pronouns:g.pronouns||'',title:g.title||'',social:g.social||'',promo:g.promo||'',
    ready:Boolean(g.ready),admitted:Boolean(g.admitted),status:g.status||'waiting',
    episode:{season:state.episode&&state.episode.season||'',number:state.episode&&state.episode.number||'',title:state.episode&&state.episode.title||''}
  };
}
function sendState(){
  if(live&&live.ws&&live.ws.readyState===WebSocket.OPEN){
    live.sendGuestState(guestPayload(TTStudio.getState()));
  }
}
function setLiveState(event){
  const state=event.state;
  $('#connection').textContent=connectionText(state);
  $('#roomStatus').classList.toggle('connected',state==='connected');
  $('#waiting').classList.toggle('connected',state==='connected');
  if((state==='waiting'||state==='connected')&&live)sendState();
  if(state==='setup-required'){
    $('#headline').textContent='One setup step remains.';
    $('#waitingText').textContent='The live signaling Worker is not configured.';
    $('#hostPlaceholderTitle').textContent='Live connection not configured';
    $('#hostPlaceholderText').textContent='The hosts need to finish signaling setup.';
  }else if(state==='connected'){
    $('#hostPlaceholder').hidden=true;
    $('#headline').textContent='You’re connected.';
    $('#waitingText').textContent='The hosts can see and hear you.';
  }else if(state==='reconnecting'){
    $('#headline').textContent='Reconnecting…';
    $('#waitingText').textContent='Stay here—we’re restoring the connection.';
    $('#hostPlaceholder').hidden=false;
  }
}
function render(state){
  const g=state.guest||{};
  $('#guestBadge').textContent=g.name||'You';
  const rec=(g.status==='recording');
  if(rec){
    $('#roomStatus').className='rec-pill recording';
    $('#roomStatus').innerHTML='<i></i>Recording';
    $('#headline').textContent='You’re live.';
    $('#waitingText').textContent='High-quality audio is recording locally.';
  }
  sendState();
}
function chooseIsoMime(){
  if(!window.MediaRecorder)return '';
  const choices=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'];
  return choices.find(type=>MediaRecorder.isTypeSupported(type))||'';
}
function isoExtension(){
  if((isoMime||'').includes('mp4'))return 'm4a';
  if((isoMime||'').includes('webm'))return 'webm';
  return 'audio';
}
async function startIso(){
  if(isoRecorder&&isoRecorder.state==='recording')return;
  if(!media.stream){show('Microphone stream is not ready.',true);return}
  const audioTracks=media.stream.getAudioTracks();
  if(!audioTracks.length){show('No microphone track is available.',true);return}
  if(!window.MediaRecorder){show('This browser cannot create the local ISO recording.',true);return}
  isoMime=chooseIsoMime();
  isoChunks=[];
  const audioStream=new MediaStream(audioTracks);
  const options={audioBitsPerSecond:192000};
  if(isoMime)options.mimeType=isoMime;
  try{
    isoRecorder=new MediaRecorder(audioStream,options);
  }catch(error){
    isoRecorder=new MediaRecorder(audioStream);
    isoMime=isoRecorder.mimeType||'audio/webm';
  }
  isoRecorder.ondataavailable=e=>{if(e.data&&e.data.size)isoChunks.push(e.data)};
  isoRecorder.start(1000);
  isoStartedAt=new Date();
  $('#isoStatus').textContent='ISO recording';
  $('#isoStatus').classList.add('live');
  TTStudio.update(n=>{n.guest.status='recording'},'guest-iso-start');
  sendState();
  if(live)live.sendControl('iso-started',{mime:isoMime,startedAt:isoStartedAt.toISOString()});
}
async function stopIsoAndUpload(){
  if(isoUploading)return;
  if(!isoRecorder||isoRecorder.state==='inactive'){
    if(live)live.sendControl('iso-upload-failed',{reason:'No local ISO recording was running'});
    return;
  }
  isoUploading=true;
  $('#isoStatus').textContent='Finishing ISO…';
  const blob=await new Promise(resolve=>{
    isoRecorder.onstop=()=>resolve(new Blob(isoChunks,{type:isoMime||isoRecorder.mimeType||'application/octet-stream'}));
    isoRecorder.stop();
  });
  $('#isoStatus').textContent='Uploading ISO…';
  try{
    const state=TTStudio.getState();
    const safeName=(state.guest.name||'guest').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'guest';
    const fileName=`${safeName}-S${state.episode.season}-E${state.episode.number}-${Date.now()}.${isoExtension()}`;
    const base=(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');
    const url=`${base}/room/${encodeURIComponent(roomId)}/iso?token=${encodeURIComponent(token)}&name=${encodeURIComponent(fileName)}`;
    const response=await fetch(url,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
    if(!response.ok)throw new Error(`Upload failed (${response.status})`);
    const result=await response.json();
    $('#isoStatus').textContent='ISO safely received ✓';
    $('#isoStatus').classList.remove('live');
    if(live)live.sendControl('iso-upload-complete',{key:result.key,name:fileName,size:blob.size,mime:blob.type});
    isoChunks=[];isoUploading=false;
    return result;
  }catch(error){
    isoUploading=false;
    $('#isoStatus').textContent='ISO upload needs attention';
    if(live)live.sendControl('iso-upload-failed',{reason:error.message||String(error)});
    throw error;
  }
}
async function finishFromHost(){
  try{await stopIsoAndUpload()}catch(error){show('High-quality audio upload failed. Keep this page open.',true);return}
  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'host-finished-session');
  setTimeout(()=>{
    try{if(obsSender)obsSender.close()}catch{}
    try{if(live)live.close()}catch{}
    try{media.destroy()}catch{}
    location.href='guest-goodbye.html?ended=host';
  },700);
}

const media=new TTMediaController({video:$('#roomVideo'),meter:null,onStatus(s){if(!s.ready)$('#videoQuality').textContent='Camera unavailable'}});

async function start(){
  const p=params();roomId=p.room;token=p.token;
  try{
    const stream=await media.start();

    live=new TTLiveGuest.LiveGuestConnection({
      role:'guest',room:roomId,token,localStream:stream,remoteVideo:$('#hostVideo'),
      onState:setLiveState,
      onMessage(message){
        if(!message)return;
        if(message.type==='control'&&message.action==='admitted'){
          TTStudio.update(n=>{n.guest.admitted=Boolean(message.value);n.guest.status=message.value?'admitted':'waiting'},'host-admission-state');
          sendState();
        }
        if(message.type==='control'&&message.action==='start-iso')startIso();
        if(message.type==='control'&&['finish-session','end-session'].includes(message.action))finishFromHost();
      },
      onStats(stats){
        const video=stats.video;
        if(video&&video.frameWidth&&video.frameHeight)$('#videoQuality').textContent=`${video.frameWidth}×${video.frameHeight}`;
        else $('#videoQuality').textContent='Live';
      }
    });
    await live.connect();

    // Dedicated second WebRTC sender for the clean OBS Browser Source.
    obsSender=new TTLiveGuest.LiveGuestConnection({
      role:'guest-obs',room:roomId,token,localStream:stream,remoteVideo:null,
      onState:event=>{
        $('#obsFeedStatus').textContent=event.state==='connected'?'OBS feed ready':'OBS feed standby';
      }
    });
    await obsSender.connect();

    setTimeout(sendState,700);
  }catch(error){
    $('#connection').textContent='Media blocked';
    show('Camera and microphone permission are required.',true);
  }
}

TTStudio.subscribe(render);
start();

$('#mic').onclick=()=>{
  muted=!muted;
  if(media.stream)media.stream.getAudioTracks().forEach(t=>t.enabled=!muted);
  $('#mic').classList.toggle('off',muted);$('#mic span').textContent=muted?'Unmute':'Mute';
  if(live)live.sendControl('guest-mic',!muted);
};
$('#camera').onclick=()=>{
  camOff=!camOff;
  if(media.stream)media.stream.getVideoTracks().forEach(t=>t.enabled=!camOff);
  $('#camera').classList.toggle('off',camOff);$('#camera span').textContent=camOff?'Camera on':'Camera';
  if(live)live.sendControl('guest-camera',!camOff);
};
$('#leave').onclick=async()=>{
  if(!confirm('Leave the guest studio?'))return;
  if(isoRecorder&&isoRecorder.state==='recording'){
    show('Your high-quality audio is still recording. Ask the hosts to end the session.',true);
    return;
  }
  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'guest-complete');
  if(obsSender)obsSender.close();if(live)live.close();media.destroy();location.href='guest-goodbye.html';
};
addEventListener('beforeunload',()=>{if(obsSender)obsSender.close();if(live)live.close();media.destroy()});
})();