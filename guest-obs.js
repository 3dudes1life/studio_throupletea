(function(){
'use strict';
const q=new URLSearchParams(location.search);
const room=q.get('room')||'',token=q.get('token')||'';
const video=document.getElementById('guestFeed'),status=document.getElementById('status');
if(!room||!token){status.querySelector('span').textContent='Missing private room credentials';return}
const live=new TTLiveGuest.LiveGuestConnection({
  role:'obs',room,token,localStream:null,remoteVideo:video,
  onState(event){
    status.hidden=event.state==='connected';
    if(!status.hidden)status.querySelector('span').textContent=({
      connecting:'Connecting to guest…',waiting:'Waiting for guest video…',
      reconnecting:'Reconnecting guest feed…','setup-required':'Signaling setup required',error:'Guest feed error'
    })[event.state]||'Waiting for guest video…';
  }
});
live.connect();
addEventListener('beforeunload',()=>live.close());
})();