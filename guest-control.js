(function(){
'use strict';
const $=s=>document.querySelector(s);
const toast=$('#toast');let toastTimer,live=null,hostStream=null,remoteGuest=null;
let audioIsoKey='',videoIsoKey='',finishingTimer=null;

function show(msg,error){toast.textContent=msg;toast.style.background=error?'#ff6266':'white';toast.style.color=error?'white':'#111';toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
function rank(s){return({invited:0,tech:1,ready:1,waiting:2,admitted:3,recording:4,complete:5,left:5})[s]??0}
function statusLabel(s){return({invited:'Invited',tech:'Tech Check',ready:'Ready',waiting:'Green Room',admitted:'In Studio',recording:'Recording',complete:'Complete',left:'Complete'})[s]||'Not ready'}
function connectionCredentials(){const q=new URLSearchParams(location.search),s=TTStudio.getState();return{room:q.get('room')||(s.liveRoom&&s.liveRoom.roomId)||'',token:q.get('token')||(s.liveRoom&&s.liveRoom.token)||''}}
function obsFeedUrl(){const c=connectionCredentials(),u=new URL('guest-obs.html',location.href);if(c.room)u.searchParams.set('room',c.room);if(c.token)u.searchParams.set('token',c.token);return u.href}
function isoDownloadUrl(key){const c=connectionCredentials(),base=(window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');return `${base}/room/${encodeURIComponent(c.room)}/iso-file?token=${encodeURIComponent(c.token)}&key=${encodeURIComponent(key)}`}
function render(state){
  const g=remoteGuest||(state.guest||{}),exists=g.name&&g.name!=='Future Guest',status=exists?(g.status||'invited'):'none';
  $('#name').textContent=exists?g.name:'No guest checked in';$('#avatar').textContent=exists?g.name[0].toUpperCase():'G';$('#guestVideoLabel').textContent=exists?g.name:'Guest';
  $('#role').textContent=[g.title,g.pronouns].filter(Boolean).join(' · ')||'Waiting for a guest.';
  $('#intro').textContent=exists?([g.name,g.title].filter(Boolean).join(' — ')):'—';$('#social').textContent=g.social||'—';$('#promo').textContent=g.promo||'Nothing requested';
  $('#status').className=`status ${status}`;$('#status').innerHTML=`<i></i>${statusLabel(status)}`;
  $('#admit').disabled=!(g.ready||['waiting','admitted','recording'].includes(status))||g.admitted;
  $('#return').disabled=!g.admitted;$('#complete').disabled=!exists;
  $('#startCapture').disabled=!(live&&live.pc&&live.pc.connectionState==='connected')||status==='recording';
  $('#finishCapture').disabled=status!=='recording';
  const r=rank(status);document.querySelectorAll('.journey>div').forEach((n,i)=>{n.classList.toggle('active',exists&&i===r);n.classList.toggle('done',exists&&i<r)});
}
async function populateDevices(){
  if(!navigator.mediaDevices)return;
  try{const initial=await navigator.mediaDevices.getUserMedia({audio:true,video:true});initial.getTracks().forEach(t=>t.stop())}catch{}
  const devices=await navigator.mediaDevices.enumerateDevices();
  fill($('#hostCamera'),devices.filter(d=>d.kind==='videoinput'),'Camera');
  fill($('#hostMic'),devices.filter(d=>d.kind==='audioinput'),'Audio input');
  fill($('#guestOutput'),devices.filter(d=>d.kind==='audiooutput'),'Audio output');
}
function fill(select,devices,label){select.innerHTML='<option value="">System default</option>';devices.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`${label} ${i+1}`;select.appendChild(o)})}
async function applyGuestOutput(){
  const device=$('#guestOutput').value;
  if(typeof $('#guestVideo').setSinkId==='function'){
    try{await $('#guestVideo').setSinkId(device||'default');show('Guest audio output updated')}catch{show('Browser could not switch audio output. Use macOS Sound Output instead.',true)}
  }else if(device){show('This browser cannot switch output directly. Set the PodTrak as macOS Sound Output.',true)}
}
async function startHostMedia(){
  const camera=$('#hostCamera').value,mic=$('#hostMic').value;
  if(hostStream)hostStream.getTracks().forEach(t=>t.stop());
  hostStream=await navigator.mediaDevices.getUserMedia({
    video:camera?{deviceId:{exact:camera},width:{ideal:1280},height:{ideal:720}}:{width:{ideal:1280},height:{ideal:720}},
    audio:mic?{deviceId:{exact:mic},echoCancellation:true,noiseSuppression:true,autoGainControl:true}:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
  });
  return hostStream;
}
function stateHandler(event){
  $('#connectionState').textContent=({connecting:'Connecting',waiting:'Waiting',connected:'Live',reconnecting:'Reconnecting','setup-required':'Setup required',error:'Error'})[event.state]||event.state;
  if(event.state==='connected'){
    $('#guestPlaceholder').hidden=true;$('#startCapture').disabled=false;applyGuestOutput();show('Guest audio + video connected');
  }else if(event.state==='setup-required'){
    $('#guestPlaceholderTitle').textContent='Signaling Worker not configured';
    $('#guestPlaceholderText').textContent='Finish the Cloudflare setup first.';
  }else if(event.state==='waiting'){
    $('#guestPlaceholder').hidden=false;$('#guestPlaceholderTitle').textContent='Waiting for guest';$('#guestPlaceholderText').textContent='Have the guest enter the Green Room.';
  }
  render(TTStudio.getState());
}
function finalizeSession(message){
  clearTimeout(finishingTimer);
  TTStudio.update(n=>{n.guest.admitted=false;n.guest.status='complete'},'complete-guest');
  if(remoteGuest){remoteGuest.admitted=false;remoteGuest.status='complete'}
  if(live){setTimeout(()=>live.close(),250)}
  if(hostStream){hostStream.getTracks().forEach(t=>t.stop());hostStream=null}
  $('#guestVideo').srcObject=null;$('#guestPlaceholder').hidden=false;
  $('#guestPlaceholderTitle').textContent='Session ended';$('#guestPlaceholderText').textContent='Guest disconnected. ISO is safe.';
  $('#connectionState').textContent='Ended';
  $('#captureStatus').textContent=message||'Session complete';
  $('.capture-state').classList.remove('recording');$('.capture-state').classList.add('safe');
  render(TTStudio.getState());
}
function handlePeerMessage(message){
  if(!message)return;
  if(message.type==='guest-state'&&message.guest){
    remoteGuest=message.guest;
    const health=remoteGuest.captureHealth||{};
    if($('#guestCaptureGuard')){
      $('#guestCaptureGuard').textContent=health.recording?'Recording protected':(remoteGuest.status==='recording'?'Checking':'Armed');
      $('#guestLocalWrites').textContent=health.pendingWrites!=null?`${health.pendingWrites} pending`:'—';
    }
    render(TTStudio.getState());
    $('#guestPlaceholderTitle').textContent=remoteGuest.status==='waiting'?'Guest is in the Green Room':'Guest connected';
    $('#guestPlaceholderText').textContent=`${remoteGuest.name||'Guest'} is connected to this private room.`;
  }
  if(message.type==='control'&&message.action==='capture-warning'){
    $('#guestCaptureGuard').textContent='WARNING';
    $('#captureStatus').textContent=`Guest capture warning: ${(message.value&&message.value.reason)||'Check guest device'}`;
    show('Guest capture safeguard reported a warning. Keep recording, but check the guest device.',true);
  }
  if(message.type==='control'&&message.action==='capture-recovery-found'){
    $('#guestCaptureGuard').textContent='Recovery copy found';
    $('#retryUpload').hidden=false;
    show('Guest device found a protected recovery copy from this room.',false);
  }
  if(message.type==='control'&&message.action==='iso-start-failed'){
    $('#captureStatus').textContent='Guest local master did NOT start';
    $('#isoHostStatus').textContent='Start failed';
    $('#startCapture').disabled=false;
    show(`Guest local recording failed to start: ${(message.value&&message.value.reason)||'unknown error'}`,true);
  }
  if(message.type==='control'&&message.action==='iso-upload-progress'){
    $('#audioIsoHostStatus').textContent='Safely uploaded ✓';
    $('#audioIsoHostStatus').classList.add('safe');
    $('#captureStatus').textContent='Audio safe — guest video still uploading';
  }
  if(message.type==='control'&&message.action==='iso-started'){
    $('#isoHostStatus').textContent='Recording locally';
    $('#audioIsoHostStatus').textContent='Recording';
    $('#videoIsoHostStatus').textContent='Recording';
    $('#captureStatus').textContent='Guest audio + video ISOs recording — OBS + PodTrak stay manual';
    $('.capture-state').addClass('recording');
  }
  if(message.type==='control'&&message.action==='iso-upload-complete'){
    const payload=message.value||{};
    audioIsoKey=payload.audio&&payload.audio.key||'';
    videoIsoKey=payload.video&&payload.video.key||'';

    $('#isoHostStatus').textContent='Both safely uploaded ✓';
    $('#audioIsoHostStatus').textContent=audioIsoKey?'Safely uploaded ✓':'Missing';
    $('#videoIsoHostStatus').textContent=videoIsoKey?'Safely uploaded ✓':'Missing';
    $('#audioIsoHostStatus').classList.toggle('safe',Boolean(audioIsoKey));
    $('#videoIsoHostStatus').classList.toggle('safe',Boolean(videoIsoKey));

    if(audioIsoKey){
      $('#downloadAudioIso').href=isoDownloadUrl(audioIsoKey);
      $('#downloadAudioIso').hidden=false;
    }
    if(videoIsoKey){
      $('#downloadVideoIso').href=isoDownloadUrl(videoIsoKey);
      $('#downloadVideoIso').hidden=false;
    }

    if(audioIsoKey&&videoIsoKey){
      finalizeSession('Guest audio + video safely received — safe to stop OBS/P4');
    }else{
      $('#captureStatus').textContent='One guest master is missing — do not clear guest';
      show('Audio/video ISO set is incomplete. Do not clear the guest.',true);
    }
  }
  if(message.type==='control'&&message.action==='iso-upload-failed'){
    clearTimeout(finishingTimer);
    $('#isoHostStatus').textContent='Upload failed — recovery copy retained';
    $('#audioIsoHostStatus').textContent='Check upload';
    $('#videoIsoHostStatus').textContent='Check upload';
    $('#captureStatus').textContent='Guest audio/video upload needs attention — local recovery copy remains';
    $('#retryUpload').hidden=false;
    show('Guest upload failed, but the protected local recovery copy was retained. Do not clear the guest.',true);
  }
}
async function connect(){
  const creds=connectionCredentials();
  if(!creds.room||!creds.token){show('Open Guest Control from Guest Hub for this invitation.',true);return}
  try{
    const stream=await startHostMedia();
    if(live)live.close();
    live=new TTLiveGuest.LiveGuestConnection({
      role:'host',room:creds.room,token:creds.token,localStream:stream,remoteVideo:$('#guestVideo'),
      onState:stateHandler,onMessage:handlePeerMessage,
      onStats(stats){
        const v=stats.video;$('#incomingQuality').textContent=v&&v.frameWidth?`${v.frameWidth}×${v.frameHeight}`:'Live';
        const pair=stats.candidatePair;$('#networkQuality').textContent=pair&&pair.currentRoundTripTime!=null?`${Math.round(pair.currentRoundTripTime*1000)} ms`:'Connected';
      }
    });
    await live.connect();
  }catch(error){show('Could not start host camera/audio. Check browser permissions.',true)}
}

TTStudio.subscribe(render);populateDevices();
$('#guestOutput').onchange=applyGuestOutput;
$('#connectLive').onclick=connect;
$('#obsFeedButton').onclick=async()=>{await navigator.clipboard.writeText(obsFeedUrl());show('Clean OBS Guest Feed URL copied')};
$('#startCapture').onclick=()=>{
  if(!live){show('Connect the guest first.',true);return}
  TTStudio.update(n=>{n.guest.status='recording'},'start-guest-iso');
  if(remoteGuest)remoteGuest.status='recording';
  live.sendControl('start-iso',true);
  $('#captureStatus').textContent='Starting guest audio + video ISOs — start OBS + PodTrak now';
  $('#isoHostStatus').textContent='Starting…';
  $('#audioIsoHostStatus').textContent='Starting…';
  $('#videoIsoHostStatus').textContent='Starting…';
  $('.capture-state').addClass('recording');
  render(TTStudio.getState());
};
$('#finishCapture').onclick=()=>{
  if(!confirm('End the interview and upload BOTH guest audio + video masters? Keep OBS/PodTrak running until both confirm safe.'))return;
  $('#finishCapture').disabled=true;
  $('#captureStatus').textContent='Finishing + uploading guest audio/video…';
  $('#isoHostStatus').textContent='Waiting for both uploads…';
  $('#audioIsoHostStatus').textContent='Uploading…';
  $('#videoIsoHostStatus').textContent='Uploading…';
  live.sendControl('finish-session',true);
  finishingTimer=setTimeout(()=>{show('Still waiting for guest audio/video uploads. Keep the session open.',true);$('#captureStatus').textContent='Still uploading — do not clear guest';},30000);
};
$('#admit').onclick=()=>{TTStudio.update(n=>{n.guest.admitted=true;n.guest.status='admitted'},'admit-guest');if(remoteGuest){remoteGuest.admitted=true;remoteGuest.status='admitted'}if(live)live.sendControl('admitted',true);show('Guest admitted');render(TTStudio.getState())};
$('#return').onclick=()=>{TTStudio.update(n=>{n.guest.admitted=false;n.guest.status='waiting'},'return-guest');if(remoteGuest){remoteGuest.admitted=false;remoteGuest.status='waiting'}if(live)live.sendControl('admitted',false);show('Guest returned to Green Room');render(TTStudio.getState())};
$('#complete').onclick=()=>{show('Use End + Upload ISO so the guest recording is safely received.',true)};
$('#retryUpload').onclick=()=>{
  if(!live){show('Reconnect the guest first.',true);return}
  $('#retryUpload').hidden=true;
  $('#captureStatus').textContent='Retrying protected guest upload…';
  live.sendControl('retry-upload',true);
};
addEventListener('beforeunload',()=>{if(live)live.close();if(hostStream)hostStream.getTracks().forEach(t=>t.stop())});
})();