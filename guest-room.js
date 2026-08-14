(function(){
'use strict';
const $=s=>document.querySelector(s);
let muted=false,camOff=false,roomId='',token='',live=null;
const toast=$('#toast');let toastTimer;

function show(msg,error){toast.textContent=msg;toast.style.background=error?'#ff6266':'white';toast.style.color=error?'white':'#111';toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
function params(){const p=new URLSearchParams(location.search);return{room:p.get('room')||'',token:p.get('token')||''}}
function connectionText(state){
  return({connecting:'Connecting',waiting:'Waiting for hosts',connected:'Excellent',reconnecting:'Reconnecting',error:'Connection error','setup-required':'Needs setup'})[state]||state;
}
function setLiveState(event){
  const state=event.state;
  $('#connection').textContent=connectionText(state);
  $('#roomStatus').classList.toggle('connected',state==='connected');
  $('#waiting').classList.toggle('connected',state==='connected');
  if((state==='waiting'||state==='connected')&&live){
    try{live.sendGuestState(guestPayload(TTStudio.getState()))}catch{}
  }
  if(state==='setup-required'){
    $('#headline').textContent='One setup step remains.';
    $('#waitingText').textContent='The live signaling Worker has not been connected yet.';
    $('#hostPlaceholderTitle').textContent='Live connection not configured';
    $('#hostPlaceholderText').textContent='The hosts need to finish the 4.5 signaling setup.';
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
function guestPayload(state){
  const g=state.guest||{};
  return {
    name:g.name||'Guest',
    pronouns:g.pronouns||'',
    title:g.title||'',
    social:g.social||'',
    promo:g.promo||'',
    ready:Boolean(g.ready),
    admitted:Boolean(g.admitted),
    status:g.status||'waiting',
    episode:{
      season:state.episode&&state.episode.season||'',
      number:state.episode&&state.episode.number||'',
      title:state.episode&&state.episode.title||''
    }
  };
}
function render(state){
  const g=state.guest||{};
  $('#guestBadge').textContent=g.name||'You';
  const rec=state.timer&&state.timer.status==='recording';
  if(rec){
    $('#roomStatus').className='rec-pill recording';
    $('#roomStatus').innerHTML='<i></i>Recording';
    $('#headline').textContent='You’re live.';
    $('#waitingText').textContent='The hosts are recording.';
  }
  if(live&&live.ws&&live.ws.readyState===WebSocket.OPEN){
    live.sendGuestState(guestPayload(state));
  }
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
        if(message&&message.type==='control'&&message.action==='end-session'){
          TTStudio.update(n=>{
            n.guest.status='complete';
            n.guest.admitted=false;
          },'host-ended-session');
          try{live.close()}catch{}
          try{media.destroy()}catch{}
          location.href='guest-goodbye.html?ended=host';
        }
        if(message&&message.type==='control'&&message.action==='admitted'){
          TTStudio.update(n=>{
            n.guest.admitted=Boolean(message.value);
            n.guest.status=message.value?'admitted':'waiting';
          },'host-admission-state');
        }
      },
      onStats(stats){
        const video=stats.video;
        if(video&&video.frameWidth&&video.frameHeight)$('#videoQuality').textContent=`${video.frameWidth}×${video.frameHeight}`;
        else $('#videoQuality').textContent='Live';
      }
    });
    await live.connect();
    setTimeout(()=>{try{live.sendGuestState(guestPayload(TTStudio.getState()))}catch{}},700);
  }catch(error){
    $('#connection').textContent='Media blocked';
    show('Camera and microphone permission are required.',true);
  }
}

TTStudio.subscribe(render);
start();

$('#mic').onclick=()=>{muted=!muted;if(media.stream)media.stream.getAudioTracks().forEach(t=>t.enabled=!muted);$('#mic').classList.toggle('off',muted);$('#mic span').textContent=muted?'Unmute':'Mute';if(live)live.sendControl('guest-mic',!muted)};
$('#camera').onclick=()=>{camOff=!camOff;if(media.stream)media.stream.getVideoTracks().forEach(t=>t.enabled=!camOff);$('#camera').classList.toggle('off',camOff);$('#camera span').textContent=camOff?'Camera on':'Camera';if(live)live.sendControl('guest-camera',!camOff)};
$('#leave').onclick=()=>{if(!confirm('Leave the guest studio?'))return;TTStudio.update(n=>{n.guest.status='complete';n.guest.admitted=false},'guest-complete');if(live)live.close();media.destroy();location.href='guest-goodbye.html'};
addEventListener('beforeunload',()=>{if(live)live.close();media.destroy()});
})();