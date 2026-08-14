(function(){
  'use strict';
  const $=(s)=>document.querySelector(s);
  let stage='tech';
  let mediaReady=false;
  let speakerReady=false;
  let toastTimer;
  let audioContext=null;
  let speakerAudio=null;

  if(window.location.search) TTStudio.applyUrlParams();

  const toast=$('#toast');
  const media=new TTMediaController({
    video:$('#previewVideo'),
    meter:$('#audioMeter'),
    cameraSelect:$('#cameraSelect'),
    micSelect:$('#micSelect'),
    onStatus(status){
      mediaReady=Boolean(status.ready&&status.camera&&status.microphone);
      $('#previewEmpty').hidden=Boolean(status.camera);
      setReady('#cameraStatus',status.camera?'Ready':'Unavailable',Boolean(status.camera));
      setReady('#micStatus',status.microphone?'Ready':'Unavailable',Boolean(status.microphone));
      if(status.error){
        $('#mediaNotice').hidden=false;
        $('#mediaNotice').textContent=status.error;
      }else $('#mediaNotice').hidden=true;
      populateOutputs();
      updateTechContinue();
    }
  });

  function esc(v){return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function showToast(msg,error){
    toast.textContent=msg;toast.classList.toggle('error',Boolean(error));toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);
  }
  function setReady(selector,text,good){
    const node=$(selector);node.textContent=text;node.classList.toggle('good',Boolean(good));
  }
  function browserCheck(){
    const good=Boolean(window.isSecureContext&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
    setReady('#browserStatus',good?'Ready':'Needs HTTPS',good);
  }
  function networkCheck(){
    const online=navigator.onLine;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    let label=online?'Online':'Offline';
    if(online&&connection&&connection.effectiveType) label=connection.effectiveType.toUpperCase();
    setReady('#networkStatus',label,online);
  }
  function showStage(next){
    stage=next;
    document.querySelectorAll('.guest-stage').forEach(node=>node.classList.toggle('active',node.id===`stage-${next}`));
    const order=['tech','intro','prep','done'];
    document.querySelectorAll('.guest-progress button').forEach(button=>{
      const index=order.indexOf(button.dataset.stage), current=order.indexOf(next);
      button.classList.toggle('active',index===current);
      button.classList.toggle('done',index<current);
      const i=button.querySelector('i'); if(i) i.textContent=index<current?'✓':String(index+1);
    });
    window.scrollTo({top:Math.max(0,$('.guest-progress').offsetTop-16),behavior:'smooth'});
  }
  function render(state){
    $('#welcomeTitle').innerHTML=`Welcome, ${esc(state.guest.name&&state.guest.name!=='Future Guest'?state.guest.name:'friend')}.<span>We’ll handle the tech.</span>`;
    $('#episodeTitle').textContent=`S${state.episode.season} Ep${state.episode.number} · ${state.episode.title}`;
    const date=state.episode.recordingDate?new Date(`${state.episode.recordingDate}T${state.episode.recordingTime||'12:00'}`):null;
    $('#episodeMeta').textContent=date&&!Number.isNaN(date.getTime())?date.toLocaleString([],{dateStyle:'full',timeStyle:'short'}):'Recording time confirmed by the hosts';
    $('#episodeTopic').textContent=state.episode.mainTopic||'';
    setIfIdle('#guestName',state.guest.name==='Future Guest'?'':state.guest.name||'');
    setIfIdle('#pronouns',state.guest.pronouns||'');
    setIfIdle('#guestTitle',state.guest.title||'');
    setIfIdle('#social',state.guest.social||'');
    setIfIdle('#promo',state.guest.promo||'');
    if($('#releaseAccepted')!==document.activeElement) $('#releaseAccepted').checked=Boolean(state.guest.releaseAccepted);
    updateIntroPreview();
    updatePrepContinue();
  }
  function setIfIdle(selector,value){const node=$(selector);if(node!==document.activeElement)node.value=value}
  function updateIntroPreview(){
    const name=$('#guestName').value.trim()||'Guest';
    const title=$('#guestTitle').value.trim();
    const social=$('#social').value.trim();
    $('#introPreviewName').textContent=name;
    $('#introPreviewMeta').textContent=[title,social].filter(Boolean).join(' · ')||'Add your title and social.';
    $('#introPreviewPromo').textContent=$('#promo').value.trim();
  }
  function allPrepChecked(){return [...document.querySelectorAll('.prep-check')].every(c=>c.checked)}
  function updatePrepContinue(){
    const ready=allPrepChecked()&&$('#releaseAccepted').checked;
    $('#prepContinue').disabled=!ready;
  }
  function updateTechContinue(){
    $('#techContinue').disabled=!(mediaReady&&speakerReady);
    const ready=mediaReady&&speakerReady;
    $('#readyPill').classList.toggle('ready',ready&&stage!=='tech');
    $('#readyPill').querySelector('span').textContent=ready?'Tech check complete':'Check-in in progress';
  }
  async function populateOutputs(){
    const select=$('#speakerSelect');
    if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return;
    const devices=await navigator.mediaDevices.enumerateDevices();
    const outputs=devices.filter(d=>d.kind==='audiooutput');
    const current=select.value;
    select.innerHTML='<option value="">Default output</option>';
    outputs.forEach((device,index)=>{
      const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||`Audio output ${index+1}`;select.appendChild(option);
    });
    if([...select.options].some(o=>o.value===current))select.value=current;
  }
  async function playSpeakerTest(){
    try{
      if(!audioContext) audioContext=new (window.AudioContext||window.webkitAudioContext)();
      const destination=audioContext.createMediaStreamDestination();
      const oscillator=audioContext.createOscillator();
      const gain=audioContext.createGain();
      oscillator.frequency.value=660;gain.gain.value=.08;oscillator.connect(gain).connect(destination);
      if(!speakerAudio){speakerAudio=document.createElement('audio');speakerAudio.autoplay=true;document.body.appendChild(speakerAudio)}
      speakerAudio.srcObject=destination.stream;
      if(typeof speakerAudio.setSinkId==='function'&&$('#speakerSelect').value) await speakerAudio.setSinkId($('#speakerSelect').value);
      oscillator.start();oscillator.stop(audioContext.currentTime+.45);
      speakerReady=true;updateTechContinue();showToast('If you heard the tone, your headphones are ready.');
    }catch(error){speakerReady=true;updateTechContinue();showToast('Audio output will use your browser default.',false)}
  }
  function saveGuestDetails(){
    TTStudio.update(next=>{
      next.guest.name=$('#guestName').value.trim()||'Guest';
      next.guest.pronouns=$('#pronouns').value.trim();
      next.guest.title=$('#guestTitle').value.trim();
      next.guest.social=$('#social').value.trim();
      next.guest.promo=$('#promo').value.trim();
      next.guest.checkInStage=stage;
      next.lowerThird.name=next.guest.name;
      next.lowerThird.title=next.guest.title;
      next.lowerThird.social=next.guest.social;
      TTStudio.addActivity(next,`${next.guest.name} updated guest introduction`);
    },'guest-details');
  }

  browserCheck();networkCheck();
  window.addEventListener('online',networkCheck);window.addEventListener('offline',networkCheck);
  TTStudio.subscribe(render);

  $('#testDevices').onclick=async()=>{
    try{await media.start();await populateOutputs();showToast('Camera and microphone are live. Say a few words and watch the meter.')}
    catch(error){showToast('We could not access your camera or microphone. Check browser permissions and try again.',true)}
  };
  $('#testSpeaker').onclick=playSpeakerTest;
  $('#speakerSelect').onchange=()=>{speakerReady=false;updateTechContinue()};
  $('#techContinue').onclick=()=>showStage('intro');
  $('#introBack').onclick=()=>showStage('tech');
  ['#guestName','#pronouns','#guestTitle','#social','#promo'].forEach(selector=>$(selector).addEventListener('input',updateIntroPreview));
  $('#introContinue').onclick=()=>{saveGuestDetails();showStage('prep')};
  $('#prepBack').onclick=()=>showStage('intro');
  document.querySelectorAll('.prep-check').forEach(c=>c.onchange=updatePrepContinue);
  $('#releaseAccepted').onchange=()=>{
    TTStudio.update(next=>{next.guest.releaseAccepted=$('#releaseAccepted').checked},'guest-release');
    updatePrepContinue();
  };
  $('#prepContinue').onclick=()=>{
    saveGuestDetails();
    TTStudio.update(next=>{
      next.guest.releaseAccepted=true;
      next.guest.ready=true;
      next.guest.status='ready';
      next.guest.checkInCompletedAt=new Date().toISOString();
      TTStudio.addActivity(next,`${next.guest.name} completed guest check-in`);
    },'guest-ready');
    showStage('done');
    $('#readyPill').classList.add('ready');
    $('#readyPill').querySelector('span').textContent='Ready for green room';
  };
  $('#enterStudio').onclick=async()=>{
    TTStudio.update(next=>{
      next.guest.status='waiting';
      next.guest.ready=true;
      next.guest.waitingSince=new Date().toISOString();
      next.guest.admitted=false;
      TTStudio.addActivity(next,`${next.guest.name} entered the green room`);
    },'guest-waiting');
    await media.stop();
    location.href='guest-room.html';
  };
  document.querySelectorAll('.guest-progress button').forEach(button=>button.onclick=()=>{
    const order=['tech','intro','prep','done'];
    if(order.indexOf(button.dataset.stage)<=order.indexOf(stage))showStage(button.dataset.stage);
  });
  window.addEventListener('beforeunload',()=>media.destroy());
})();