(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const toast=$('#toast');
  let toastTimer;
  let guestUrl='';
  let presenceSocket=null;
  let presenceRoom='';
  let remoteGuestPresence=null;

  function showToast(msg,error){
    toast.textContent=msg;
    toast.style.background=error?'#ff6266':'white';
    toast.style.color=error?'white':'#111';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),2500);
  }
  function workerBase(){
    return String(window.TT_LIVE_GUEST_CONFIG&&window.TT_LIVE_GUEST_CONFIG.signalingBaseUrl||'').replace(/\/+$/,'');
  }
  function formatCode(code){
    const d=String(code||'').replace(/\D/g,'').slice(0,6);
    return d.length===6?`${d.slice(0,3)} ${d.slice(3)}`:(d||'— — —');
  }
  function formatExpiry(iso){
    if(!iso)return 'No active code';
    const date=new Date(iso);
    if(Number.isNaN(date.getTime()))return 'Expiration unavailable';
    return `Expires ${date.toLocaleString([],{dateStyle:'short',timeStyle:'short'})}`;
  }
  async function api(path,options={}){
    const base=workerBase();
    if(!base)throw new Error('Cloudflare Worker is not configured.');
    const response=await fetch(`${base}${path}`,{
      method:options.method||'GET',
      headers:{'Content-Type':'application/json',...(options.headers||{})},
      body:options.body?JSON.stringify(options.body):undefined
    });
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data.error||`Guest code request failed (${response.status})`);
    return data;
  }
  function buildBrowserGuestUrl(){
    const url=new URL('guest.html',location.href);
    return url.href;
  }
  function buildHostUrl(state){
    const url=new URL('host.html',location.href);
    if(state.liveRoom&&state.liveRoom.roomId)url.searchParams.set('room',state.liveRoom.roomId);
    if(state.liveRoom&&state.liveRoom.token)url.searchParams.set('token',state.liveRoom.token);
    return url.href;
  }
  function existsGuest(state){
    return Boolean(state.guest&&state.guest.name&&state.guest.name!=='Future Guest');
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

  async function generateCode(state,{revokeExisting=true}={}){
    if(!existsGuest(state))throw new Error('Create a guest first.');
    const room=state.liveRoom&&state.liveRoom.roomId;
    const token=state.liveRoom&&state.liveRoom.token;
    if(!room||!token)throw new Error('This guest is missing private room credentials.');

    const current=state.guestCode&&state.guestCode.code||'';
    if(revokeExisting&&current){
      try{
        await api('/code/revoke',{
          method:'POST',
          body:{code:current,room,token}
        });
      }catch{}
    }

    const result=await api('/code/create',{
      method:'POST',
      body:{
        room,token,
        guest:{
          name:state.guest.name||'Guest',
          pronouns:state.guest.pronouns||'',
          title:state.guest.title||'',
          social:state.guest.social||'',
          promo:state.guest.promo||''
        },
        episode:{
          season:state.episode.season||'',
          number:state.episode.number||'',
          title:state.episode.title||'',
          mainTopic:state.episode.mainTopic||''
        },
        expiresHours:48
      }
    });

    TTStudio.update(next=>{
      next.guestCode={
        code:result.code,
        status:'active',
        expiresAt:result.expiresAt,
        createdAt:result.createdAt
      };
      TTStudio.addActivity(next,`Guest code ${formatCode(result.code)} created for ${next.guest.name}`);
    },'guest-code-created');

    return result;
  }

  async function revokeCode(state,reason='revoked'){
    const code=state.guestCode&&state.guestCode.code||'';
    const room=state.liveRoom&&state.liveRoom.roomId;
    const token=state.liveRoom&&state.liveRoom.token;
    if(!code||!room||!token)return;
    await api('/code/revoke',{method:'POST',body:{code,room,token,reason}});
    TTStudio.update(next=>{
      next.guestCode={...(next.guestCode||{}),status:'revoked'};
      TTStudio.addActivity(next,`Guest code ${formatCode(code)} revoked`);
    },'guest-code-revoked');
  }

  function inviteText(state){
    const code=formatCode(state.guestCode&&state.guestCode.code);
    return `You’re invited to join A Little Throuple Tea. Open ${buildBrowserGuestUrl()} and enter guest code ${code}. For the best experience, use headphones, keep your device on power, and join a few minutes early.`;
  }

  function closePresenceSocket(){
    if(presenceSocket){try{presenceSocket.close(1000,'Hub watcher refresh')}catch{}}
    presenceSocket=null;presenceRoom='';
  }
  function showGreenRoomAlert(guest,state){
    const waiting=guest&&['waiting','ready'].includes(guest.status);
    const alert=$('#greenRoomAlert'),badge=$('#guestWaitingBadge'),control=$('#quickGuestControl');
    if(alert){
      alert.hidden=!waiting;
      if(waiting){
        $('#greenRoomAlertName').textContent=`${guest.name||'Your guest'} is waiting in the Green Room`;
        alert.onclick=()=>{location.href=buildHostUrl(state)};
      }
    }
    if(badge)badge.hidden=!waiting;
    if(control)control.classList.toggle('guest-waiting-now',Boolean(waiting));
  }
  function connectPresenceWatcher(state){
    const cfg=window.TT_LIVE_GUEST_CONFIG||{};
    const room=state.liveRoom&&state.liveRoom.roomId||'';
    const token=state.liveRoom&&state.liveRoom.token||'';
    if(!cfg.signalingBaseUrl||!room||!token){closePresenceSocket();showGreenRoomAlert(null,state);return}
    if(presenceSocket&&presenceRoom===room&&(presenceSocket.readyState===WebSocket.OPEN||presenceSocket.readyState===WebSocket.CONNECTING))return;

    closePresenceSocket();presenceRoom=room;
    try{
      const u=new URL(cfg.signalingBaseUrl);
      u.protocol=u.protocol==='https:'?'wss:':'ws:';
      u.pathname=`/room/${encodeURIComponent(room)}/websocket`;
      u.search=`?role=observer&token=${encodeURIComponent(token)}`;
      presenceSocket=new WebSocket(u.href);
      presenceSocket.addEventListener('message',event=>{
        let message;try{message=JSON.parse(event.data)}catch{return}
        if(message.type==='guest-state'&&message.guest){
          remoteGuestPresence=message.guest;
          showGreenRoomAlert(remoteGuestPresence,TTStudio.getState());
          render(TTStudio.getState());
        }
      });
      presenceSocket.addEventListener('close',()=>{
        presenceSocket=null;
        if(presenceRoom===room)setTimeout(()=>connectPresenceWatcher(TTStudio.getState()),1800);
      });
    }catch{closePresenceSocket()}
  }

  function render(state){
    const guest=state.guest||{};
    const exists=existsGuest(state);
    const liveGuest=remoteGuestPresence&&remoteGuestPresence.name?remoteGuestPresence:guest;
    const status=exists?(liveGuest.status||guest.status||'invited'):'none';

    $('#guestName').textContent=exists?guest.name:'No guest yet';
    $('#guestAvatar').textContent=exists?(guest.name.trim()[0]||'G').toUpperCase():'G';
    $('#guestRole').textContent=exists?([liveGuest.title||guest.title,liveGuest.pronouns||guest.pronouns].filter(Boolean).join(' · ')||'Guest'):'Create a private guest code when you are ready.';
    $('#guestSocial').textContent=liveGuest.social||guest.social||'No social added';
    $('#episodeLabel').textContent=`Episode ${state.episode.number||'—'}`;

    const pill=$('#guestStatus');
    pill.className=`status ${status}`;
    pill.innerHTML=`<i></i>${exists?statusLabel(status):'Not invited'}`;

    const code=state.guestCode||{};
    const codeActive=exists&&code.code&&code.status==='active';
    $('#guestCodeValue').textContent=formatCode(code.code);
    $('#guestCodeExpiry').textContent=codeActive?formatExpiry(code.expiresAt):(exists?'No active code':'Create a guest to generate a code');
    $('#guestCodeCard').classList.toggle('live',Boolean(codeActive));
    $('#guestCodeCard').classList.toggle('revoked',code.status==='revoked');

    $('#copyGuestCode').disabled=!codeActive;
    $('#copyGuestInvite').disabled=!codeActive;
    $('#regenerateGuestCode').disabled=!exists;
    $('#regenerateGuestCode').textContent=codeActive?'Regenerate':'Generate Code';
    $('#revokeGuestCode').disabled=!codeActive;

    const hostUrl=buildHostUrl(state);
    if($('#sidebarGuestControl'))$('#sidebarGuestControl').href=hostUrl;
    if($('#quickGuestControl'))$('#quickGuestControl').href=hostUrl;

    connectPresenceWatcher(state);
    showGreenRoomAlert(remoteGuestPresence,state);

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

  function openInvite(){
    dialog.showModal();
    setTimeout(()=>$('#inviteName').focus(),50);
  }

  $('#inviteGuest').onclick=openInvite;
  $('#quickInvite').onclick=openInvite;

  $('#saveInvite').onclick=async event=>{
    event.preventDefault();
    const name=$('#inviteName').value.trim();
    if(!name){showToast('Add the guest name first',true);return}

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
      next.liveRoom.signalingReady=Boolean(workerBase());

      next.guestCode={code:'',status:'creating',expiresAt:null,createdAt:null};

      next.episode.season=$('#inviteSeason').value.trim()||next.episode.season;
      next.episode.number=$('#inviteEpisode').value.trim()||next.episode.number;
      next.episode.title=$('#inviteEpisodeTitle').value.trim()||next.episode.title;
      TTStudio.addActivity(next,`${name} created as podcast guest`);
    },'guest-invite');

    dialog.close();

    try{
      const result=await generateCode(TTStudio.getState(),{revokeExisting:false});
      await navigator.clipboard.writeText(formatCode(result.code)).catch(()=>{});
      showToast(`Guest code ${formatCode(result.code)} created + copied`);
    }catch(error){
      TTStudio.update(next=>{next.guestCode={code:'',status:'error',expiresAt:null,createdAt:null}},'guest-code-error');
      showToast(`Guest created, but code failed: ${error.message}`,true);
    }
  };

  $('#copyGuestCode').onclick=async()=>{
    const state=TTStudio.getState();
    const code=formatCode(state.guestCode&&state.guestCode.code);
    await navigator.clipboard.writeText(code);
    showToast(`Guest code ${code} copied`);
  };

  $('#copyGuestInvite').onclick=async()=>{
    const state=TTStudio.getState();
    await navigator.clipboard.writeText(inviteText(state));
    showToast('Guest invitation copied');
  };

  $('#regenerateGuestCode').onclick=async()=>{
    const state=TTStudio.getState();
    if(!existsGuest(state))return;
    if(state.guestCode&&state.guestCode.status==='active'&&!confirm(`Generate a new code for ${state.guest.name}? The old code will stop working.`))return;
    try{
      const result=await generateCode(state,{revokeExisting:true});
      showToast(`New guest code ${formatCode(result.code)} created`);
    }catch(error){showToast(error.message,true)}
  };

  $('#revokeGuestCode').onclick=async()=>{
    const state=TTStudio.getState();
    if(!confirm(`Revoke ${formatCode(state.guestCode&&state.guestCode.code)}? The guest will no longer be able to enter with it.`))return;
    try{
      await revokeCode(state,'host-revoked');
      showToast('Guest code revoked');
    }catch(error){showToast(error.message,true)}
  };

  $('#openGuestLounge').onclick=()=>window.open(buildBrowserGuestUrl(),'_blank','noopener');

  $('#copyGuide').onclick=async()=>{
    const state=TTStudio.getState();
    const text=state.guestCode&&state.guestCode.status==='active'
      ? inviteText(state)
      : 'For the best Throuple Tea guest experience: use headphones, keep your device on power, place the camera near eye level, silence notifications, and join a few minutes early.';
    await navigator.clipboard.writeText(text);
    showToast('Guest guide copied');
  };

  $('#clearGuest').onclick=async event=>{
    event.preventDefault();event.stopPropagation();
    const state=TTStudio.getState();
    const currentName=existsGuest(state)?state.guest.name:'the current guest';
    if(!confirm(`Clear ${currentName} from Guest Hub? Their active guest code will be revoked.`))return;

    try{
      if(state.guestCode&&state.guestCode.code&&state.guestCode.status==='active'){
        await revokeCode(state,'guest-cleared');
      }
    }catch(error){
      if(!confirm(`The code could not be revoked (${error.message}). Clear the local guest anyway?`))return;
    }

    TTStudio.update(next=>{
      next.guest={
        name:'Future Guest',pronouns:'',title:'',social:'',promo:'',notes:'',
        releaseAccepted:false,ready:false,status:'invited',admitted:false,
        checkInStage:'tech',checkInCompletedAt:null,waitingSince:null
      };
      next.lowerThird={name:'',title:'',social:''};
      next.liveRoom={roomId:'',token:'',createdAt:null,signalingReady:Boolean(workerBase())};
      next.guestCode={code:'',status:'none',expiresAt:null,createdAt:null};
      TTStudio.addActivity(next,'Current guest and code cleared from Guest Hub');
    },'clear-guest');

    remoteGuestPresence=null;
    closePresenceSocket();
    showGreenRoomAlert(null,TTStudio.getState());
    showToast('Guest + code cleared — ready for the next guest');
  };

  addEventListener('beforeunload',closePresenceSocket);
})();