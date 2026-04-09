/* Sukoon Shell JS — page transitions + scroll-reveal */
(function() {
  'use strict';

  /* ---- Page transitions ---- */
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript') ||
        href.startsWith('tel:') || href.startsWith('mailto:') ||
        link.target === '_blank' || e.ctrlKey || e.metaKey) return;
    // Only local links
    if (href.startsWith('http') && !href.includes(location.host)) return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(function() { window.location.href = href; }, 150);
  });

  /* ---- Scroll-reveal (IntersectionObserver) ---- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    // Observe on DOMContentLoaded (or now if already loaded)
    function observe() {
      document.querySelectorAll('.fade-up, .scale-in').forEach(function(el) {
        io.observe(el);
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observe);
    } else {
      observe();
    }
  } else {
    // Fallback: just show everything
    document.querySelectorAll('.fade-up, .scale-in').forEach(function(el) {
      el.classList.add('visible');
    });
  }
})();
