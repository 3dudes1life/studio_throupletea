/* Throuple Tea Dashboard Bridge v1
   Add this script to the internal dashboard. It receives Podcast Brain Studio 3.1 episode packets.
*/
(function(){
  const INBOX='throupleTeaDashboardInbox';
  const EVENT='throupletea:episode-packet';

  function readInbox(){
    try{return JSON.parse(localStorage.getItem(INBOX)||'[]')}catch{return []}
  }

  function saveInbox(items){
    localStorage.setItem(INBOX,JSON.stringify(items));
  }

  function receive(packet){
    if(!packet || packet.schema!=='podcast-brain-episode-packet') return false;
    const inbox=readInbox();
    if(!inbox.some(x=>x.packetId===packet.packetId)){
      inbox.unshift(packet);
      saveInbox(inbox);
    }
    window.dispatchEvent(new CustomEvent(EVENT,{detail:packet}));
    return true;
  }

  function importFile(file){
    return file.text().then(JSON.parse).then(packet=>{
      if(!receive(packet)) throw new Error('Not a Podcast Brain episode packet.');
      return packet;
    });
  }

  try{
    const channel=new BroadcastChannel('throuple-tea-production');
    channel.onmessage=e=>{
      if(e.data?.type==='EPISODE_PACKET') receive(e.data.packet);
    };
  }catch(e){}

  window.ThroupleTeaProductionBridge={
    getInbox:readInbox,
    receive,
    importFile,
    remove(packetId){
      saveInbox(readInbox().filter(x=>x.packetId!==packetId));
    },
    clear(){saveInbox([])},
    eventName:EVENT
  };
})();