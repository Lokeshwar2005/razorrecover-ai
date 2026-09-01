(() => {
  const sectionFor = (label) => {
    const clean = (label || '').toLowerCase();
    if (clean.includes('overview')) return document.querySelector('.hero');
    if (clean.includes('simulation')) return document.querySelector('.lab') || document.querySelector('#recovery-playbooks');
    if (clean.includes('agent trace')) return document.querySelector('.tracePanel');
    if (clean.includes('audit trail')) {
      return [...document.querySelectorAll('.panel')].find((el) => /audit trail/i.test(el.textContent || '')) || document.querySelector('.audit') || document.querySelector('.tracePanel');
    }
    return null;
  };

  const wire = () => {
    const navButtons = [...document.querySelectorAll('.navTabs button, .mobileNavTabs button')];
    if (!navButtons.length) return false;

    navButtons.forEach((button) => {
      if (button.dataset.journeyWired) return;
      button.dataset.journeyWired = 'true';
      button.addEventListener('click', (event) => {
        const text = button.textContent.trim();
        const target = sectionFor(text);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // sync active state across all button matches
        const allMatching = navButtons.filter(b => b.textContent.trim() === text);
        navButtons.forEach((item) => item.classList.remove('active'));
        allMatching.forEach(m => m.classList.add('active'));
      });
    });

    const targets = ['Overview', 'Simulation', 'Agent trace', 'Audit trail']
      .map((name) => ({ name, target: sectionFor(name) }))
      .filter((item) => item.target);

    if (targets.length && !window.__razorJourneyObserver) {
      window.__razorJourneyObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const match = targets.find((item) => item.target === visible.target);
        if (!match) return;
        const currentButtons = [...document.querySelectorAll('.navTabs button, .mobileNavTabs button')];
        currentButtons.forEach((item) => {
          if (item.textContent.trim() === match.name) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      }, { rootMargin: '-15% 0px -55% 0px', threshold: [0.1, 0.3, 0.6] });

      targets.forEach(({ target }) => window.__razorJourneyObserver.observe(target));
    }
    return true;
  };

  const start = () => {
    if (wire()) return;
    const observer = new MutationObserver(() => wire());
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
