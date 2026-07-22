const KEY='podcastBrain3';
const BACKUP_KEY='podcastBrain3_backup';
const defaults={episode:{number:'29',title:'Can a Throuple Actually Get Married?',description:'',topic:'',hotline:'',game:'Chaos Bowl',intro:'',outro:''},stage:'prepare',running:false,elapsed:0,startedAt:null,currentSegment:0,currentQuestion:0,segments:['Cold Open','Intro','Life Update','Main Topic','Throuple Hotline','Chaos Bowl','Outro'],questions:['Can a throuple actually get married?','Why does the system celebrate messy TV relationships but reject ours?','What would legal recognition actually change?'],mustMentions:[{text:'Mention LA Blade',done:false},{text:'Listener email shout-out',done:false},{text:'Book 2 update',done:false},{text:'Weekly giveaway',done:false}],preflight:[{text:'OBS open and cameras framed',done:false},{text:'PodTrak recording media ready',done:false},{text:'All three microphones checked',done:false},{text:'Phones silenced',done:false},{text:'Water and Chaos Bowl ready',done:false}],markers:[],wrap:{favorite:'',reels:'',thumbnail:'',titles:'',runningJoke:'',futureEpisode:'',promises:''},publish:{Spotify:false,YouTube:false,'Show Notes':false,Website:false,Instagram:false,'YouTube Shorts':false,'Push Notification':false},vault:{jokes:['Hole Pics','Gay Rulebook','Triangle of Support'],ideas:['Growing Old Together','Parents Meeting Partners'],hotline:[],quotes:[]},editDone:[],lastSavedAt:null};
let state=load();
let timerId=null;
let vaultType='jokes';
let lastMarkerUndo=null;
let recoveredRunningSession=Boolean(state.running&&state.startedAt);
let mobileRecordingMode=sessionStorage.getItem('podcastBrainMobileMode')==='1';
const nav=[['home','⌂','Home'],['prepare','✎','Prepare'],['record','●','Record'],['wrap','✓','Wrap'],['edit','✂','Edit'],['publish','↑','Publish'],['vault','◇','Vault']];

function clone(x){return JSON.parse(JSON.stringify(x))}
function merge(a,b){for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k])a[k]=merge(a[k],b[k]);else a[k]=b[k]}return a}
function load(){
  try{
    const loaded=merge(clone(defaults),JSON.parse(localStorage.getItem(KEY)||'{}'));
    if(loaded.running&&(!Number.isFinite(Number(loaded.startedAt))||Number(loaded.startedAt)>Date.now()+60000)){
      loaded.running=false;loaded.startedAt=null;
    }
    loaded.elapsed=Math.max(0,Number(loaded.elapsed)||0);
    return loaded;
  }catch{
    try{return merge(clone(defaults),JSON.parse(localStorage.getItem(BACKUP_KEY)||'{}'))}catch{return clone(defaults)}
  }
}
function save(){
  state.lastSavedAt=Date.now();
  localStorage.setItem(KEY,JSON.stringify(state));
  localStorage.setItem(BACKUP_KEY,JSON.stringify(state));
  updateSaveState();
}
function el(id){return document.getElementById(id)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':')}
function prepPct(){const checks=[state.episode.title,state.episode.topic,state.episode.intro,state.episode.outro,state.episode.hotline,state.episode.game,...state.preflight.map(x=>x.done),...state.mustMentions.map(x=>x.done)];return Math.round(checks.filter(Boolean).length/checks.length*100)}
function stageIndex(){return ['prepare','record','wrap','edit','publish'].indexOf(state.stage)}
function currentElapsed(){return state.running?Math.max(0,state.elapsed+Math.floor((Date.now()-state.startedAt)/1000)):Math.max(0,state.elapsed)}
function updateDocumentTitle(){
  document.body.classList.toggle('recording-browser-state',state.running);
  document.title=state.running?`● ${fmt(currentElapsed())} — Episode ${state.episode.number}`:'Podcast Brain 3.0.2 — Mobile Recording Option';
}
function updateSaveState(){
  const node=el('saveState');
  if(!node)return;
  if(!state.lastSavedAt){node.innerHTML='Saved locally';return}
  node.innerHTML=`Saved locally · <strong>${new Date(state.lastSavedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong>`;
}
function setView(id){
  if(id!=='record'&&mobileRecordingMode)exitMobileRecordingMode(false);
  document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===id));
  el('pageTitle').textContent=nav.find(n=>n[0]===id)?.[2]||'Podcast Brain';
  render(id);
  scrollTo({top:0,behavior:'smooth'});
}
function buildNav(){
  const desk=el('desktopNav'),mob=el('mobileNav');
  desk.innerHTML=nav.map(n=>`<button data-view="${n[0]}"><span class="icon">${n[1]}</span>${n[2]}</button>`).join('');
  mob.innerHTML=nav.slice(0,6).map(n=>`<button data-view="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join('');
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
}
function render(view=document.querySelector('.section.active')?.id||'home'){
  document.body.classList.toggle('mobile-recording-mode',mobileRecordingMode&&view==='record');
  if(view==='home')home();
  if(view==='prepare')prepare();
  if(view==='record')record();
  if(view==='wrap')wrap();
  if(view==='edit')edit();
  if(view==='publish')publish();
  if(view==='vault')vault();
  syncTimer();
  updateDocumentTitle();
}
function home(){
  let pct=prepPct();
  el('home').innerHTML=`<div class="hero"><article class="card hero-main"><div><span class="status-pill"><i></i>${pct>=80?'Ready to record':'Preparation in progress'}</span><h2 class="episode-title">Episode ${esc(state.episode.number)}<br>${esc(state.episode.title)}</h2><p class="muted">Everything the three of you need before, during and after recording—without replacing OBS or Premiere.</p></div><div><div class="stage-row">${['Prepare','Record','Wrap','Edit','Publish'].map((s,i)=>`<div class="stage ${i===stageIndex()?'active':''}">${s}</div>`).join('')}</div><div style="margin-top:18px"><div class="metric"><small>Production readiness</small><strong>${pct}%</strong></div><div class="progress"><i style="width:${pct}%"></i></div></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px"><button class="btn primary" data-go="${state.stage}">Continue ${state.stage}</button><button class="btn" data-go="prepare">Open episode plan</button></div></div></article><aside class="grid"><article class="card producer"><div class="eyebrow">Producer Brain</div><div class="producer-message">${producerMessage()}</div><p class="muted">Quiet reminders based on the episode—not fake AI chatter.</p></article><article class="card"><div class="metric"><div><small>Markers captured</small><strong>${state.markers.length}</strong></div><div><small>Recording time</small><strong>${fmt(currentElapsed())}</strong></div></div></article></aside></div>`;
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
}
function producerMessage(){
  if(!state.preflight.every(x=>x.done))return 'Finish the preflight before anyone starts talking.';
  if(!state.mustMentions.every(x=>x.done))return `Still to mention: ${state.mustMentions.filter(x=>!x.done).map(x=>x.text).join(', ')}.`;
  if(state.running&&currentElapsed()>1800&&state.currentSegment===3)return 'The main topic has passed 30 minutes. Consider moving to the Hotline.';
  if(state.running&&state.markers.length===0&&currentElapsed()>600)return 'You are ten minutes in with no clip markers yet.';
  if(state.stage==='wrap')return 'Capture the best reel, title and promised follow-ups before leaving.';
  return 'The show plan is loaded. Podcast Brain is ready.';
}
function prepare(){
  el('prepare').innerHTML=`<div class="section-head"><div><div class="eyebrow">Prepare</div><h2>Are we ready to record?</h2></div><button class="btn primary" id="readyBtn">Move to Record</button></div><div class="grid two"><article class="card"><h3>Episode</h3><p class="muted">The information that anchors the whole workflow.</p>${field('Episode number','number',state.episode.number)}${field('Working title','title',state.episode.title)}${area('Main topic','topic',state.episode.topic)}${area('Throuple Hotline','hotline',state.episode.hotline)}${field('Game','game',state.episode.game)}${area('Intro notes','intro',state.episode.intro)}${area('Outro notes','outro',state.episode.outro)}</article><div class="grid"><article class="card"><h3>Run of show</h3><p class="muted">Use the arrows to put tonight in the right order.</p><div class="list">${state.segments.map((s,i)=>`<div class="list-item"><span class="tag">${i+1}</span><span class="grow">${esc(s)}</span><button data-up="${i}">↑</button><button data-down="${i}">↓</button></div>`).join('')}</div></article><article class="card"><h3>Must mention</h3><div class="checklist">${checks('mentions',state.mustMentions)}</div><div style="display:flex;gap:8px;margin-top:12px"><input class="input" id="newMention" placeholder="Add a must-mention"><button class="btn" data-add="mention">Add</button></div></article><article class="card"><h3>Preflight</h3><div class="checklist">${checks('preflight',state.preflight)}</div></article><article class="card"><h3>Questions</h3><div class="list">${state.questions.map((q,i)=>`<div class="list-item"><span class="grow">${esc(q)}</span><button data-remove-q="${i}">×</button></div>`).join('')}</div><div style="display:flex;gap:8px;margin-top:12px"><input class="input" id="newQuestion" placeholder="Add a question"><button class="btn" data-add="question">Add</button></div></article></div></div>`;
  bindPrepare();
}
function field(label,key,val){return `<div class="field"><label>${label}</label><input class="input" data-episode="${key}" value="${esc(val)}"></div>`}
function area(label,key,val){return `<div class="field"><label>${label}</label><textarea class="textarea" data-episode="${key}">${esc(val)}</textarea></div>`}
function checks(type,arr){return arr.map((x,i)=>`<label class="check"><input type="checkbox" data-check="${type}" data-i="${i}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>`).join('')}
function bindPrepare(){
  document.querySelectorAll('[data-episode]').forEach(x=>x.oninput=()=>{state.episode[x.dataset.episode]=x.value;save()});
  document.querySelectorAll('[data-check]').forEach(x=>x.onchange=()=>{let arr=x.dataset.check==='mentions'?state.mustMentions:state.preflight;arr[+x.dataset.i].done=x.checked;save()});
  document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(+b.dataset.up,-1));
  document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>move(+b.dataset.down,1));
  document.querySelectorAll('[data-remove-q]').forEach(b=>b.onclick=()=>{state.questions.splice(+b.dataset.removeQ,1);save();prepare()});
  document.querySelector('[data-add="mention"]').onclick=()=>{let v=el('newMention').value.trim();if(v){state.mustMentions.push({text:v,done:false});save();prepare()}};
  document.querySelector('[data-add="question"]').onclick=()=>{let v=el('newQuestion').value.trim();if(v){state.questions.push(v);save();prepare()}};
  el('readyBtn').onclick=()=>{state.stage='record';save();setView('record')};
}
function move(i,d){let j=i+d;if(j<0||j>=state.segments.length)return;[state.segments[i],state.segments[j]]=[state.segments[j],state.segments[i]];save();prepare()}


function enterMobileRecordingMode(){
  mobileRecordingMode=true;
  sessionStorage.setItem('podcastBrainMobileMode','1');
  document.body.classList.add('mobile-recording-mode');
  record();
  window.scrollTo({top:0,behavior:'smooth'});
}
function exitMobileRecordingMode(rerender=true){
  mobileRecordingMode=false;
  sessionStorage.removeItem('podcastBrainMobileMode');
  document.body.classList.remove('mobile-recording-mode');
  if(rerender)record();
}

function record(){
  const seg=state.segments[state.currentSegment]||'—';
  const q=state.questions[state.currentQuestion]||'No question selected';
  const nextSeg=state.segments[state.currentSegment+1]||'Wrap';
  const recovery=recoveredRunningSession?`<div class="recovery-banner">↻ Recovered your active recording session. Timer and markers were preserved.</div>`:'';
  el('record').innerHTML=`${recovery}<div class="mobile-mode-launch"><div><strong>Mobile recording controls</strong><small>Open the simplified timer + marker buttons view.</small></div><button class="btn teal mobile-mode-toggle" id="openMobileMode">Open Mobile View</button></div><div class="section-head"><div><div class="eyebrow">Record</div><h2>Run the room. Mark the moments.</h2></div><div class="button-row"><button class="btn ${state.running?'danger':'primary'}" id="timerBtn">${state.running?'Pause timer':'Start recording timer'}</button><button class="btn finish-btn" id="finishRecording">Finish recording →</button></div></div><div class="record-status-row"><span class="live-recording ${state.running?'active':''}"><i></i>${state.running?'RECORDING':'STANDBY'}</span><span class="save-state" id="saveState"></span></div><div class="record-shell ${state.running?'recording-active':''}"><article class="card record-main"><div class="mobile-remote-topbar"><span class="live-recording ${state.running?'active':''}"><i></i>${state.running?'RECORDING':'STANDBY'}</span><button class="mobile-remote-exit" id="exitMobileMode">Full View</button></div><div class="timer" id="timer">${fmt(currentElapsed())}</div><div class="segment">${esc(seg)} · ${state.currentSegment+1} of ${state.segments.length}</div><div class="question">${esc(q)}</div><div class="question-meta"><span>Question ${state.questions.length?state.currentQuestion+1:0} of ${state.questions.length}</span><span>Next segment: ${esc(nextSeg)}</span></div><div class="record-toolbar"><button class="btn" id="prevSeg">← Segment</button><button class="btn teal" id="nextSeg">Next Segment →</button><button class="btn" id="prevQ">← Question</button><button class="btn" id="nextQ">Next Question →</button><button class="btn" id="minusFive">Timer −5 sec</button><button class="btn" id="plusFive">Timer +5 sec</button></div><div class="mobile-remote-controls"><button class="btn ${state.running?'danger':'primary'} mobile-record-button" id="mobileTimerBtn">${state.running?'Pause Recording':'Start Recording'}</button><button class="btn" id="mobilePrevQ">← Question</button><button class="btn teal" id="mobileNextQ">Next Question</button><button class="btn" id="mobileNextSeg">Next Segment</button></div><div class="marker-grid">${[['😂','Funny'],['❤️','Highlight'],['✂️','Cut'],['⚠️','Sensitive'],['💡','Future Episode'],['📞','Hotline Callback'],['🔁','Running Joke'],['📝','Edit Note'],['⭐','Best Moment']].map(m=>`<button class="marker" data-marker="${m[1]}"><div style="font-size:25px;margin-bottom:7px">${m[0]}</div>${m[1]}</button>`).join('')}</div><div class="quick-note"><input class="input" id="quickNote" placeholder="Quick timestamped note…"><button class="btn teal" id="saveQuickNote">Save Note</button></div><div class="marker-feedback" id="markerFeedback" ${lastMarkerUndo?'':'hidden'}><span><b>✓ ${lastMarkerUndo?esc(lastMarkerUndo.type):''}</b> saved at ${lastMarkerUndo?fmt(lastMarkerUndo.time):'00:00:00'}</span><button class="btn" id="undoMarker">Undo</button></div></article><aside class="record-side-stack"><section class="card"><div class="eyebrow">Timeline</div><h3>Editing map</h3><div class="timeline">${timeline()}</div></section><section class="record-mini-card"><h3>Tonight’s must-mentions</h3><div class="record-mentions">${state.mustMentions.map((x,i)=>`<label class="check"><input type="checkbox" data-record-mention="${i}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>`).join('')}</div></section><section class="record-mini-card"><h3>Keyboard shortcuts</h3><div class="shortcuts"><kbd>Space</kbd><span>Start / pause</span><kbd>F</kbd><span>Funny marker</span><kbd>H</kbd><span>Highlight marker</span><kbd>C</kbd><span>Cut marker</span><kbd>R</kbd><span>Running joke</span><kbd>→</kbd><span>Next question</span><kbd>⇧ →</kbd><span>Next segment</span><kbd>⌘ Z</kbd><span>Undo marker</span></div></section></aside></div>`;
  bindRecord();
  updateSaveState();
  recoveredRunningSession=false;
}
function timeline(){
  return state.markers.length?state.markers.slice().reverse().map((m,i)=>{
    const index=state.markers.length-1-i;
    return `<div class="timeline-item"><span class="timeline-time">${fmt(m.time)}</span><div><b>${esc(m.type)}</b><div class="muted">${esc(m.segment||'')}${m.note?` · ${esc(m.note)}`:''}</div><div class="timeline-note-actions"><button data-note-marker="${index}">${m.note?'Edit note':'Add note'}</button></div></div><button class="btn" data-del-marker="${index}">×</button></div>`;
  }).join(''):`<div class="empty">Your clip, cut and callback markers will appear here.</div>`;
}
function bindRecord(){
  const openMobile=el('openMobileMode');if(openMobile)openMobile.onclick=enterMobileRecordingMode;
  const exitMobile=el('exitMobileMode');if(exitMobile)exitMobile.onclick=()=>exitMobileRecordingMode(true);
  const mobileTimer=el('mobileTimerBtn');if(mobileTimer)mobileTimer.onclick=toggleTimer;
  const mobilePrevQ=el('mobilePrevQ');if(mobilePrevQ)mobilePrevQ.onclick=()=>{state.currentQuestion=(state.currentQuestion-1+Math.max(1,state.questions.length))%Math.max(1,state.questions.length);save();record()};
  const mobileNextQ=el('mobileNextQ');if(mobileNextQ)mobileNextQ.onclick=()=>{state.currentQuestion=(state.currentQuestion+1)%Math.max(1,state.questions.length);save();record()};
  const mobileNextSeg=el('mobileNextSeg');if(mobileNextSeg)mobileNextSeg.onclick=()=>{state.currentSegment=Math.min(state.segments.length-1,state.currentSegment+1);save();record()};
  el('timerBtn').onclick=toggleTimer;
  el('finishRecording').onclick=finishRecording;
  el('nextSeg').onclick=()=>{state.currentSegment=Math.min(state.segments.length-1,state.currentSegment+1);save();record()};
  el('prevSeg').onclick=()=>{state.currentSegment=Math.max(0,state.currentSegment-1);save();record()};
  el('nextQ').onclick=()=>{state.currentQuestion=(state.currentQuestion+1)%Math.max(1,state.questions.length);save();record()};
  el('prevQ').onclick=()=>{state.currentQuestion=(state.currentQuestion-1+Math.max(1,state.questions.length))%Math.max(1,state.questions.length);save();record()};
  el('minusFive').onclick=()=>adjustTimer(-5);
  el('plusFive').onclick=()=>adjustTimer(5);
  el('saveQuickNote').onclick=saveQuickNote;
  el('quickNote').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveQuickNote()}};
  document.querySelectorAll('[data-marker]').forEach(b=>b.onclick=()=>addMarker(b.dataset.marker));
  document.querySelectorAll('[data-del-marker]').forEach(b=>b.onclick=()=>deleteMarker(+b.dataset.delMarker));
  document.querySelectorAll('[data-note-marker]').forEach(b=>b.onclick=()=>editMarkerNote(+b.dataset.noteMarker));
  document.querySelectorAll('[data-record-mention]').forEach(x=>x.onchange=()=>{state.mustMentions[+x.dataset.recordMention].done=x.checked;save()});
  const undo=el('undoMarker');if(undo)undo.onclick=undoLastMarker;
}
function toggleTimer(){
  if(state.running){state.elapsed=currentElapsed();state.running=false;state.startedAt=null}
  else{state.running=true;state.startedAt=Date.now();state.stage='record'}
  save();record();
}
function adjustTimer(amount){
  if(state.running){
    state.elapsed=Math.max(0,currentElapsed()+amount);
    state.startedAt=Date.now();
  }else state.elapsed=Math.max(0,state.elapsed+amount);
  save();record();toast(`Timer ${amount>0?'+':''}${amount} seconds`);
}
function finishRecording(){
  if(!confirm('Stop the timer and move to Wrap? Your duration and markers will be preserved.'))return;
  if(state.running){state.elapsed=currentElapsed();state.running=false;state.startedAt=null}
  state.stage='wrap';save();setView('wrap');
}
function syncTimer(){
  clearInterval(timerId);
  if(state.running)timerId=setInterval(()=>{
    const t=el('timer');if(t)t.textContent=fmt(currentElapsed());
    updateDocumentTitle();
  },1000);
}
function addMarker(type,note=''){
  const marker={time:currentElapsed(),type,note,segment:state.segments[state.currentSegment],question:state.questions[state.currentQuestion]||'',edited:false};
  state.markers.push(marker);
  lastMarkerUndo=clone(marker);
  state.stage='record';
  save();
  toast(`${type} saved`);
  record();
}
function saveQuickNote(){
  const input=el('quickNote');
  const note=input?.value.trim();
  if(!note)return;
  addMarker('Edit Note',note);
}
function undoLastMarker(){
  if(!lastMarkerUndo||!state.markers.length)return;
  const removed=state.markers.pop();
  lastMarkerUndo=null;
  save();record();toast(`${removed.type} removed`);
}
function deleteMarker(index){
  if(index<0||index>=state.markers.length)return;
  state.markers.splice(index,1);lastMarkerUndo=null;save();record();
}
function editMarkerNote(index){
  const marker=state.markers[index];
  if(!marker)return;
  const note=prompt(`Note for ${marker.type} at ${fmt(marker.time)}:`,marker.note||'');
  if(note===null)return;
  marker.note=note.trim();
  if(marker.type==='Future Episode'&&marker.note&&!state.vault.ideas.includes(marker.note))state.vault.ideas.push(marker.note);
  if(marker.type==='Running Joke'&&marker.note&&!state.vault.jokes.includes(marker.note))state.vault.jokes.push(marker.note);
  save();record();
}
function keyboardHandler(e){
  if(!document.getElementById('record')?.classList.contains('active'))return;
  if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undoLastMarker();return}
  if(e.code==='Space'){e.preventDefault();toggleTimer();return}
  const key=e.key.toLowerCase();
  const map={f:'Funny',h:'Highlight',c:'Cut',r:'Running Joke'};
  if(map[key]){e.preventDefault();addMarker(map[key]);return}
  if(e.key==='ArrowRight'&&e.shiftKey){e.preventDefault();state.currentSegment=Math.min(state.segments.length-1,state.currentSegment+1);save();record();return}
  if(e.key==='ArrowRight'){e.preventDefault();state.currentQuestion=(state.currentQuestion+1)%Math.max(1,state.questions.length);save();record()}
}

function wrap(){
  el('wrap').innerHTML=`<div class="section-head"><div><div class="eyebrow">Wrap</div><h2>Before you leave the room…</h2><p class="muted">Final duration: ${fmt(currentElapsed())} · ${state.markers.length} markers captured</p></div><button class="btn primary" id="wrapDone">Save & move to Edit</button></div><article class="card"><div class="wrap-grid">${wrapField('⭐ Favorite moment','favorite')}${wrapField('🎬 Reel ideas','reels')}${wrapField('🖼 Thumbnail idea','thumbnail')}${wrapField('📌 Episode title ideas','titles')}${wrapField('😂 Running joke','runningJoke')}${wrapField('💡 Future episode','futureEpisode')}${wrapField('🔔 Things promised to listeners','promises')}</div></article>`;
  document.querySelectorAll('[data-wrap]').forEach(x=>x.oninput=()=>{state.wrap[x.dataset.wrap]=x.value;save()});
  el('wrapDone').onclick=()=>{if(state.wrap.runningJoke&&!state.vault.jokes.includes(state.wrap.runningJoke))state.vault.jokes.push(state.wrap.runningJoke);if(state.wrap.futureEpisode&&!state.vault.ideas.includes(state.wrap.futureEpisode))state.vault.ideas.push(state.wrap.futureEpisode);state.stage='edit';save();setView('edit')};
}
function wrapField(label,key){return `<div class="field"><label>${label}</label><textarea class="textarea" data-wrap="${key}">${esc(state.wrap[key])}</textarea></div>`}
function edit(){el('edit').innerHTML=`<div class="section-head"><div><div class="eyebrow">Edit</div><h2>Your Premiere companion</h2></div><button class="btn primary" id="editDone">Editing complete</button></div><div class="grid two"><article class="card"><h3>Marker checklist</h3><div class="list">${state.markers.length?state.markers.map((m,i)=>`<label class="check"><input type="checkbox" data-edit="${i}" ${state.editDone.includes(i)?'checked':''}><span><b>${fmt(m.time)} · ${esc(m.type)}</b><br><span class="muted">${esc(m.segment)}${m.note?' — '+esc(m.note):''}</span></span></label>`).join(''):`<div class="empty">No markers captured yet.</div>`}</div></article><div class="grid"><article class="card"><h3>Episode memory</h3><p><b>Favorite:</b> ${esc(state.wrap.favorite)||'—'}</p><p><b>Reels:</b> ${esc(state.wrap.reels)||'—'}</p><p><b>Thumbnail:</b> ${esc(state.wrap.thumbnail)||'—'}</p><p><b>Titles:</b> ${esc(state.wrap.titles)||'—'}</p></article><article class="card producer"><div class="eyebrow">Producer Brain</div><div class="producer-message">${state.editDone.length} of ${state.markers.length} markers reviewed.</div><p class="muted">Use this as your map while Premiere handles the actual edit.</p></article></div></div>`;document.querySelectorAll('[data-edit]').forEach(x=>x.onchange=()=>{let i=+x.dataset.edit;if(x.checked&&!state.editDone.includes(i))state.editDone.push(i);if(!x.checked)state.editDone=state.editDone.filter(v=>v!==i);save();edit()});el('editDone').onclick=()=>{state.stage='publish';save();setView('publish')}}
function publish(){let done=Object.values(state.publish).filter(Boolean).length,total=Object.keys(state.publish).length;el('publish').innerHTML=`<div class="section-head"><div><div class="eyebrow">Publish</div><h2>Finish the launch</h2></div><button class="btn primary" id="archiveBtn">Complete episode</button></div><article class="card"><div class="metric"><div><small>Release completion</small><strong>${Math.round(done/total*100)}%</strong></div><span class="muted">${done} of ${total}</span></div><div class="progress" style="margin:14px 0 24px"><i style="width:${done/total*100}%"></i></div><div class="publish-grid">${Object.entries(state.publish).map(([k,v])=>`<label class="publish-item"><b>${esc(k)}</b><input type="checkbox" data-publish="${esc(k)}" ${v?'checked':''}></label>`).join('')}</div></article>`;document.querySelectorAll('[data-publish]').forEach(x=>x.onchange=()=>{state.publish[x.dataset.publish]=x.checked;save();publish()});el('archiveBtn').onclick=()=>{state.stage='publish';save();toast('Episode marked complete')}}
function vault(){let arr=state.vault[vaultType]||[];el('vault').innerHTML=`<div class="section-head"><div><div class="eyebrow">Vault</div><h2>The show remembers everything</h2></div></div><div class="vault-tabs">${[['jokes','Running Jokes'],['ideas','Episode Ideas'],['hotline','Hotline'],['quotes','Quotes']].map(([k,l])=>`<button class="btn ${vaultType===k?'active':''}" data-vault="${k}">${l}</button>`).join('')}</div><article class="card"><div style="display:flex;gap:8px;margin-bottom:16px"><input class="input" id="vaultInput" placeholder="Add to ${vaultType}"><button class="btn primary" id="vaultAdd">Add</button></div><div class="list">${arr.length?arr.map((v,i)=>`<div class="list-item"><span class="grow">${esc(v)}</span><button data-vault-del="${i}">×</button></div>`).join(''):`<div class="empty">Nothing saved here yet.</div>`}</div></article>`;document.querySelectorAll('[data-vault]').forEach(b=>b.onclick=()=>{vaultType=b.dataset.vault;vault()});el('vaultAdd').onclick=()=>{let v=el('vaultInput').value.trim();if(v){state.vault[vaultType].push(v);save();vault()}};document.querySelectorAll('[data-vault-del]').forEach(b=>b.onclick=()=>{state.vault[vaultType].splice(+b.dataset.vaultDel,1);save();vault()})}
function exportEpisode(){let data=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2);let blob=new Blob([data],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`podcast-brain-ep-${state.episode.number||'episode'}.json`;a.click();URL.revokeObjectURL(a.href)}
function resetAll(){if(confirm('Reset Podcast Brain and erase this episode from this browser?')){state=clone(defaults);save();setView('home')}}

document.addEventListener('keydown',keyboardHandler);
buildNav();
el('exportBtn').onclick=exportEpisode;
el('resetBtn').onclick=resetAll;
render(mobileRecordingMode?'record':'home');
document.querySelectorAll(`[data-view="${mobileRecordingMode?'record':'home'}"]`).forEach(x=>x.classList.add('active'));
