(() => {
  const sectionFor = (label) => {
    if (label === 'Overview') return document.querySelector('.hero');
    if (label === 'Simulation') return document.querySelector('.lab');
    if (label === 'Agent trace') return document.querySelector('.tracePanel');
    if (label === 'Audit trail') {
      return [...document.querySelectorAll('.panel')].find((el) => /audit trail/i.test(el.textContent || '')) || document.querySelector('.audit');
    }
    return null;
  };

  const wire = () => {
    const navButtons = [...document.querySelectorAll('.navTabs button')];
    if (!navButtons.length) return false;

    navButtons.forEach((button) => {
      if (button.dataset.journeyWired) return;
      button.dataset.journeyWired = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const target = sectionFor(button.textContent.trim());
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        navButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
      });
    });

    const targets = navButtons.map((button) => ({ button, target: sectionFor(button.textContent.trim()) })).filter((item) => item.target);
    if (targets.length && !window.__razorJourneyObserver) {
      window.__razorJourneyObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const match = targets.find((item) => item.target === visible.target);
        if (!match) return;
        navButtons.forEach((item) => item.classList.remove('active'));
        match.button.classList.add('active');
      }, { rootMargin: '-18% 0px -62% 0px', threshold: [0.1, 0.35, 0.6] });
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
