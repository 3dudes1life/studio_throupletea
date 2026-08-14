(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const toast=$('#toast');let toastTimer;let guestUrl='';

  function showToast(msg){
    toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
  }
  function esc(v){return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function buildHostUrl(state){
    const url=new URL('host.html',location.href);
    if(state.liveRoom&&state.liveRoom.roomId)url.searchParams.set('room',state.liveRoom.roomId);
    if(state.liveRoom&&state.liveRoom.token)url.searchParams.set('token',state.liveRoom.token);
    return url.href;
  }
  function buildGuestUrl(state){
    const url=new URL('guest.html',location.href);
    const params={
      guest:state.guest.name||'',
      pronouns:state.guest.pronouns||'',
      title:state.guest.title||'',
      social:state.guest.social||'',
      promo:state.guest.promo||'',
      season:state.episode.season||'',
      episode:state.episode.number||'',
      episodeTitle:state.episode.title||'',
      room:state.liveRoom&&state.liveRoom.roomId||'',
      token:state.liveRoom&&state.liveRoom.token||''
    };
    Object.entries(params).forEach(([key,value])=>{if(value)url.searchParams.set(key,value)});
    return url.href;
  }
  function statusLabel(status){
    return ({
      invited:'Invited',tech:'Tech Check',ready:'Ready',waiting:'Green Room',
      admitted:'In Studio',recording:'Recording',complete:'Complete',left:'Complete'
    })[status]||'Invited';
  }
  function journeyRank(status){
    return ({invited:0,tech:1,ready:1,waiting:2,admitted:3,recording:4,complete:5,left:5})[status]??0;
  }
  function render(state){
    const guest=state.guest||{};
    const exists=guest.name&&guest.name!=='Future Guest';
    const status=exists?(guest.status||'invited'):'none';
    $('#guestName').textContent=exists?guest.name:'No guest yet';
    $('#guestAvatar').textContent=exists?(guest.name.trim()[0]||'G').toUpperCase():'G';
    $('#guestRole').textContent=exists?([guest.title,guest.pronouns].filter(Boolean).join(' · ')||'Guest'):'Create a private guest link when you are ready.';
    $('#guestSocial').textContent=guest.social||'No social added';
    $('#episodeLabel').textContent=`Episode ${state.episode.number||'—'}`;
    const pill=$('#guestStatus');pill.className=`status ${status}`;pill.innerHTML=`<i></i>${exists?statusLabel(status):'Not invited'}`;
    guestUrl=exists?buildGuestUrl(state):'';
    $('#guestLinkHint').textContent=exists?'Copy private check-in link':'Create the guest first';
    $('#copyGuestLink').disabled=!exists;const hostUrl=buildHostUrl(state);if($('#sidebarGuestControl'))$('#sidebarGuestControl').href=hostUrl;if($('#quickGuestControl'))$('#quickGuestControl').href=hostUrl;

    const rank=journeyRank(status);
    document.querySelectorAll('.journey-step').forEach((step,index)=>{
      step.classList.toggle('active',exists&&index===rank);
      step.classList.toggle('done',exists&&index<rank);
    });

    $('#inviteName').value=exists?guest.name:'';
    $('#invitePronouns').value=guest.pronouns||'';
    $('#inviteTitle').value=guest.title||'';
    $('#inviteSocial').value=guest.social||'';
    $('#invitePromo').value=guest.promo||'';
    $('#inviteSeason').value=state.episode.season||'';
    $('#inviteEpisode').value=state.episode.number||'';
    $('#inviteEpisodeTitle').value=state.episode.title||'';
  }

  TTStudio.subscribe(render);

  const dialog=$('#inviteDialog');
  function openInvite(){dialog.showModal();setTimeout(()=>$('#inviteName').focus(),50)}
  $('#inviteGuest').onclick=openInvite;$('#quickInvite').onclick=openInvite;
  $('#saveInvite').onclick=(event)=>{
    event.preventDefault();
    const name=$('#inviteName').value.trim();
    if(!name){showToast('Add the guest name first');return}
    TTStudio.update(next=>{
      next.guest.name=name;
      next.guest.pronouns=$('#invitePronouns').value.trim();
      next.guest.title=$('#inviteTitle').value.trim();
      next.guest.social=$('#inviteSocial').value.trim();
      next.guest.promo=$('#invitePromo').value.trim();
      next.guest.ready=false;next.guest.admitted=false;next.guest.status='invited';
      next.liveRoom=next.liveRoom||{};
      next.liveRoom.roomId=TTLiveGuest.randomToken(8);
      next.liveRoom.token=TTLiveGuest.randomToken(18);
      next.liveRoom.createdAt=new Date().toISOString();
      next.liveRoom.signalingReady=Boolean(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl);
      next.episode.season=$('#inviteSeason').value.trim()||next.episode.season;
      next.episode.number=$('#inviteEpisode').value.trim()||next.episode.number;
      next.episode.title=$('#inviteEpisodeTitle').value.trim()||next.episode.title;
      TTStudio.addActivity(next,`${name} invited as podcast guest`);
    },'guest-invite');
    dialog.close();
    setTimeout(async()=>{const state=TTStudio.getState();guestUrl=buildGuestUrl(state);await navigator.clipboard.writeText(guestUrl).catch(()=>{});showToast('Guest link created and copied')},100);
  };
  $('#copyGuestLink').onclick=async()=>{if(!guestUrl)return;await navigator.clipboard.writeText(guestUrl);showToast('Guest link copied')};
  $('#openGuestLounge').onclick=()=>window.open(guestUrl||'guest.html','_blank','noopener');
  $('#copyGuide').onclick=async()=>{
    const text='For the best Throuple Tea guest experience: use Chrome or Safari, wear headphones, place your camera near eye level, face a soft light or window, silence notifications, and join from the private guest link a few minutes early.';
    await navigator.clipboard.writeText(text);showToast('Guest guide copied');
  };
})();