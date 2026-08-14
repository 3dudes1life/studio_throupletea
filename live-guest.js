(function(){
  'use strict';

  function randomToken(bytes=12){
    const arr=new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
  }

  function normalizeBase(url){
    return String(url||'').trim().replace(/\/+$/,'');
  }

  function wsBase(httpUrl){
    const url=new URL(httpUrl);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    return url.origin;
  }

  class LiveGuestConnection {
    constructor(options={}){
      this.role=options.role;
      this.room=options.room;
      this.token=options.token;
      this.localStream=options.localStream||null;
      this.remoteVideo=options.remoteVideo||null;
      this.onState=options.onState||(()=>{});
      this.onMessage=options.onMessage||(()=>{});
      this.onStats=options.onStats||(()=>{});
      this.pc=null;
      this.ws=null;
      this.reconnectTimer=null;
      this.reconnectAttempts=0;
      this.closed=false;
      this.statsTimer=null;
      this.pendingCandidates=[];
      this.remoteRole=this.role==='host'?'guest':'host';
    }

    get config(){
      return window.TT_LIVE_GUEST_CONFIG||{};
    }

    configured(){
      return Boolean(normalizeBase(this.config.signalingBaseUrl));
    }

    state(name,detail){
      this.onState({state:name,detail:detail||''});
    }

    async connect(){
      if(!this.configured()){
        this.state('setup-required','Signaling Worker URL is not configured.');
        return;
      }
      if(!this.room||!this.token){
        this.state('error','Missing private room credentials.');
        return;
      }
      this.closed=false;
      this.state('connecting','Connecting to private room…');
      this.openSocket();
    }

    openSocket(){
      clearTimeout(this.reconnectTimer);
      let url;
      try{
        const base=wsBase(normalizeBase(this.config.signalingBaseUrl));
        url=`${base}/room/${encodeURIComponent(this.room)}/websocket?role=${encodeURIComponent(this.role)}&token=${encodeURIComponent(this.token)}`;
      }catch(error){
        this.state('error','Invalid signaling Worker URL.');
        return;
      }

      this.ws=new WebSocket(url);
      this.ws.addEventListener('open',()=>{
        this.reconnectAttempts=0;
        this.state('waiting','Private room connected. Waiting for the other side…');
        this.send({type:'hello',role:this.role});
      });
      this.ws.addEventListener('message',event=>{
        let message;
        try{message=JSON.parse(event.data)}catch{return}
        this.handleSignal(message);
      });
      this.ws.addEventListener('close',()=>{
        if(this.closed)return;
        this.state('reconnecting','Connection interrupted. Reconnecting…');
        this.scheduleReconnect();
      });
      this.ws.addEventListener('error',()=>{});
    }

    scheduleReconnect(){
      if(this.closed)return;
      const delay=Math.min(10000,1000*Math.pow(1.7,this.reconnectAttempts++));
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer=setTimeout(()=>this.openSocket(),delay);
    }

    send(payload){
      if(this.ws&&this.ws.readyState===WebSocket.OPEN){
        this.ws.send(JSON.stringify(payload));
      }
    }

    async ensurePeer(){
      if(this.pc&&this.pc.connectionState!=='closed')return this.pc;

      this.pc=new RTCPeerConnection(this.config.rtcConfig||{});
      this.pendingCandidates=[];

      if(this.localStream){
        this.localStream.getTracks().forEach(track=>this.pc.addTrack(track,this.localStream));
      }

      this.pc.addEventListener('track',event=>{
        const stream=event.streams&&event.streams[0]?event.streams[0]:new MediaStream([event.track]);
        if(this.remoteVideo){
          this.remoteVideo.srcObject=stream;
          this.remoteVideo.play().catch(()=>{});
        }
        this.state('connected','Live guest connection active.');
        this.startStats();
      });

      this.pc.addEventListener('icecandidate',event=>{
        if(event.candidate)this.send({type:'ice-candidate',candidate:event.candidate});
      });

      this.pc.addEventListener('connectionstatechange',()=>{
        const state=this.pc.connectionState;
        if(state==='connected'){
          this.state('connected','Live guest connection active.');
          this.startStats();
        }else if(state==='failed'){
          this.state('reconnecting','WebRTC connection failed. Retrying…');
          this.restartPeer();
        }else if(state==='disconnected'){
          this.state('reconnecting','Guest connection interrupted…');
        }
      });

      return this.pc;
    }

    async restartPeer(){
      if(this.pc){try{this.pc.close()}catch{}}
      this.pc=null;
      this.stopStats();
      this.send({type:'restart-request'});
    }

    async makeOffer(){
      const pc=await this.ensurePeer();
      const offer=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
      await pc.setLocalDescription(offer);
      this.send({type:'offer',description:pc.localDescription});
      this.state('connecting','Negotiating live audio + video…');
    }

    async handleSignal(message){
      this.onMessage(message);

      if(message.type==='joined'){
        this.state('waiting',message.peerPresent?'Guest room ready. Connecting…':'Waiting for the other side…');
        if(message.peerPresent&&this.role==='host')await this.makeOffer();
        return;
      }

      if(message.type==='peer-joined'){
        this.state('connecting','Other side joined.');
        if(this.role==='host')await this.makeOffer();
        return;
      }

      if(message.type==='peer-left'){
        this.state('waiting','The other side left. Waiting for them to reconnect…');
        if(this.remoteVideo)this.remoteVideo.srcObject=null;
        if(this.pc){try{this.pc.close()}catch{}}
        this.pc=null;
        this.stopStats();
        return;
      }

      if(message.type==='restart-request'){
        if(this.role==='host')await this.restartAndOffer();
        return;
      }

      if(message.type==='offer'){
        const pc=await this.ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(message.description));
        await this.flushCandidates();
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({type:'answer',description:pc.localDescription});
        return;
      }

      if(message.type==='answer'){
        const pc=await this.ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(message.description));
        await this.flushCandidates();
        return;
      }

      if(message.type==='ice-candidate'&&message.candidate){
        const pc=await this.ensurePeer();
        if(pc.remoteDescription&&pc.remoteDescription.type){
          try{await pc.addIceCandidate(message.candidate)}catch{}
        }else{
          this.pendingCandidates.push(message.candidate);
        }
      }
    }

    async restartAndOffer(){
      if(this.pc){try{this.pc.close()}catch{}}
      this.pc=null;
      this.stopStats();
      await this.makeOffer();
    }

    async flushCandidates(){
      if(!this.pc||!this.pc.remoteDescription)return;
      const list=this.pendingCandidates.splice(0);
      for(const candidate of list){
        try{await this.pc.addIceCandidate(candidate)}catch{}
      }
    }

    startStats(){
      this.stopStats();
      this.statsTimer=setInterval(()=>this.collectStats(),2500);
      this.collectStats();
    }

    stopStats(){
      clearInterval(this.statsTimer);
      this.statsTimer=null;
    }

    async collectStats(){
      if(!this.pc)return;
      try{
        const reports=await this.pc.getStats();
        let inboundVideo=null,inboundAudio=null,candidatePair=null;
        reports.forEach(report=>{
          if(report.type==='inbound-rtp'&&!report.isRemote&&report.kind==='video')inboundVideo=report;
          if(report.type==='inbound-rtp'&&!report.isRemote&&report.kind==='audio')inboundAudio=report;
          if(report.type==='candidate-pair'&&report.state==='succeeded'&&report.nominated)candidatePair=report;
        });
        this.onStats({video:inboundVideo,audio:inboundAudio,candidatePair});
      }catch{}
    }

    setLocalStream(stream){
      this.localStream=stream;
      if(!this.pc)return;
      const tracks=stream?stream.getTracks():[];
      ['audio','video'].forEach(kind=>{
        const sender=this.pc.getSenders().find(s=>s.track&&s.track.kind===kind);
        const track=tracks.find(t=>t.kind===kind)||null;
        if(sender)sender.replaceTrack(track).catch(()=>{});
        else if(track)this.pc.addTrack(track,stream);
      });
    }

    sendControl(action,value){
      this.send({type:'control',action,value});
    }

    close(){
      this.closed=true;
      clearTimeout(this.reconnectTimer);
      this.stopStats();
      if(this.pc){try{this.pc.close()}catch{}}
      if(this.ws){try{this.ws.close(1000,'Client leaving')}catch{}}
      this.pc=null;this.ws=null;
    }
  }

  window.TTLiveGuest={LiveGuestConnection,randomToken};
})();