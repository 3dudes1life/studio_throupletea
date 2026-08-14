(function(){
'use strict';
const $=s=>document.querySelector(s);

let muted=false,camOff=false,roomId='',token='';
let live=null,obsSender=null;

let audioRecorder=null,audioChunks=[],audioMime='';
let videoRecorder=null,videoChunks=[],videoMime='';
let captureStartedAt=null;
let uploadInProgress=false;

const toast=$('#toast');let toastTimer;

function show(msg,error){
  toast.textContent=msg;
  toast.style.background=error?'#ff6266':'white';
  toast.style.color=error?'white':'#111';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);
}
function params(){
  const p=new URLSearchParams(location.search);
  return {room:p.get('room')||'',token:p.get('token')||''};
}
function connectionText(state){
  return ({
    connecting:'Connecting',
    waiting:'Waiting for hosts',
    connected:'Excellent',
    reconnecting:'Reconnecting',
    error:'Connection error',
    'setup-required':'Needs setup'
  })[state]||state;
}
function guestPayload(state){
  const g=state.guest||{};
  return {
    name:g.name||'Guest',pronouns:g.pronouns||'',title:g.title||'',
    social:g.social||'',promo:g.promo||'',ready:Boolean(g.ready),
    admitted:Boolean(g.admitted),status:g.status||'waiting',
    episode:{
      season:state.episode&&state.episode.season||'',
      number:state.episode&&state.episode.number||'',
      title:state.episode&&state.episode.title||''
    }
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

  if(g.status==='recording'){
    $('#roomStatus').className='rec-pill recording';
    $('#roomStatus').innerHTML='<i></i>Recording';
    $('#headline').textContent='You’re live.';
    $('#waitingText').textContent='High-quality guest video + audio are recording locally.';
  }
  sendState();
}
function supportedMime(choices){
  if(!window.MediaRecorder)return '';
  return choices.find(type=>MediaRecorder.isTypeSupported(type))||'';
}
function audioExtension(mime){
  if((mime||'').includes('mp4'))return 'm4a';
  if((mime||'').includes('webm'))return 'webm';
  return 'audio';
}
function videoExtension(mime){
  if((mime||'').includes('mp4'))return 'mp4';
  if((mime||'').includes('webm'))return 'webm';
  return 'video';
}
function safeGuestName(){
  const state=TTStudio.getState();
  return (state.guest.name||'guest')
    .replace(/[^a-z0-9_-]+/gi,'-')
    .replace(/^-|-$/g,'')||'guest';
}
async function uploadBlob(blob,fileName){
  const base=(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');
  const url=`${base}/room/${encodeURIComponent(roomId)}/iso?token=${encodeURIComponent(token)}&name=${encodeURIComponent(fileName)}`;
  const response=await fetch(url,{
    method:'PUT',
    headers:{'Content-Type':blob.type||'application/octet-stream'},
    body:blob
  });
  if(!response.ok)throw new Error(`Upload failed (${response.status})`);
  return response.json();
}
function createRecorder(stream,mime,bitsPerSecond,onChunk){
  const options={};
  if(mime)options.mimeType=mime;
  if(bitsPerSecond)options.bitsPerSecond=bitsPerSecond;
  let recorder;
  try{recorder=new MediaRecorder(stream,options)}
  catch{recorder=new MediaRecorder(stream)}
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)onChunk(e.data)};
  return recorder;
}
async function startLocalIsos(){
  if(videoRecorder&&videoRecorder.state==='recording')return;
  if(!media.stream){show('Camera and microphone are not ready.',true);return}
  if(!window.MediaRecorder){show('This browser cannot create local recordings.',true);return}

  const audioTrack=media.stream.getAudioTracks()[0];
  const videoTrack=media.stream.getVideoTracks()[0];
  if(!audioTrack||!videoTrack){show('Both camera and microphone are required for guest ISO capture.',true);return}

  audioMime=supportedMime([
    'audio/mp4;codecs=mp4a.40.2','audio/mp4',
    'audio/webm;codecs=opus','audio/webm'
  ]);
  videoMime=supportedMime([
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]);

  audioChunks=[];videoChunks=[];

  // Clone tracks so the local ISO recorder does not own/stop the live call tracks.
  const audioOnlyStream=new MediaStream([audioTrack.clone()]);
  const avStream=new MediaStream([videoTrack.clone(),audioTrack.clone()]);

  audioRecorder=createRecorder(audioOnlyStream,audioMime,192000,chunk=>audioChunks.push(chunk));
  videoRecorder=createRecorder(avStream,videoMime,8_000_000,chunk=>videoChunks.push(chunk));

  audioRecorder.start(1000);
  videoRecorder.start(1000);
  captureStartedAt=new Date();

  $('#isoStatus').textContent='Audio ISO recording';
  $('#videoIsoStatus').textContent='Video ISO recording';
  $('#isoStatus').classList.add('live');
  $('#videoIsoStatus').classList.add('live');

  TTStudio.update(n=>{n.guest.status='recording'},'guest-local-isos-start');
  sendState();
  if(live)live.sendControl('iso-started',{
    audioMime:audioRecorder.mimeType||audioMime,
    videoMime:videoRecorder.mimeType||videoMime,
    startedAt:captureStartedAt.toISOString()
  });
}
function stopRecorder(recorder,chunks,mime){
  return new Promise((resolve,reject)=>{
    if(!recorder||recorder.state==='inactive'){
      reject(new Error('Recorder was not running'));
      return;
    }
    recorder.onerror=event=>reject(event.error||new Error('Recorder error'));
    recorder.onstop=()=>{
      const type=recorder.mimeType||mime||'application/octet-stream';
      resolve(new Blob(chunks,{type}));
      // Stop only cloned tracks owned by the recorder.
      try{recorder.stream.getTracks().forEach(track=>track.stop())}catch{}
    };
    recorder.stop();
  });
}
async function stopAndUploadIsos(){
  if(uploadInProgress)return;
  uploadInProgress=true;

  $('#isoStatus').textContent='Finishing audio…';
  $('#videoIsoStatus').textContent='Finishing video…';

  try{
    const [audioBlob,videoBlob]=await Promise.all([
      stopRecorder(audioRecorder,audioChunks,audioMime),
      stopRecorder(videoRecorder,videoChunks,videoMime)
    ]);

    const state=TTStudio.getState();
    const stamp=Date.now();
    const baseName=`${safeGuestName()}-S${state.episode.season}-E${state.episode.number}-${stamp}`;

    $('#isoStatus').textContent='Uploading audio…';
    $('#videoIsoStatus').textContent='Uploading video…';

    const [audioResult,videoResult]=await Promise.all([
      uploadBlob(audioBlob,`${baseName}-GUEST-AUDIO.${audioExtension(audioBlob.type)}`),
      uploadBlob(videoBlob,`${baseName}-GUEST-VIDEO.${videoExtension(videoBlob.type)}`)
    ]);

    $('#isoStatus').textContent='Audio safely received ✓';
    $('#videoIsoStatus').textContent='Video safely received ✓';
    $('#isoStatus').classList.remove('live');
    $('#videoIsoStatus').classList.remove('live');

    if(live)live.sendControl('iso-upload-complete',{
      audio:{key:audioResult.key,size:audioBlob.size,mime:audioBlob.type},
      video:{key:videoResult.key,size:videoBlob.size,mime:videoBlob.type}
    });

    audioChunks=[];videoChunks=[];
    uploadInProgress=false;
    return {audioResult,videoResult};
  }catch(error){
    uploadInProgress=false;
    $('#isoStatus').textContent='Audio/video upload needs attention';
    $('#videoIsoStatus').textContent='Keep this page open';
    if(live)live.sendControl('iso-upload-failed',{reason:error.message||String(error)});
    throw error;
  }
}
async function finishFromHost(){
  try{
    await stopAndUploadIsos();
  }catch(error){
    show('Guest ISO upload failed. Keep this page open.',true);
    return;
  }

  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'host-finished-session');

  setTimeout(()=>{
    try{if(obsSender)obsSender.close()}catch{}
    try{if(live)live.close()}catch{}
    try{media.destroy()}catch{}
    location.href='guest-goodbye.html?ended=host';
  },900);
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

    live=new TTLiveGuest.LiveGuestConnection({
      role:'guest',room:roomId,token,localStream:stream,remoteVideo:$('#hostVideo'),
      onState:setLiveState,
      onMessage(message){
        if(!message)return;
        if(message.type==='control'&&message.action==='admitted'){
          TTStudio.update(n=>{
            n.guest.admitted=Boolean(message.value);
            n.guest.status=message.value?'admitted':'waiting';
          },'host-admission-state');
          sendState();
        }
        if(message.type==='control'&&message.action==='start-iso')startLocalIsos();
        if(message.type==='control'&&['finish-session','end-session'].includes(message.action))finishFromHost();
      },
      onStats(stats){
        const video=stats.video;
        if(video&&video.frameWidth&&video.frameHeight){
          $('#videoQuality').textContent=`${video.frameWidth}×${video.frameHeight}`;
        }else{
          $('#videoQuality').textContent='Live';
        }
      }
    });
    await live.connect();

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
  $('#mic').classList.toggle('off',muted);
  $('#mic span').textContent=muted?'Unmute':'Mute';
  if(live)live.sendControl('guest-mic',!muted);
};
$('#camera').onclick=()=>{
  camOff=!camOff;
  if(media.stream)media.stream.getVideoTracks().forEach(t=>t.enabled=!camOff);
  $('#camera').classList.toggle('off',camOff);
  $('#camera span').textContent=camOff?'Camera on':'Camera';
  if(live)live.sendControl('guest-camera',!camOff);
};
$('#leave').onclick=()=>{
  if(!confirm('Leave the guest studio?'))return;
  if(
    (audioRecorder&&audioRecorder.state==='recording') ||
    (videoRecorder&&videoRecorder.state==='recording') ||
    uploadInProgress
  ){
    show('Your high-quality recording is still active. Ask the hosts to end the session.',true);
    return;
  }
  TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'guest-complete');
  if(obsSender)obsSender.close();
  if(live)live.close();
  media.destroy();
  location.href='guest-goodbye.html';
};

addEventListener('beforeunload',()=>{
  if(obsSender)obsSender.close();
  if(live)live.close();
  media.destroy();
});
})();