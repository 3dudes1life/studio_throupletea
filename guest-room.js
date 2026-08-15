(function(){
'use strict';
const $=s=>document.querySelector(s);

let muted=false,camOff=false,roomId='',token='';
let live=null,obsSender=null;
let audioRecorder=null,videoRecorder=null;
let audioMime='',videoMime='',captureSessionId='',captureStartedAt=null;
let audioIndex=0,videoIndex=0,pendingWrites=0;
let uploadInProgress=false,finishing=false;
let wakeLock=null,healthTimer=null,networkWasOffline=false;
let lastAudioChunkAt=0,lastVideoChunkAt=0;
const toast=$('#toast');let toastTimer;

function show(msg,error){
  toast.textContent=msg;
  toast.style.background=error?'#ff6266':'white';
  toast.style.color=error?'white':'#111';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);
}
function params(){
  try{
    const saved=JSON.parse(sessionStorage.getItem('TT_GUEST_CODE_SESSION_V1')||'null');
    if(saved&&saved.room&&saved.token)return{room:saved.room,token:saved.token};
  }catch{}
  const p=new URLSearchParams(location.search);
  return{room:p.get('room')||'',token:p.get('token')||''};
}
function guestPayload(state){
  const g=state.guest||{};
  return {
    name:g.name||'Guest',pronouns:g.pronouns||'',title:g.title||'',
    social:g.social||'',promo:g.promo||'',ready:Boolean(g.ready),
    admitted:Boolean(g.admitted),status:g.status||'waiting',
    captureSessionId:captureSessionId||'',
    captureHealth:currentCaptureHealth(),
    episode:{season:state.episode&&state.episode.season||'',number:state.episode&&state.episode.number||'',title:state.episode&&state.episode.title||''}
  };
}
function currentCaptureHealth(){
  const recording=Boolean(videoRecorder&&videoRecorder.state==='recording'&&audioRecorder&&audioRecorder.state==='recording');
  return {
    recording,
    audioChunkAge:lastAudioChunkAt?Date.now()-lastAudioChunkAt:null,
    videoChunkAge:lastVideoChunkAt?Date.now()-lastVideoChunkAt:null,
    pendingWrites,
    online:navigator.onLine,
    uploadInProgress
  };
}
function sendState(){
  if(live&&live.ws&&live.ws.readyState===WebSocket.OPEN){
    live.sendGuestState(guestPayload(TTStudio.getState()));
  }
}
function connectionText(state){
  return ({connecting:'Connecting',waiting:'Waiting for hosts',connected:'Excellent',reconnecting:'Reconnecting',error:'Connection error','setup-required':'Needs setup'})[state]||state;
}
function setLiveState(event){
  const state=event.state;
  $('#connection').textContent=connectionText(state);
  $('#roomStatus').classList.toggle('connected',state==='connected');
  $('#waiting').classList.toggle('connected',state==='connected');
  if(state==='connected'){
    $('#hostPlaceholder').hidden=true;
    $('#headline').textContent='You’re connected.';
    $('#waitingText').textContent='The hosts can see and hear you.';
  }else if(state==='reconnecting'){
    $('#headline').textContent='Reconnecting…';
    $('#waitingText').textContent='Your local master keeps recording while we reconnect.';
    $('#hostPlaceholder').hidden=false;
  }
  sendState();
}
function render(state){
  const g=state.guest||{};
  $('#guestBadge').textContent=g.name||'You';
  if(g.status==='recording'){
    $('#roomStatus').className='rec-pill recording';
    $('#roomStatus').innerHTML='<i></i>LOCAL MASTER RECORDING';
    $('#headline').textContent='You’re live.';
    $('#waitingText').textContent='Your high-quality audio + video are being saved locally.';
  }
  sendState();
}
function supportedMime(choices){
  if(!window.MediaRecorder)return '';
  return choices.find(type=>MediaRecorder.isTypeSupported(type))||'';
}
function extFor(mime,kind){
  if((mime||'').includes('mp4'))return kind==='audio'?'m4a':'mp4';
  if((mime||'').includes('webm'))return 'webm';
  return kind;
}
function safeName(){
  const s=TTStudio.getState();
  return (s.guest.name||'guest').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'guest';
}
async function acquireWakeLock(){
  if(!('wakeLock' in navigator))return;
  try{
    wakeLock=await navigator.wakeLock.request('screen');
    $('#wakeStatus').textContent='Screen protected ✓';
  }catch{
    $('#wakeStatus').textContent='Keep this screen awake';
  }
}
async function storagePreflight(){
  await TTISOStore.persistStorage();
  const e=await TTISOStore.estimate();
  $('#storageStatus').textContent=e.free?`${TTISOStore.humanBytes(e.free)} free`:'Available';
  // Conservative minimum: 1 GB before a long interview.
  if(e.free&&e.free<1024*1024*1024){
    throw new Error(`Low device storage (${TTISOStore.humanBytes(e.free)} free). Free space before recording.`);
  }
}
async function putChunkSafe(kind,index,blob){
  pendingWrites++;
  try{
    await TTISOStore.putChunk(captureSessionId,kind,index,blob);
    if(kind==='audio')lastAudioChunkAt=Date.now();
    else lastVideoChunkAt=Date.now();
  }finally{
    pendingWrites=Math.max(0,pendingWrites-1);
  }
}
function recorder(stream,mime,bps,kind){
  const opts={};if(mime)opts.mimeType=mime;if(bps)opts.bitsPerSecond=bps;
  let r;try{r=new MediaRecorder(stream,opts)}catch{r=new MediaRecorder(stream)}
  r.ondataavailable=e=>{
    if(!e.data||!e.data.size)return;
    const idx=kind==='audio'?audioIndex++:videoIndex++;
    putChunkSafe(kind,idx,e.data).catch(error=>{
      $('#captureGuard').textContent='LOCAL SAVE ERROR';
      $('#captureGuard').className='danger';
      if(live)live.sendControl('capture-warning',{kind,reason:error.message||String(error)});
    });
  };
  r.onerror=e=>{
    $('#captureGuard').textContent='RECORDER ERROR';
    $('#captureGuard').className='danger';
    if(live)live.sendControl('capture-warning',{kind,reason:(e.error&&e.error.message)||'Recorder error'});
  };
  return r;
}
async function startCapture(){
  if(videoRecorder&&videoRecorder.state==='recording')return;
  if(!media.stream)throw new Error('Camera and microphone are not ready.');
  if(!window.MediaRecorder)throw new Error('This browser does not support local recording.');

  await storagePreflight();
  await acquireWakeLock();

  const at=media.stream.getAudioTracks()[0],vt=media.stream.getVideoTracks()[0];
  if(!at||!vt)throw new Error('Both camera and microphone are required.');

  audioMime=supportedMime(['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm']);
  videoMime=supportedMime(['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']);

  captureSessionId=`${roomId}-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
  captureStartedAt=new Date();audioIndex=0;videoIndex=0;lastAudioChunkAt=0;lastVideoChunkAt=0;

  await TTISOStore.putSession({
    sessionId:captureSessionId,roomId,tokenHint:token.slice(0,6),createdAt:captureStartedAt.toISOString(),
    guest:safeName(),status:'recording',audioMime,videoMime,episode:TTStudio.getState().episode
  });

  const audioStream=new MediaStream([at.clone()]);
  const avStream=new MediaStream([vt.clone(),at.clone()]);
  audioRecorder=recorder(audioStream,audioMime,192000,'audio');
  videoRecorder=recorder(avStream,videoMime,8_000_000,'video');

  // Five-second chunks are persisted immediately in IndexedDB.
  audioRecorder.start(5000);
  videoRecorder.start(5000);

  $('#isoStatus').textContent='Audio master protected';
  $('#videoIsoStatus').textContent='Video master protected';
  $('#captureGuard').textContent='LOCAL BACKUP ACTIVE';
  $('#captureGuard').className='safe';

  TTStudio.update(n=>{n.guest.status='recording'},'hardened-capture-start');
  if(live)live.sendControl('iso-started',{
    sessionId:captureSessionId,audioMime:audioRecorder.mimeType||audioMime,
    videoMime:videoRecorder.mimeType||videoMime,startedAt:captureStartedAt.toISOString(),guard:'indexeddb'
  });
  sendState();
}
function stopRecorder(r){
  return new Promise((resolve,reject)=>{
    if(!r||r.state==='inactive'){resolve();return}
    r.onerror=e=>reject((e&&e.error)||new Error('Recorder failed while stopping'));
    r.onstop=()=>{
      try{r.stream.getTracks().forEach(t=>t.stop())}catch{}
      resolve();
    };
    r.requestData();
    setTimeout(()=>{try{r.stop()}catch(error){reject(error)}},120);
  });
}
async function waitWrites(){
  const started=Date.now();
  while(pendingWrites>0){
    if(Date.now()-started>15000)throw new Error('Local recording chunks are still being saved.');
    await new Promise(r=>setTimeout(r,150));
  }
}
async function blobFromStore(kind,mime){
  const chunks=await TTISOStore.getChunks(captureSessionId,kind);
  if(!chunks.length)throw new Error(`No ${kind} recording chunks were saved.`);
  return new Blob(chunks.map(c=>c.blob),{type:mime||chunks[0].type||'application/octet-stream'});
}
async function uploadBlob(blob,fileName,attempt=1){
  const base=(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');
  const url=`${base}/room/${encodeURIComponent(roomId)}/iso?token=${encodeURIComponent(token)}&name=${encodeURIComponent(fileName)}`;
  try{
    const response=await fetch(url,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
    if(!response.ok)throw new Error(`Upload failed (${response.status})`);
    return await response.json();
  }catch(error){
    if(attempt>=4)throw error;
    $('#captureGuard').textContent=`UPLOAD RETRY ${attempt}/3`;
    $('#captureGuard').className='warn';
    await new Promise(r=>setTimeout(r,1500*Math.pow(2,attempt-1)));
    return uploadBlob(blob,fileName,attempt+1);
  }
}
async function stopAndUpload(){
  if(uploadInProgress||finishing)return;
  finishing=true;uploadInProgress=true;
  $('#captureGuard').textContent='FINISHING LOCAL FILES';
  $('#captureGuard').className='warn';

  try{
    await Promise.all([stopRecorder(audioRecorder),stopRecorder(videoRecorder)]);
    await waitWrites();

    await TTISOStore.putSession({
      ...(await TTISOStore.getSession(captureSessionId)),
      status:'uploading',stoppedAt:new Date().toISOString()
    });

    const audioBlob=await blobFromStore('audio',audioRecorder&&audioRecorder.mimeType||audioMime);
    const videoBlob=await blobFromStore('video',videoRecorder&&videoRecorder.mimeType||videoMime);

    const s=TTStudio.getState(),stamp=Date.now(),baseName=`${safeName()}-S${s.episode.season}-E${s.episode.number}-${stamp}`;
    $('#isoStatus').textContent='Uploading audio master…';
    $('#videoIsoStatus').textContent='Uploading video master…';
    $('#captureGuard').textContent='UPLOAD IN PROGRESS';

    // Sequential upload avoids fighting for bandwidth/memory on phones/tablets.
    const audioResult=await uploadBlob(audioBlob,`${baseName}-GUEST-AUDIO.${extFor(audioBlob.type,'audio')}`);
    $('#isoStatus').textContent='Audio safely received ✓';
    if(live)live.sendControl('iso-upload-progress',{kind:'audio',key:audioResult.key});

    const videoResult=await uploadBlob(videoBlob,`${baseName}-GUEST-VIDEO.${extFor(videoBlob.type,'video')}`);
    $('#videoIsoStatus').textContent='Video safely received ✓';

    await TTISOStore.putSession({
      ...(await TTISOStore.getSession(captureSessionId)),
      status:'complete',audioKey:audioResult.key,videoKey:videoResult.key,completedAt:new Date().toISOString()
    });

    $('#captureGuard').textContent='BOTH MASTERS SAFE ✓';
    $('#captureGuard').className='safe';
    if(live)live.sendControl('iso-upload-complete',{
      sessionId:captureSessionId,
      audio:{key:audioResult.key,size:audioBlob.size,mime:audioBlob.type},
      video:{key:videoResult.key,size:videoBlob.size,mime:videoBlob.type}
    });

    // Cleanup only after cloud confirmation.
    await TTISOStore.deleteSession(captureSessionId);
    uploadInProgress=false;finishing=false;
    return {audioResult,videoResult};
  }catch(error){
    uploadInProgress=false;finishing=false;
    $('#captureGuard').textContent='RECOVERY COPY KEPT LOCALLY';
    $('#captureGuard').className='danger';
    $('#isoStatus').textContent='Upload incomplete';
    $('#videoIsoStatus').textContent='Do not close this page';
    if(live)live.sendControl('iso-upload-failed',{sessionId:captureSessionId,reason:error.message||String(error)});
    throw error;
  }
}
async function finishFromHost(){
  try{await stopAndUpload()}
  catch(error){show(`Upload did not finish: ${error.message}. Local recovery copy is still saved.`,true);return}

  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'host-finished-session');
  setTimeout(()=>{
    try{if(obsSender)obsSender.close()}catch{}
    try{if(live)live.close()}catch{}
    try{media.destroy()}catch{}
    location.href='guest-goodbye.html?ended=host';
  },1000);
}
async function resumePendingCapture(){
  try{
    const sessions=(await TTISOStore.listSessions())
      .filter(s=>s.roomId===roomId&&['recording','uploading'].includes(s.status))
      .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(!sessions.length)return;

    const pending=sessions[0];
    captureSessionId=pending.sessionId;
    audioMime=pending.audioMime||'';
    videoMime=pending.videoMime||'';

    $('#captureGuard').textContent='RECOVERY COPY FOUND';
    $('#captureGuard').className='warn';
    $('#isoStatus').textContent='Recovered local audio';
    $('#videoIsoStatus').textContent='Recovered local video';

    if(live)live.sendControl('capture-recovery-found',{sessionId:captureSessionId});
    show('A protected guest recording from this session was recovered. Do not clear this guest.',false);
  }catch{}
}
function startHealthWatch(){
  clearInterval(healthTimer);
  healthTimer=setInterval(async()=>{
    const recording=videoRecorder&&videoRecorder.state==='recording';
    if(recording){
      const aAge=lastAudioChunkAt?Date.now()-lastAudioChunkAt:0;
      const vAge=lastVideoChunkAt?Date.now()-lastVideoChunkAt:0;
      if((aAge>13000&&lastAudioChunkAt)||(vAge>13000&&lastVideoChunkAt)){
        $('#captureGuard').textContent='CAPTURE WATCHDOG WARNING';
        $('#captureGuard').className='danger';
        if(live)live.sendControl('capture-warning',{reason:'Recording chunks stopped updating'});
      }
    }
    const e=await TTISOStore.estimate().catch(()=>null);
    if(e&&e.free)$('#storageStatus').textContent=`${TTISOStore.humanBytes(e.free)} free`;
    sendState();
  },5000);
}

const media=new TTMediaController({
  video:$('#roomVideo'),meter:null,
  onStatus(s){
    if(!s.ready)$('#videoQuality').textContent='Camera unavailable';
  }
});

async function start(){
  const p=params();roomId=p.room;token=p.token;
  try{
    const stream=await media.start();

    stream.getTracks().forEach(track=>{
      track.addEventListener('ended',()=>{
        $('#captureGuard').textContent=`${track.kind.toUpperCase()} DEVICE DISCONNECTED`;
        $('#captureGuard').className='danger';
        if(live)live.sendControl('capture-warning',{reason:`${track.kind} device disconnected`});
      });
      track.addEventListener('mute',()=>{
        if(live)live.sendControl('capture-warning',{reason:`${track.kind} track muted by device/browser`});
      });
    });

    live=new TTLiveGuest.LiveGuestConnection({
      role:'guest',room:roomId,token,localStream:stream,remoteVideo:$('#hostVideo'),
      onState:setLiveState,
      onMessage(message){
        if(!message)return;
        if(message.type==='control'&&message.action==='admitted'){
          TTStudio.update(n=>{n.guest.admitted=Boolean(message.value);n.guest.status=message.value?'admitted':'waiting'},'host-admission-state');
        }
        if(message.type==='control'&&message.action==='start-iso'){
          startCapture().catch(error=>{
            show(error.message,true);
            if(live)live.sendControl('iso-start-failed',{reason:error.message});
          });
        }
        if(message.type==='control'&&['finish-session','end-session'].includes(message.action))finishFromHost();
        if(message.type==='control'&&message.action==='retry-upload'){
          stopAndUpload().catch(error=>show(error.message,true));
        }
      },
      onStats(stats){
        const v=stats.video;
        $('#videoQuality').textContent=v&&v.frameWidth?`${v.frameWidth}×${v.frameHeight}`:'Live';
      }
    });
    await live.connect();

    obsSender=new TTLiveGuest.LiveGuestConnection({
      role:'guest-obs',room:roomId,token,localStream:stream,remoteVideo:null,
      onState:e=>{$('#obsFeedStatus').textContent=e.state==='connected'?'OBS feed ready':'OBS feed standby'}
    });
    await obsSender.connect();

    await storagePreflight().catch(error=>{
      $('#captureGuard').textContent='STORAGE WARNING';
      $('#captureGuard').className='danger';
      show(error.message,true);
    });
    await resumePendingCapture();
    startHealthWatch();
    setTimeout(sendState,700);
  }catch(error){
    $('#connection').textContent='Media blocked';
    show('Camera and microphone permission are required.',true);
  }
}

TTStudio.subscribe(render);
start();

window.addEventListener('offline',()=>{
  networkWasOffline=true;
  $('#networkSafety').textContent='Offline — local master still safe';
  $('#networkSafety').className='danger';
  sendState();
});
window.addEventListener('online',()=>{
  $('#networkSafety').textContent=networkWasOffline?'Back online ✓':'Online';
  $('#networkSafety').className='safe';
  networkWasOffline=false;sendState();
});
document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState==='visible'&&(!wakeLock||wakeLock.released))await acquireWakeLock();
});

$('#mic').onclick=()=>{
  muted=!muted;if(media.stream)media.stream.getAudioTracks().forEach(t=>t.enabled=!muted);
  $('#mic').classList.toggle('off',muted);$('#mic span').textContent=muted?'Unmute':'Mute';
};
$('#camera').onclick=()=>{
  camOff=!camOff;if(media.stream)media.stream.getVideoTracks().forEach(t=>t.enabled=!camOff);
  $('#camera').classList.toggle('off',camOff);$('#camera span').textContent=camOff?'Camera on':'Camera';
};
$('#leave').onclick=()=>{
  if((videoRecorder&&videoRecorder.state==='recording')||uploadInProgress||finishing){
    show('Recording protection is active. The hosts must end the session safely.',true);return;
  }
  if(!confirm('Leave the guest studio?'))return;
  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'guest-complete');
  if(obsSender)obsSender.close();if(live)live.close();media.destroy();location.href='guest-goodbye.html';
};

window.addEventListener('beforeunload',event=>{
  if((videoRecorder&&videoRecorder.state==='recording')||uploadInProgress||finishing){
    event.preventDefault();
    event.returnValue='';
  }
});

})();