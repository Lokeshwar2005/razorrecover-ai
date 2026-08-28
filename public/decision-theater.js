(() => {
  const STYLE = `
    .rr-theater-launch{margin:12px 0 0;padding:10px 14px;border:1px solid rgba(228,166,65,.55);border-radius:9px;background:linear-gradient(135deg,#1b1710,#0f0d0a);color:#eadfcf;font-size:10px;font-weight:800;letter-spacing:.08em;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.22);transition:transform .2s,border-color .2s}
    .rr-theater-launch:hover{transform:translateY(-2px);border-color:#e4a641}
    .rr-theater{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:rgba(3,3,2,.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;pointer-events:none;transition:opacity .25s}
    .rr-theater.open{opacity:1;pointer-events:auto}
    .rr-theater-card{width:min(1040px,96vw);max-height:92vh;overflow:auto;border:1px solid #3a3022;border-radius:18px;background:radial-gradient(700px 360px at 50% 0,rgba(228,166,65,.11),transparent 60%),linear-gradient(145deg,#15120e,#090806);box-shadow:0 35px 100px rgba(0,0,0,.55);padding:24px}
    .rr-theater-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #2b261f;padding-bottom:18px}
    .rr-theater-kicker{color:#c48c38;font-size:9px;font-weight:900;letter-spacing:.2em}.rr-theater-title{margin:7px 0 4px;font-size:clamp(25px,4vw,43px);letter-spacing:-.06em}.rr-theater-sub{margin:0;color:#817a70;font-size:11px;line-height:1.6}
    .rr-close{border:1px solid #3a3022;background:#11100d;color:#aaa093;border-radius:8px;width:34px;height:34px;cursor:pointer}
    .rr-flow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:22px 0}
    .rr-stage{position:relative;min-height:128px;padding:14px;border:1px solid #29251f;border-radius:11px;background:rgba(18,16,13,.9);overflow:hidden}
    .rr-stage:after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:2px;background:#33291d}.rr-stage.live:after{background:#e4a641;box-shadow:0 0 16px rgba(228,166,65,.8)}
    .rr-num{font-size:8px;color:#7d756a;letter-spacing:.16em}.rr-stage b{display:block;margin:14px 0 6px;font-size:12px}.rr-stage span{display:block;color:#777066;font-size:9px;line-height:1.5}
    .rr-stage .rr-mark{color:#70d09b;font-size:15px;font-weight:900;margin:0}.rr-flow-arrow{display:none}
    .rr-evidence{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.rr-box{border:1px solid #29251f;border-radius:11px;background:#0f0d0a;padding:16px}.rr-box h3{font-size:10px;margin:0 0 12px;letter-spacing:.12em;color:#c48c38}.rr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rr-stat{padding:11px;border:1px solid #25211b;border-radius:8px}.rr-stat small{display:block;color:#625c54;font-size:7px;letter-spacing:.12em;margin-bottom:5px}.rr-stat b{font-size:13px}.rr-explain{font-size:10px;line-height:1.7;color:#a39a8c}.rr-explain strong{color:#e4d8c7}.rr-footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:#5e584f;font-size:8px;letter-spacing:.1em}.rr-live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#70d09b;box-shadow:0 0 10px #70d09b;margin-right:6px}
    @media(max-width:720px){.rr-theater{padding:10px}.rr-theater-card{padding:16px;border-radius:14px}.rr-flow{grid-template-columns:1fr}.rr-stage{min-height:82px}.rr-stage b{margin:8px 0 4px}.rr-evidence{grid-template-columns:1fr}.rr-grid{grid-template-columns:1fr 1fr}.rr-theater-head{gap:10px}.rr-footer{display:block}.rr-footer span{display:block;margin-top:7px}}
    @media(prefers-reduced-motion:reduce){.rr-theater,.rr-theater-launch{transition:none}}
  `;
  const style=document.createElement('style'); style.textContent=STYLE; document.head.appendChild(style);

  let selected={id:'TXN-1042',amount:'₹2,499',reason:'Gateway degradation',confidence:'94%',recovery:'82%',risk:'28/100',policy:'Recovered'};
  const parseDetails=()=>{
    const strip=document.querySelector('.detailStrip'); if(!strip) return;
    const cells=[...strip.children];
    const text=i=>cells[i]?.innerText?.trim()||'';
    selected.id=text(0).split('\n').pop()||selected.id;
    selected.reason=text(1).split('\n').pop()||selected.reason;
    selected.confidence=text(2).split('\n').pop()||selected.confidence;
    selected.recovery=text(3).split('\n').pop()||selected.recovery;
    selected.risk=text(4).split('\n').pop()||selected.risk;
    selected.policy=text(5).split('\n').pop()||selected.policy;
    const row=document.querySelector('.row.selected'); if(row){const cells=[...row.children];selected.amount=cells[1]?.innerText||selected.amount}
  };
  const theater=()=>document.querySelector('.rr-theater');
  const render=()=>{
    parseDetails();
    const riskNum=parseInt(selected.risk)||0;
    const approved=selected.policy==='Recovered'||selected.policy==='Approved';
    const el=theater(); if(!el)return;
    el.querySelector('[data-id]').textContent=selected.id;
    el.querySelector('[data-amount]').textContent=selected.amount;
    el.querySelector('[data-reason]').textContent=selected.reason;
    el.querySelector('[data-confidence]').textContent=selected.confidence;
    el.querySelector('[data-recovery]').textContent=selected.recovery;
    el.querySelector('[data-risk]').textContent=selected.risk;
    el.querySelector('[data-policy]').textContent=selected.policy;
    el.querySelector('[data-explain]').innerHTML=approved
      ? `<strong>${selected.reason}</strong> was classified as recoverable. Confidence is ${selected.confidence}; the policy boundary keeps risk at ${selected.risk}. The selected intervention is bounded and requires verification before the recovered amount is counted.`
      : `<strong>${selected.reason}</strong> crossed a safety boundary. The agent refuses uncontrolled money movement, records the exception, and routes the event for escalation.`;
    el.querySelectorAll('.rr-stage').forEach((s,i)=>s.classList.toggle('live',i===4));
  };
  const open=()=>{render();const el=theater();el.classList.add('open');document.body.style.overflow='hidden'};
  const close=()=>{const el=theater();el.classList.remove('open');document.body.style.overflow=''};
  const mount=()=>{
    if(document.querySelector('.rr-theater'))return;
    const detail=document.querySelector('.detailStrip'); if(!detail)return;
    const button=document.createElement('button');button.className='rr-theater-launch';button.textContent='OPEN DECISION THEATER ↗';button.addEventListener('click',open);detail.after(button);
    const wrap=document.createElement('div');wrap.className='rr-theater';wrap.innerHTML=`<div class="rr-theater-card" role="dialog" aria-modal="true" aria-label="Transaction decision theater"><div class="rr-theater-head"><div><div class="rr-theater-kicker">TRANSACTION DECISION THEATER</div><h2 class="rr-theater-title">One payment. One explainable decision.</h2><p class="rr-theater-sub">Watch the recovery agent move a single synthetic transaction through diagnosis, policy, intervention and verification.</p></div><button class="rr-close" aria-label="Close">×</button></div><div class="rr-flow"><div class="rr-stage"><div class="rr-num">01 / DETECT</div><b>Signal captured</b><span>Payment failure enters the recovery stream.</span></div><div class="rr-stage"><div class="rr-num">02 / DIAGNOSE</div><b>Root cause classified</b><span data-reason>Gateway degradation</span></div><div class="rr-stage"><div class="rr-num">03 / DECIDE</div><b>Policy gate</b><span>Risk and retry boundaries evaluated.</span></div><div class="rr-stage"><div class="rr-num">04 / RECOVER</div><b>Bounded intervention</b><span>Only an approved recovery action may execute.</span></div><div class="rr-stage"><div class="rr-num">05 / VERIFY</div><b><span class="rr-mark">✓</span> Outcome verified</b><span>Recovery is counted only after verification.</span></div></div><div class="rr-evidence"><div class="rr-box"><h3>LIVE DECISION EVIDENCE</h3><div class="rr-grid"><div class="rr-stat"><small>EVENT</small><b data-id>TXN-1042</b></div><div class="rr-stat"><small>AMOUNT</small><b data-amount>₹2,499</b></div><div class="rr-stat"><small>AI CONFIDENCE</small><b data-confidence>94%</b></div><div class="rr-stat"><small>RECOVERY PROB.</small><b data-recovery>82%</b></div><div class="rr-stat"><small>RISK SCORE</small><b data-risk>28/100</b></div><div class="rr-stat"><small>POLICY RESULT</small><b data-policy>Recovered</b></div></div></div><div class="rr-box"><h3>WHY THE AGENT DID THIS</h3><div class="rr-explain" data-explain>Gateway degradation was classified as recoverable. The agent stays inside bounded retry and verification rules.</div></div></div><div class="rr-footer"><span><i class="rr-live-dot"></i>SYNTHETIC · DETERMINISTIC · NO REAL FUNDS</span><span>Every money action → explainable · bounded · gated · audited</span></div></div>`;
    wrap.addEventListener('click',e=>{if(e.target===wrap)close()});wrap.querySelector('.rr-close').addEventListener('click',close);document.body.appendChild(wrap);
  };
  const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&theater()?.classList.contains('open'))close()});
  setTimeout(mount,500);
})();
