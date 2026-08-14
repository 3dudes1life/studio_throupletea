(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const toast=$('#toast');let toastTimer;let micMuted=false;let cameraOff=false;
  const media=new TTMediaController({
    video:$('#roomVideo'),meter:null,
    onStatus(status){
      $('#roomPreviewEmpty').hidden=Boolean(status.camera);
      $('#connectionBadge').textContent=status.ready?'Local preview ready':'Camera unavailable';
      if(status.error)showToast(status.error,true);
    }
  });
  function showToast(msg,error){toast.textContent=msg;toast.classList.toggle('error',!!error);toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2400)}
  function render(state){
    $('#guestBadge').textContent=state.guest.name||'Guest';
    const admitted=Boolean(state.guest.admitted);
    const recording=state.timer&&state.timer.status==='running';
    $('#waitingPulse').classList.toggle('admitted',admitted);
    $('#roomStatus').textContent=recording?'Recording':admitted?'Guest studio':'Green room';
    $('#waitingText').textContent=recording?'Recording is live.':admitted?'The hosts are ready for you.':'Waiting for the hosts to bring you in.';
    $('#roomHeadline').textContent=recording?'You’re on.':admitted?'You’re joining the conversation.':'You’re in.';
    $('#roomDetail').textContent=recording?'Stay on headphones and enjoy the conversation.':admitted?'Keep this tab open. The private host video/audio transport will appear here once enabled.':'Relax, keep your headphones on, and leave this tab open. We’ll let you know when the room is ready.';
  }
  async function start(){
    try{await media.start()}catch(e){showToast('Camera or microphone permission is required for the guest room.',true)}
  }
  TTStudio.subscribe(render);start();

  $('#toggleMic').onclick=()=>{
    micMuted=!micMuted;
    if(media.stream)media.stream.getAudioTracks().forEach(track=>track.enabled=!micMuted);
    $('#toggleMic').classList.toggle('off',micMuted);$('#toggleMic span').textContent=micMuted?'Unmute':'Mute';
    showToast(micMuted?'Microphone muted':'Microphone live');
  };
  $('#toggleCamera').onclick=()=>{
    cameraOff=!cameraOff;
    if(media.stream)media.stream.getVideoTracks().forEach(track=>track.enabled=!cameraOff);
    $('#toggleCamera').classList.toggle('off',cameraOff);$('#toggleCamera span').textContent=cameraOff?'Camera on':'Camera';
    showToast(cameraOff?'Camera off':'Camera on');
  };
  $('#leaveRoom').onclick=()=>{
    if(!confirm('Leave the guest studio?'))return;
    TTStudio.update(next=>{next.guest.status='left';next.guest.admitted=false;TTStudio.addActivity(next,`${next.guest.name} left the guest studio`)},'guest-left');
    media.destroy();location.href='guest-goodbye.html';
  };
  window.addEventListener('beforeunload',()=>media.destroy());
})();