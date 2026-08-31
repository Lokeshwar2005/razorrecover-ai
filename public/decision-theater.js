(() => {
  const inject = () => {
    if (document.querySelector('[data-rz-overview]')) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const copy = hero.querySelector('.heroCopy');
    if (!copy) return;

    const intro = document.createElement('div');
    intro.dataset.rzOverview = 'true';
    intro.className = 'rz-overview-strip';
    intro.innerHTML = `
      <div class="rz-overview-kicker">WHAT THIS DOES</div>
      <div class="rz-overview-title">Find lost payments. Choose the safest recovery. Prove the money came back.</div>
      <div class="rz-overview-grid">
        <div><b>For</b><span>Payments, subscriptions & receivables teams</span></div>
        <div><b>Detect</b><span>Failed, abandoned and overdue revenue</span></div>
        <div><b>Act</b><span>Bounded retry, payment link, voice & human escalation</span></div>
      </div>
      <div class="rz-overview-note"><span>01</span> Detect leakage <i>→</i> <span>02</span> Diagnose <i>→</i> <span>03</span> Recover <i>→</i> <span>04</span> Verify & audit</div>
    `;
    copy.appendChild(intro);

    const style = document.createElement('style');
    style.textContent = `
      .rz-overview-strip{margin-top:24px;padding:18px 20px;border:1px solid rgba(231,214,179,.16);border-radius:14px;background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.018));max-width:760px}
      .rz-overview-kicker{font-size:10px;letter-spacing:.16em;font-weight:700;color:#c99b4b;margin-bottom:7px}
      .rz-overview-title{font-size:17px;line-height:1.35;font-weight:650;color:#eee7d9;max-width:680px}
      .rz-overview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
      .rz-overview-grid>div{display:flex;flex-direction:column;gap:4px;padding:10px 11px;border-radius:10px;background:rgba(0,0,0,.18)}
      .rz-overview-grid b{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#b99458}
      .rz-overview-grid span{font-size:11px;line-height:1.4;color:#aaa398}
      .rz-overview-note{display:flex;align-items:center;gap:8px;margin-top:15px;font-size:11px;color:#8f8a82;flex-wrap:wrap}
      .rz-overview-note span{color:#e8dfcf;font-weight:700}.rz-overview-note i{color:#b99458;font-style:normal}
      @media(max-width:720px){.rz-overview-grid{grid-template-columns:1fr}.rz-overview-title{font-size:15px}}
    `;
    document.head.appendChild(style);
  };

  const observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  inject();
  window.setTimeout(() => { inject(); observer.disconnect(); }, 3000);
})();
