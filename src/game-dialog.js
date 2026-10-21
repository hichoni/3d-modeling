// Game-style dialog text: types a line out character by character, then shows the ▼ "next" cue.
// Screen readers get the whole line at once from a hidden copy; reduced motion shows it immediately.
(function(root){
const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function live(el){
 if(el._live)return el._live;
 const copy=document.createElement('span');copy.className='sr-only';copy.setAttribute('aria-live','polite');el.after(copy);el.setAttribute('aria-hidden','true');return el._live=copy;
}
function finish(el){clearTimeout(el._timer);el.textContent=el.dataset.full||'';el.closest('.game-dialog')?.classList.remove('is-typing');el.onDone?.();}
// Repeated calls with the same line (status refreshes) keep the current animation instead of restarting it.
function say(el,text,{speed=28,onDone}={}){
 if(!el)return;text=String(text||'');el.onDone=onDone;
 if(el.dataset.full===text&&el.textContent)return;
 clearTimeout(el._timer);el.dataset.full=text;live(el).textContent=text;
 const box=el.closest('.game-dialog');
 if(reduced()||!text){finish(el);return;}
 const chars=[...text];let i=0;el.textContent='';box?.classList.add('is-typing');
 const tick=()=>{i++;el.textContent=chars.slice(0,i).join('');if(i>=chars.length)return finish(el);el._timer=setTimeout(tick,/[.!?…]/.test(chars[i-1])?speed*7:/[,·]/.test(chars[i-1])?speed*3:speed);};
 tick();
}
// Clicking a dialog while it types completes the line, as in most games.
document.addEventListener('click',e=>{const box=e.target.closest?.('.game-dialog.is-typing');if(box)for(const el of box.querySelectorAll('[data-full]'))finish(el);});
root.GameDialog={say,finish};
})(globalThis);
