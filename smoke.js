if (new URLSearchParams(location.search).has('smoke')) (async () => {
  const result=document.createElement('output'); result.id='smoke'; result.textContent='RUNNING'; document.body.append(result);
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const tap=(selector)=>{const el=document.querySelector(selector);check(el,selector);el.click();};
  const input=(selector,value)=>{const el=document.querySelector(selector);check(el,selector);el.value=value;el.dispatchEvent(new Event('input'));};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try {
    check(stage.querySelector('.human-placeholder'),'original avatar placeholder');
    input('.text-input','测试文字');tap('.send-btn');await delay(450);
    check(active.data.messages.length===2,'chat response state');
    // Headless Chrome can suspend animation frames while virtual time advances.
    render();
    check(stage.querySelectorAll('.message-row').length===2,'chat bubbles');
    tap('#tabs a:nth-child(2)');check(stage.querySelector('.generate-btn'),'video form');
    check(stage.querySelector('select').selectedIndex===0,'default video duration');
    tap('#tabs a:nth-child(3)');check(stage.textContent.includes('测试文字'),'conversation history');
    tap('#tabs a:nth-child(4)');tap('.add-voice-btn');check(active.name==='voice-clone','voice subpage');
    tap('#back');check(active.name==='settings','return to settings');
    tap('#tabs a:first-child');tap('.ai-create-btn');check(active.name==='generate','image subpage');
    check(stage.querySelector('textarea'),'image prompt');
    tap('#back');check(active.name==='index','return to home');
    result.textContent='PASS: original routes, chat and history';
  } catch(error) {result.textContent='FAIL: '+error.message;}
})();
