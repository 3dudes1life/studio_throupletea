(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const toast=$('#toast');
  let toastTimer;
  let lastInviteUrl='';

  function showToast(message){
    toast.textContent=message;toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
  }
  function safe(value){return String(value||'').trim()}
  function setValue(id,value){
    const node=$(id);if(node&&document.activeElement!==node)node.value=value||'';
  }
  function guestProgress(guest){
    if(guest.status==='admitted')return 100;
    if(guest.status==='waiting')return 85;
    if(guest.ready)return 70;
    if(guest.name&&guest.name!=='Future Guest')return 30;
    return 0;
  }
  function guestStatusLabel(guest){
    if(guest.status==='admitted')return 'In studio';
    if(guest.status==='waiting')return 'Waiting in green room';
    if(guest.ready)return 'Check-in complete';
    if(guest.name&&guest.name!=='Future Guest')return 'Invitation ready';
    return 'No guest yet';
  }
  function render(state){
    const guest=state.guest||{};
    setValue('#guestName',guest.name==='Future Guest'?'':guest.name);
    setValue('#guestPronouns',guest.pronouns);
    setValue('#guestTitle',guest.title);
    setValue('#guestSocial',guest.social);
    setValue('#guestPromo',guest.promo);
    setValue('#season',state.episode.season);
    setValue('#episodeNumber',state.episode.number);
    setValue('#episodeTitle',state.episode.title);
    setValue('#episodeTopic',state.episode.mainTopic);
    updatePreview();

    const hasGuest=guest.name&&guest.name!=='Future Guest';
    $('#currentGuestName').textContent=hasGuest?guest.name:'No guest yet';
    $('#currentGuestStatus').textContent=hasGuest?guestStatusLabel(guest):'Create an invitation to begin.';
    $('#statusTrack').style.width=`${guestProgress(guest)}%`;
    $('#sideGuestName').textContent=hasGuest?guest.name:'Waiting for guest';
    $('#sideGuestMeta').textContent=hasGuest?[guest.title,guest.social].filter(Boolean).join(' · ')||'Guest details saved':'No invitation created yet.';
    $('#guestInitial').textContent=hasGuest?guest.name.charAt(0).toUpperCase():'?';

    const chip=$('#guestChip');
    chip.classList.toggle('ready',Boolean(guest.ready||guest.status==='waiting'||guest.status==='admitted'));
    chip.innerHTML=`<i></i>${hasGuest?guestStatusLabel(guest):'Not invited'}`;
    status('#inviteStatus',hasGuest?'Created':'Not created',hasGuest);
    status('#techStatus',guest.ready?'Complete':'Waiting',Boolean(guest.ready));
    status('#introStatus',guest.ready?'Saved':hasGuest?'Pre-filled':'Waiting',Boolean(guest.ready));
    status('#greenStatus',guest.status==='waiting'?'Waiting':guest.status==='admitted'?'Admitted':'Waiting',guest.status==='waiting'||guest.status==='admitted');
    $('#saveState').innerHTML='<i></i>Saved locally';
  }
  function status(selector,label,good){
    const node=$(selector);node.textContent=label;node.classList.toggle('good',Boolean(good));
  }
  function updatePreview(){
    const name=safe($('#guestName').value);
    const title=safe($('#guestTitle').value);
    const social=safe($('#guestSocial').value);
    $('#invitePreviewName').textContent=name||'Private Guest Lounge';
    $('#invitePreviewMeta').textContent=[title,social].filter(Boolean).join(' · ')||'Add the guest details above.';
  }
  function persistDraft(){
    TTStudio.update(next=>{
      next.guest.name=safe($('#guestName').value)||'Future Guest';
      next.guest.pronouns=safe($('#guestPronouns').value);
      next.guest.title=safe($('#guestTitle').value);
      next.guest.social=safe($('#guestSocial').value);
      next.guest.promo=safe($('#guestPromo').value);
      next.episode.season=safe($('#season').value)||next.episode.season;
      next.episode.number=safe($('#episodeNumber').value)||next.episode.number;
      next.episode.title=safe($('#episodeTitle').value)||next.episode.title;
      next.episode.mainTopic=safe($('#episodeTopic').value)||next.episode.mainTopic;
      if(next.guest.name!=='Future Guest'&&!next.guest.status)next.guest.status='invited';
    },'guest-desk-draft');
  }
  function buildGuestUrl(){
    const params=new URLSearchParams();
    const entries={
      guest:safe($('#guestName').value),
      pronouns:safe($('#guestPronouns').value),
      title:safe($('#guestTitle').value),
      social:safe($('#guestSocial').value),
      promo:safe($('#guestPromo').value),
      season:safe($('#season').value),
      episode:safe($('#episodeNumber').value),
      episodeTitle:safe($('#episodeTitle').value),
      topic:safe($('#episodeTopic').value)
    };
    Object.entries(entries).forEach(([key,value])=>{if(value)params.set(key,value)});
    const base=new URL('guest.html',window.location.href);
    base.search=params.toString();
    return base.toString();
  }
  function createInvite(){
    if(!safe($('#guestName').value)){showToast('Add the guest name first.');$('#guestName').focus();return}
    persistDraft();
    TTStudio.update(next=>{
      next.guest.status='invited';
      next.guest.ready=false;
      next.guest.admitted=false;
      next.guest.invitedAt=new Date().toISOString();
      TTStudio.addActivity(next,`Guest invitation created for ${next.guest.name}`);
    },'guest-invite');
    lastInviteUrl=buildGuestUrl();
    $('#guestLink').value=lastInviteUrl;
    $('#previewLink').href=lastInviteUrl;
    $('#linkBox').hidden=false;
    showToast('Private guest link created.');
  }
  async function copyInvite(){
    const value=$('#guestLink').value||lastInviteUrl;
    if(!value)return;
    try{await navigator.clipboard.writeText(value);showToast('Guest link copied.')}
    catch{ $('#guestLink').select();document.execCommand('copy');showToast('Guest link copied.') }
  }

  ['#guestName','#guestPronouns','#guestTitle','#guestSocial','#guestPromo','#season','#episodeNumber','#episodeTitle','#episodeTopic'].forEach(selector=>{
    $(selector).addEventListener('input',()=>{updatePreview();persistDraft()});
  });
  $('#createInvite').onclick=createInvite;
  $('#copyLink').onclick=copyInvite;
  TTStudio.subscribe(render);
})();