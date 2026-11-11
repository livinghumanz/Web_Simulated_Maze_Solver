/*
 * RatRocket Arbeitsblaetter - tiny helper for every sheet and the index.
 *
 * 1. The "Drucken" button (#printBtn) calls window.print().
 * 2. Inside a frame (the learn.html self-test loads the sheets in an iframe)
 *    the page reports itself to its parent:
 *      sheet: { rrPrint: 'sheet', file, title, pages }
 *             file  = basename of location.pathname, pages = number of .sheet-page
 *      index: { rrPrint: 'index', links: [href of every a.sheet-link] }
 *             (body has data-print="index")
 * Plain ASCII, no external requests.
 */
(function () {
  'use strict';

  function wire() {
    try {
      var b = document.getElementById('printBtn');
      if (b) b.addEventListener('click', function () { window.print(); });
    } catch (e) { /* ignore */ }
  }

  function report() {
    try {
      if (window.parent === window) return;
      var msg;
      if (document.body && document.body.getAttribute('data-print') === 'index') {
        var links = [];
        var as = document.querySelectorAll('a.sheet-link');
        for (var i = 0; i < as.length; i++) links.push(as[i].getAttribute('href'));
        msg = { rrPrint: 'index', links: links };
      } else {
        var path = location.pathname.split('/');
        msg = {
          rrPrint: 'sheet',
          file: decodeURIComponent(path[path.length - 1] || ''),
          title: document.title,
          pages: document.querySelectorAll('.sheet-page').length,
        };
      }
      window.parent.postMessage(msg, '*');
    } catch (e) { /* ignore: a report is a convenience */ }
  }

  function start() { wire(); report(); }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
