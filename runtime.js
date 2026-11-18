const $ = id => document.getElementById(id);
const stage = $('stage'), tabNames = ORIGINAL.tabs.list.map(item => item.pagePath.split('/').pop());
const instances = {}, session = new Map(), files = new Map();
let active, app, frame, toast, inputDispatch = false, backStack = [];
const invoke = (opts, result) => { opts.success?.(result); opts.complete?.(result); };
const failure = (opts, message) => { const err = {errMsg: message}; opts.fail?.(err); opts.complete?.(err); };
function notice(message, sticky = false) {
  clearTimeout(toast); $('notice').textContent = message; $('notice').hidden = false;
  if (!sticky) toast = setTimeout(() => { $('notice').hidden = true; }, 2300);
}
function schedule(page) {
  if (page !== active || inputDispatch) return;
  cancelAnimationFrame(frame); frame = requestAnimationFrame(render);
}
const expressions = new Map();
function read(code, scope) {
  try {
    if (!expressions.has(code)) expressions.set(code, new Function('scope', 'with(scope){return (' + code + ')}'));
    return expressions.get(code)(scope);
  } catch { return undefined; }
}
const expand = (text, scope) => text.replace(/{{([\s\S]*?)}}/g, (_, expr) => read(expr, scope) ?? '');
const valueOf = (text, scope) => {
  const match = /^{{([\s\S]*?)}}$/.exec(text);
  return match ? read(match[1], scope) : expand(text, scope);
};
function children(src, dst, scope) {
  let previous = false;
  for (const node of src.childNodes) {
    if (node.nodeType === 3) { dst.append(document.createTextNode(expand(node.textContent,scope))); continue; }
    if (node.nodeType !== 1) continue;
    if (node.hasAttribute('wx:if')) {
      previous = Boolean(valueOf(node.getAttribute('wx:if'),scope)); if (!previous) continue;
    } else if (node.hasAttribute('wx:else') && previous) continue;
    mount(node,dst,scope);
  }
}
function mount(src,dst,scope,repeated = false) {
  if (!repeated && src.hasAttribute('wx:for')) {
    const list = valueOf(src.getAttribute('wx:for'),scope) || [];
    Array.from(list).forEach((item,index) => mount(src,dst,{...scope,item,index},true));
    return;
  }
  if (src.localName === 'block') return children(src,dst,scope);
  const tag = {image:'img',picker:'select',switch:'input'}[src.localName] || src.localName;
  const el = document.createElement(tag), dataset = {};
  const page = active;
  if (src.localName === 'switch') el.type = 'checkbox';
  for (const attr of src.attributes) {
    const name = attr.name, val = valueOf(attr.value,scope);
    if (name.startsWith('wx:')) continue;
    if (name.startsWith('data-')) { dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = val; continue; }
    const binding = /^(bind|catch):?(tap|input|change|confirm|touchstart|touchend)$/.exec(name);
    if (binding) {
      const event = {tap:'click',input:'input',change:'change',confirm:'keydown',touchstart:'pointerdown',touchend:'pointerup'}[binding[2]];
      el.addEventListener(event,e => {
        if (event === 'keydown' && (e.key !== 'Enter' || e.isComposing)) return;
        if (binding[1] === 'catch') e.stopPropagation();
        if (event === 'pointerdown' && src.hasAttribute('bindtouchend')) {
          const finish = () => {
            window.removeEventListener('pointerup',finish,true); window.removeEventListener('pointercancel',finish,true);
            page[src.getAttribute('bindtouchend')]?.();
          };
          window.addEventListener('pointerup',finish,true); window.addEventListener('pointercancel',finish,true);
        }
        const evt = {currentTarget:{dataset},target:{dataset},detail:{value:el.type==='checkbox'?el.checked:el.value}};
        inputDispatch = event === 'input';
        try { page[attr.value]?.(evt); }
        finally { inputDispatch = false; }
      });
      continue;
    }
    if (['disabled','checked'].includes(name)) { el[name] = attr.value === '' || Boolean(val); continue; }
    if (name === 'value' && tag !== 'select') { el.value = val ?? ''; continue; }
    if (name === 'src' && val && !/^(blob:|data:(image|video|audio)\/|\.?\.?\/|assets\/)/i.test(val)) continue;
    if (val != null) el.setAttribute(name, typeof val === 'object' ? '' : val);
  }
  if (tag === 'select') {
    const range = valueOf(src.getAttribute('range') || '',scope) || [], key = src.getAttribute('range-key');
    if (src.firstElementChild?.className) el.className = src.firstElementChild.className;
    if (src.firstElementChild?.hasAttribute('style')) el.style.cssText = expand(src.firstElementChild.getAttribute('style'),scope);
    range.forEach((option,index)=>el.add(new Option(key ? option[key] : option,index)));
    const val = valueOf(src.getAttribute('value') || '0',scope);
    let index = key && range.some(item=>item?.id===val) ? range.findIndex(item=>item.id===val) : Number(val);
    el.selectedIndex = Number.isInteger(index) && index >= 0 && index < range.length ? index : 0;
  } else if (!['input','img','textarea'].includes(tag)) children(src,el,scope);
  if (src.hasAttribute('bindtap') && !['button','input'].includes(tag)) {
    el.tabIndex = 0; el.setAttribute('role','button');
    el.addEventListener('keydown', e => { if (e.target === el && ['Enter',' '].includes(e.key)) { e.preventDefault(); el.click(); } });
  }
  dst.append(el);
}
function render() {
  const {name,data,template} = active;
  const current = document.activeElement;
  const controls = [...stage.querySelectorAll('input,textarea,select')];
  const index = controls.indexOf(current), selection = index >= 0 ? [current.selectionStart,current.selectionEnd] : [];
  const top = stage.scrollTop;
  const fragment = document.createDocumentFragment(); children(template.content,fragment,data);
  stage.replaceChildren(fragment); stage.scrollTop = top;
  if (index >= 0) {
    const target = stage.querySelectorAll('input,textarea,select')[index];
    if (target) { target.focus({preventScroll:true}); if (selection[0] != null) target.setSelectionRange(...selection); }
  }
  const bottom = stage.querySelector('.chat-container');
  if (bottom && data.scrollIntoView) bottom.scrollTop = bottom.scrollHeight;
  $('tabs').hidden = !tabNames.includes(name); $('back').hidden = tabNames.includes(name) || name === 'welcome';
  const branded = Boolean(document.documentElement.dataset.theme);
  $('title').textContent = name === 'generate' ? 'AI创作' : name === 'voice-clone' ? '声音克隆' : branded ? '时光数字人' : name === 'index' ? '数字人' : 'AI数字人（测试）';
  ORIGINAL.tabs.list.forEach((item,i) => {
    const a = $('tabs').children[i], selected = name === tabNames[i];
    a.firstChild.src = ORIGINAL.icons[selected ? item.selectedIconPath : item.iconPath];
    a.style.color = selected ? ORIGINAL.tabs.selectedColor : ORIGINAL.tabs.color;
    if (selected) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
}
function route(name, mode = 'push', query = {}) {
  if (!instances[name]) return;
  if (mode === 'push' && active && active.name !== name) backStack.push(active.name);
  if (mode === 'reset') backStack = [];
  active?.onHide?.();
  active = instances[name];
  $('tabs').hidden = !tabNames.includes(name);
  stage.style.setProperty('--page-height',stage.clientHeight+'px');
  $('page-css').textContent = ORIGINAL.pages[name].css.replace(/(^|[},])\s*page(?=\s*[{,])/g,'$1 #stage');
  $('bar').style.background = '#ffcc80';
  stage.scrollTop = 0;
  if (!active.loaded) { active.loaded = true; active.onLoad?.(query); }
  active.onShow?.();
  render();
}
const back = () => route(backStack.pop() || 'index','back');
const nav = (url,mode) => {
  const [path,query] = url.split('?'); route(path.split('/').pop(),mode,Object.fromEntries(new URLSearchParams(query)));
};
function pick(opts, audio) {
  const input = document.createElement('input'); input.type = 'file'; input.accept = audio ? 'audio/*' : 'image/*'; input.multiple = opts.count > 1;
  input.onchange = () => {
    const tempFiles = [...input.files].slice(0,opts.count || 1).map(file => {
      const path = URL.createObjectURL(file); files.set(path,file);
      return {path,tempFilePath:path,size:file.size,name:file.name,type:file.type};
    });
    if (tempFiles.length) invoke(opts,{tempFiles,tempFilePaths:tempFiles.map(f=>f.path)});
  };
  input.oncancel = () => failure(opts,'cancel');
  input.click();
}
function sampleAudio() {
  const bytes = new Uint8Array(8044), v = new DataView(bytes.buffer);
  const put = (offset,s) => [...s].forEach((c,i)=>bytes[offset+i]=c.charCodeAt(0));
  put(0,'RIFF'); v.setUint32(4,8036,true); put(8,'WAVEfmt '); v.setUint32(16,16,true);
  v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,8000,true); v.setUint32(28,8000,true);
  v.setUint16(32,1,true); v.setUint16(34,8,true); put(36,'data'); v.setUint32(40,8000,true);
  for(let i=0;i<8000;i++) bytes[44+i]=128+Math.round(22*Math.sin(i*.35)*Math.sin(Math.PI*i/8000));
  return new Blob([bytes],{type:'audio/wav'});
}
const audio = URL.createObjectURL(sampleAudio());
function download(opts) {
  const a = document.createElement('a'); a.href=opts.filePath; a.download='数字人演示素材'; a.click(); invoke(opts,{});
}
const wx = {
  getStorageSync:key=>session.get(key) ?? '',
  setStorageSync:(key,data)=>session.set(key,data),
  removeStorageSync:key=>session.delete(key),
  getStorage:opts=>session.has(opts.key)?invoke(opts,{data:session.get(opts.key)}):failure(opts,'not found'),
  showToast:opts=>notice(opts.title), showLoading:opts=>notice(opts.title,true), hideLoading:()=>{$('notice').hidden=true;},
  showModal:opts=>invoke(opts,{confirm:opts.showCancel===false ? (alert(opts.content || opts.title),true) : confirm(opts.content || opts.title)}),
  switchTab:opts=>nav(opts.url,'reset'), navigateTo:opts=>nav(opts.url,'push'), navigateBack:back, reLaunch:opts=>nav(opts.url,'reset'),
  setNavigationBarColor:opts=>{$('bar').style.background=opts.backgroundColor;},
  chooseMedia:opts=>pick(opts,opts.mediaType?.includes('audio')), chooseMessageFile:opts=>pick(opts,true),
  uploadFile:opts=>setTimeout(()=>invoke(opts,{statusCode:200,data:JSON.stringify({success:true,rawUrl:opts.filePath,url:opts.filePath,data:{rawUrl:opts.filePath,url:opts.filePath}})}),180),
  downloadFile:opts=>invoke(opts,{statusCode:200,tempFilePath:opts.url}),
  saveVideoToPhotosAlbum:download,saveImageToPhotosAlbum:download,
  previewImage:opts=>{
    const modal=document.createElement('dialog'), img=document.createElement('img'), close=document.createElement('button');
    img.src=opts.current || opts.urls[0]; close.textContent='关闭'; close.onclick=()=>modal.close();
    modal.addEventListener('close',()=>modal.remove()); modal.append(img,close); $('phone').append(modal); modal.showModal();
  },
  createInnerAudioContext:()=>{const player=new Audio(); player.onEnded=fn=>player.addEventListener('ended',fn); player.onPlay=fn=>player.addEventListener('play',fn); player.destroy=()=>player.pause(); const play=player.play.bind(player);player.play=()=>play().catch(()=>notice('浏览器未能播放示例音频')); return player;},
  playVoice:opts=>new Audio(opts.filePath).play().catch(()=>notice('无法播放示例音频')),
  getRecorderManager:()=>{let handler; return {onStop:fn=>{handler=fn;},onError(){},start(){notice('模拟录音：未访问麦克风');},stop(){handler?.({tempFilePath:audio,duration:1000});}};},
  getFileSystemManager:()=>({readFile:opts=>{const reader=new FileReader(); reader.onload=()=>invoke(opts,{data:opts.encoding==='base64'?String(reader.result).split(',')[1]:reader.result}); reader.onerror=()=>failure(opts,'read error'); const file=files.get(opts.filePath)||sampleAudio(); if(opts.encoding==='base64')reader.readAsDataURL(file);else reader.readAsArrayBuffer(file);}}),
  authorize:opts=>invoke(opts,{}), openSetting:opts=>invoke(opts,{}),
  arrayBufferToBase64:buffer=>btoa(Array.from(new Uint8Array(buffer),c=>String.fromCharCode(c)).join('')),
  request:opts=>mockRequest(opts)
};
const voices = [], jobs = new Map();
let id = 0;
function makeVideo() {
  return new Promise((resolve,reject)=>{
    try {
      const canvas=document.createElement('canvas'); canvas.width=480; canvas.height=270;
      const ctx=canvas.getContext('2d'), stream=canvas.captureStream(15), recorder=new MediaRecorder(stream);
      const chunks=[]; let frame=0;
      const paint=()=>{
        ctx.fillStyle='#ffead3';ctx.fillRect(0,0,480,270);
        ctx.fillStyle='#ff8c00';ctx.beginPath();ctx.arc(240+Math.sin(frame/5)*30,105,38,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#804616';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText('数字人视频 · 离线样片',240,195);frame++;
      };
      recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
      recorder.onerror=e=>reject(e.error);
      recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());resolve(URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType})));};
      paint();recorder.start();const timer=setInterval(paint,66);
      setTimeout(()=>{clearInterval(timer);recorder.stop();},1200);
    } catch (error) { reject(error); }
  });
}
async function mockRequest(opts) {
  const path=new URL(opts.url,'http://offline.invalid').pathname, input=opts.data || {};
  let data={success:true};
  if (path==='/api/chat' || path==='/api/voice-chat') {
    const content=input.message || '语音示例'; const reply='【演示回复】我听到你说：'+content;
    const log=wx.getStorageSync('chatHistory') || [];
    log.push({id:++id,content,reply,time:new Date().toISOString()}); wx.setStorageSync('chatHistory',log);
    Object.assign(data,{reply,replyText:reply});
  } else if (path==='/api/voice/tts') data.audio=audio;
  else if (path==='/api/user/voices') data.voices=voices;
  else if (path==='/api/user/nickname') data.user={...wx.getStorageSync('userInfo'),nickname:input.nickname};
  else if (path==='/api/voice/clone') {
    const speakerId='sample-'+(++id), name=input.name || input.speakerName || '示例音色';
    voices.push({id,speaker_id:speakerId,name,audio_url:audio,voice_url:audio});
    wx.setStorageSync('clonedVoices',voices); data.speakerId=speakerId;
  } else if (path.startsWith('/api/voice/status/')) data.data={status:'trained'};
  else if (path==='/api/jimeng/generate') data.imageUrl='./sample.svg';
  else if (path==='/api/digital-human/generate') {
    data.task_id='job-'+(++id); jobs.set(data.task_id,makeVideo().catch(()=>null));
  } else if (path.startsWith('/api/digital-human/status/')) {
    data.video_url=await jobs.get(path.split('/').pop()); data.status=data.video_url?'done':'failed';
  } else { data={success:false,error:'此接口未接入（离线演示）'}; }
  setTimeout(()=>invoke(opts,{statusCode:200,data}),250);
}
new Function('App','wx',ORIGINAL.app)(definition=>{app=definition;},wx);
app.onLaunch?.();
for (const [name,source] of Object.entries(ORIGINAL.pages)) {
  new Function('Page','getApp','wx',source.js)(page=>{
    page.name=name; page.template=document.createElement('template'); page.template.innerHTML=source.markup;
    page.setData=function(patch){Object.assign(this.data,patch);schedule(this);};
    instances[name]=page;
  },()=>app,wx);
}
ORIGINAL.tabs.list.forEach((item,i)=>{
  const a=document.createElement('a'); a.href='#'+tabNames[i];
  a.append(document.createElement('img'),document.createTextNode(item.text));
  a.firstChild.alt='';a.onclick=e=>{e.preventDefault();route(tabNames[i],'reset');};$('tabs').append(a);
});
$('back').onclick=back;
route('index','reset');
