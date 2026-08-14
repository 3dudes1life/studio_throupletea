(function(){
'use strict';
const $=s=>document.querySelector(s);
const toast=$('#toast');let toastTimer,live=null,hostStream=null;

function show(msg,error){toast.textContent=msg;toast.style.background=error?'#ff6266':'white';toast.style.color=error?'white':'#111';toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2000)}
function rank(s){return({invited:0,tech:1,ready:1,waiting:2,admitted:3,recording:4,complete:5,left:5})[s]??0}
function statusLabel(s){return({invited:'Invited',tech:'Tech Check',ready:'Ready',waiting:'Green Room',admitted:'In Studio',recording:'Recording',complete:'Complete',left:'Complete'})[s]||'Not ready'}

function render(state){
  const g=state.guest||{},exists=g.name&&g.name!=='Future Guest',status=exists?(g.status||'invited'):'none';
  $('#name').textContent=exists?g.name:'No guest checked in';$('#avatar').textContent=exists?g.name[0].toUpperCase():'G';$('#guestVideoLabel').textContent=exists?g.name:'Guest';
  $('#role').textContent=[g.title,g.pronouns].filter(Boolean).join(' · ')||'Waiting for a guest.';
  $('#intro').textContent=exists?([g.name,g.title].filter(Boolean).join(' — ')):'—';$('#social').textContent=g.social||'—';$('#promo').textContent=g.promo||'Nothing requested';
  $('#status').className=`status ${status}`;$('#status').innerHTML=`<i></i>${statusLabel(status)}`;
  $('#admit').disabled=!(g.ready||status==='waiting')||g.admitted;$('#return').disabled=!g.admitted;$('#complete').disabled=!exists;
  const r=rank(status);document.querySelectorAll('.journey>div').forEach((n,i)=>{n.classList.toggle('active',exists&&i===r);n.classList.toggle('done',exists&&i<r)});
}

async function populateDevices(){
  if(!navigator.mediaDevices)return;
  try{
    const initial=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
    initial.getTracks().forEach(t=>t.stop());
  }catch{}
  const devices=await navigator.mediaDevices.enumerateDevices();
  fill($('#hostCamera'),devices.filter(d=>d.kind==='videoinput'),'Camera');
  fill($('#hostMic'),devices.filter(d=>d.kind==='audioinput'),'Audio input');
}
function fill(select,devices,label){
  select.innerHTML='<option value="">Default</option>';
  devices.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`${label} ${i+1}`;select.appendChild(o)});
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
    $('#guestPlaceholder').hidden=true;
    show('Guest audio + video connected');
  }else if(event.state==='setup-required'){
    $('#guestPlaceholderTitle').textContent='Signaling Worker not configured';
    $('#guestPlaceholderText').textContent='Deploy the Worker included in the 4.5 ZIP, then paste its URL into live-guest-config.js.';
  }else if(event.state==='waiting'){
    $('#guestPlaceholder').hidden=false;
    $('#guestPlaceholderTitle').textContent='Waiting for guest';
    $('#guestPlaceholderText').textContent='Send the private guest link and have them enter the green room.';
  }
}

async function connect(){
  const state=TTStudio.getState();
  if(!state.liveRoom||!state.liveRoom.roomId||!state.liveRoom.token){show('Create a fresh guest invitation in Guest Hub first.',true);return}
  try{
    const stream=await startHostMedia();
    if(live)live.close();
    live=new TTLiveGuest.LiveGuestConnection({
      role:'host',room:state.liveRoom.roomId,token:state.liveRoom.token,localStream:stream,remoteVideo:$('#guestVideo'),
      onState:stateHandler,
      onStats(stats){
        const v=stats.video;
        $('#incomingQuality').textContent=v&&v.frameWidth?`${v.frameWidth}×${v.frameHeight}`:'Live';
        const pair=stats.candidatePair;
        $('#networkQuality').textContent=pair&&pair.currentRoundTripTime!=null?`${Math.round(pair.currentRoundTripTime*1000)} ms`:'Connected';
      }
    });
    await live.connect();
  }catch(error){show('Could not start host camera/audio. Check browser permissions.',true)}
}

TTStudio.subscribe(render);populateDevices();
$('#connectLive').onclick=connect;
$('#admit').onclick=()=>{TTStudio.update(n=>{n.guest.admitted=true;n.guest.status='admitted'},'admit-guest');if(live)live.sendControl('admitted',true);show('Guest admitted')};
$('#return').onclick=()=>{TTStudio.update(n=>{n.guest.admitted=false;n.guest.status='waiting'},'return-guest');if(live)live.sendControl('admitted',false);show('Guest returned to green room')};
$('#complete').onclick=()=>{TTStudio.update(n=>{n.guest.admitted=false;n.guest.status='complete'},'complete-guest');if(live)live.sendControl('complete',true);show('Guest marked complete')};
addEventListener('beforeunload',()=>{if(live)live.close();if(hostStream)hostStream.getTracks().forEach(t=>t.stop())});
})();