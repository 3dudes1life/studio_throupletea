(function(){
'use strict';

const DB_NAME='throuple-tea-guest-capture-v1';
const DB_VERSION=1;
const CHUNK_STORE='chunks';
const SESSION_STORE='sessions';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(CHUNK_STORE)){
        const store=db.createObjectStore(CHUNK_STORE,{keyPath:'id'});
        store.createIndex('sessionKind','sessionKind',{unique:false});
      }
      if(!db.objectStoreNames.contains(SESSION_STORE)){
        db.createObjectStore(SESSION_STORE,{keyPath:'sessionId'});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function tx(storeName,mode,fn){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,mode);
    const store=transaction.objectStore(storeName);
    let result;
    try{result=fn(store)}catch(error){reject(error);return}
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB transaction aborted'));
  });
}
async function putSession(meta){
  return tx(SESSION_STORE,'readwrite',store=>store.put(meta));
}
async function getSession(sessionId){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(SESSION_STORE,'readonly');
    const req=t.objectStore(SESSION_STORE).get(sessionId);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
}
async function listSessions(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(SESSION_STORE,'readonly');
    const req=t.objectStore(SESSION_STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
async function putChunk(sessionId,kind,index,blob){
  const id=`${sessionId}:${kind}:${String(index).padStart(8,'0')}`;
  const sessionKind=`${sessionId}:${kind}`;
  return tx(CHUNK_STORE,'readwrite',store=>store.put({id,sessionKind,index,blob,size:blob.size,type:blob.type,createdAt:Date.now()}));
}
async function getChunks(sessionId,kind){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(CHUNK_STORE,'readonly');
    const index=t.objectStore(CHUNK_STORE).index('sessionKind');
    const req=index.getAll(IDBKeyRange.only(`${sessionId}:${kind}`));
    req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>a.index-b.index));
    req.onerror=()=>reject(req.error);
  });
}
async function deleteSession(sessionId){
  const chunks=await Promise.all(['audio','video'].map(kind=>getChunks(sessionId,kind)));
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const t=db.transaction([CHUNK_STORE,SESSION_STORE],'readwrite');
    const cs=t.objectStore(CHUNK_STORE),ss=t.objectStore(SESSION_STORE);
    chunks.flat().forEach(item=>cs.delete(item.id));
    ss.delete(sessionId);
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);
  });
}
async function estimate(){
  if(navigator.storage&&navigator.storage.estimate){
    const e=await navigator.storage.estimate();
    return {quota:e.quota||0,usage:e.usage||0,free:Math.max(0,(e.quota||0)-(e.usage||0))};
  }
  return {quota:0,usage:0,free:0};
}
async function persistStorage(){
  if(navigator.storage&&navigator.storage.persist){
    try{return await navigator.storage.persist()}catch{return false}
  }
  return false;
}
function humanBytes(bytes){
  if(!bytes)return '—';
  const units=['B','KB','MB','GB','TB'];let n=bytes,i=0;
  while(n>=1024&&i<units.length-1){n/=1024;i++}
  return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${units[i]}`;
}

window.TTISOStore={
  putSession,getSession,listSessions,putChunk,getChunks,deleteSession,
  estimate,persistStorage,humanBytes
};
})();