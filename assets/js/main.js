/* ============================================================
   main.js — 全部の配線
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = TW.reduced;

  /* 年齢はここだけで決める（誕生日は 2004年7月17日） */
  var BIRTH = { y: 2004, m: 7, d: 17 };
  function age() {
    var t = new Date(), a = t.getFullYear() - BIRTH.y;
    var mo = (t.getMonth() + 1) - BIRTH.m;
    if (mo < 0 || (mo === 0 && t.getDate() < BIRTH.d)) a--;
    return a;
  }
  $$('[data-age]').forEach(function (el) { el.textContent = age(); });

  /* 公開リポジトリ数は GitHub から。取れなければ HTML の値のまま */
  (function repoCount() {
    var el = $('#repoCount');
    if (!el) return;
    var KEY = 'gp-repos', cached = sessionStorage.getItem(KEY);
    if (cached) el.textContent = cached;
    fetch('https://api.github.com/users/Geppetto-s-Puppet')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.public_repos !== 'number') return;
        el.textContent = d.public_repos;
        sessionStorage.setItem(KEY, d.public_repos);
      })
      .catch(function () {});
  })();

  /* 流れる文字：1本が画面幅より短いと途中で切れて見えるので、
     幅を超えるまで繰り返してから2本並べる（-50%動かすと繋がる） */
  (function ticker() {
    var box = $('#tickerIn');
    if (!box) return;
    function build() {
      var unit = $('.ticker__unit', box);
      if (!unit) return;
      var txt = unit.dataset.txt || (unit.dataset.txt = unit.textContent);
      unit.textContent = txt;
      var guard = 0;
      while (unit.offsetWidth < innerWidth && guard++ < 20) unit.textContent += txt;
      var twin = unit.cloneNode(true);
      box.innerHTML = '';
      box.appendChild(unit);
      box.appendChild(twin);
    }
    build();
    var t = 0;
    addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var u = $('.ticker__unit', box);
        if (u && u.offsetWidth < innerWidth) build();
      }, 200);
    });
  })();

  /* ══════════ 1. ローディング ══════════ */
  (function boot() {
    var el = $('#boot'), bar = $('#bootBar'), dots = $('#bootDots');
    var n = 0;
    setInterval(function () { n = (n + 1) % 4; dots.textContent = '....'.slice(0, n); }, 320);

    var done = false;
    function finish() {
      if (done) return; done = true;
      TW.varTo(bar, 'width', 100, { unit: '%', dur: 260, ease: 'outQuad' });
      setTimeout(function () { el.classList.add('is-done'); document.body.classList.add('is-ready'); }, 320);
    }
    TW.tween({
      from: 0, to: 88, dur: 900, ease: 'outCubic',
      onUpdate: function (v) { bar.style.width = v + '%'; }
    });
    var waits = [new Promise(function (r) { setTimeout(r, reduced ? 200 : 1000); })];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    Promise.all(waits).then(finish);
    setTimeout(finish, 3500);
    el.addEventListener('click', finish);
  })();

  /* ══════════ 2. 花びら ══════════ */
  (function petals() {
    if (reduced) return;
    var box = $('#petals');
    for (var i = 0; i < 22; i++) {
      var p = document.createElement('span');
      p.className = 'petal' + (i % 3 === 0 ? ' petal--w' : '');
      p.style.left = (Math.random() * 100) + '%';
      p.style.animationDuration = (9 + Math.random() * 12) + 's,' + (2 + Math.random() * 3) + 's';
      p.style.animationDelay = (-Math.random() * 20) + 's,' + (-Math.random() * 4) + 's';
      p.style.opacity = (.3 + Math.random() * .4).toFixed(2);
      var sc = Math.random() < .3 ? .5 : 1;
      p.style.width = p.style.height = (6 * sc) + 'px';
      box.appendChild(p);
    }
  })();

  /* ══════════ 3. 背景のドット絵 ══════════ */
  var scene = new PixelScene($('#scene'), $('#sceneWrap'));

  /* ══════════ 4. 作品サムネ・ポラロイドの背景 ══════════ */
  $$('.thumb').forEach(function (cv) {
    var w = 140, h = 84;                                  /* 5:3 */
    if (cv.classList.contains('thumb--stamp')) { w = 48; h = 60; }
    else if (cv.classList.contains('thumb--slide')) { w = 220; h = 132; }
    drawThumb(cv, parseInt(cv.dataset.seed, 10) || 1, w, h);
  });

  function paintPolaroid() {
    var cv = $('#polaBg');
    if (cv && window.drawSakura) drawSakura(cv, 150, 200);
  }
  paintPolaroid();

  /* ══════════ 5. 出現アニメーション ══════════ */
  (function reveal() {
    var items = $$('[data-rv]');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      fillStats(document);
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.setProperty('--rvd', (el.dataset.rvD || 0) + 'ms');
        el.classList.add('is-in');
        fillStats(el);
        io.unobserve(el);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  function fillStats(root) {
    $$('.bar i', root).forEach(function (b, i) {
      TW.varTo(b, 'width', +b.dataset.val, { unit: '%', dur: 1100, ease: 'outExpo', delay: 120 + i * 90 });
    });
    $$('[data-count]', root).forEach(function (c, i) {
      TW.count(c, +c.dataset.count, { dur: 1200, delay: 120 + i * 90 });
    });
  }

  /* ══════════ 6. ボタンの tween ══════════ */
  function bind(el, states) {
    function go(s) {
      var o = states[s];
      for (var k in o) TW.varTo(el, k, o[k].v, { unit: o[k].u, dur: o[k].d, ease: o[k].e });
    }
    el.addEventListener('pointerenter', function () { go('in'); });
    el.addEventListener('pointerleave', function () { go('out'); });
    el.addEventListener('pointerdown', function () { go('down'); });
    el.addEventListener('pointerup', function () { go('in'); });
    el.addEventListener('focus', function () { go('in'); });
    el.addEventListener('blur', function () { go('out'); });
  }
  var V = function (v, u, d, e) { return { v: v, u: u == null ? 'px' : u, d: d || 300, e: e || 'outBack' }; };

  $$('[data-tw="press"]').forEach(function (el) {
    bind(el, {
      in: { '--ty': V(-4, 'px', 260), '--sd': V(12, 'px', 260) },
      out: { '--ty': V(0, 'px', 320), '--sd': V(8, 'px', 320) },
      down: { '--ty': V(4, 'px', 90, 'outQuad'), '--sd': V(4, 'px', 90, 'outQuad') }
    });
  });
  $$('[data-tw="lift"]').forEach(function (el) {
    bind(el, {
      in: { '--ty': V(-8, 'px', 420), '--sd': V(16, 'px', 420) },
      out: { '--ty': V(0, 'px', 460), '--sd': V(8, 'px', 460) },
      down: { '--ty': V(-2, 'px', 120, 'outQuad'), '--sd': V(10, 'px', 120, 'outQuad') }
    });
  });
  $$('.facts__cta a, .repos-link').forEach(function (el) {
    bind(el, {
      in: { '--ty': V(-4, 'px', 280, 'outBack') },
      out: { '--ty': V(0, 'px', 300, 'outBack') },
      down: { '--ty': V(2, 'px', 90, 'outQuad') }
    });
  });
  $$('.slot').forEach(function (el) {
    bind(el, {
      in: { '--ty': V(-6, 'px', 280, 'outBack') },
      out: { '--ty': V(0, 'px', 320, 'outBack') },
      down: { '--ty': V(2, 'px', 90, 'outQuad') }
    });
  });

  /* ══════════ 7. ヘッダーとナビ ══════════ */
  (function nav() {
    var hud = $('#hudTop'), navEl = $('#nav'), btn = $('#menuBtn');
    var last = 0;

    addEventListener('scroll', function () {
      var y = scrollY;
      hud.classList.toggle('is-solid', y > 40);
      if (!navEl.classList.contains('is-open')) {
        hud.classList.toggle('is-hide', y > last && y > 280);
      }
      last = y;
    }, { passive: true });

    btn.addEventListener('click', function () {
      var open = navEl.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('.nav__a').forEach(function (a) {
      a.addEventListener('click', function () {
        navEl.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    var links = $$('.nav__a');
    var secs = links.map(function (a) { return $(a.getAttribute('href')); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = secs.indexOf(e.target);
        links.forEach(function (a, j) { a.classList.toggle('is-on', i === j); });
      });
    }, { threshold: .01, rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { if (s) io.observe(s); });
  })();

  /* ══════════ 8. 路線の進行度 ══════════ */
  (function rail() {
    var fill = $('#railFill'), train = $('#railTrain'), box = $('.rail');
    var cur = 0, aim = 0;
    function calc() {
      var max = document.documentElement.scrollHeight - innerHeight;
      aim = max <= 0 ? 0 : Math.min(1, Math.max(0, scrollY / max));
    }
    addEventListener('scroll', calc, { passive: true });
    addEventListener('resize', calc);
    calc();
    (function loop() {
      cur += (aim - cur) * .12;
      var h = box.clientHeight;
      fill.style.height = (cur * h) + 'px';
      train.style.transform = 'translateY(' + (cur * (h - 20)) + 'px)';
      requestAnimationFrame(loop);
    })();
  })();

  /* ══════════ 9. 時間帯の切り替え ══════════ */
  (function theme() {
    var wipe = $('#wipe'), btns = $$('.tsw');
    var saved = localStorage.getItem('gp-theme');
    if (saved) set(saved, true);

    function set(name, silent) {
      document.documentElement.dataset.theme = name;
      localStorage.setItem('gp-theme', name);
      btns.forEach(function (b) {
        var on = b.dataset.themeSet === name;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      /* 背景のドット絵は CSS 変数を見ているので、描き直せば色が変わる */
      requestAnimationFrame(function () {
        if (scene) scene.buildBG();
        paintPolaroid();
      });
      if (!silent && !reduced) {
        wipe.classList.remove('is-on');
        void wipe.offsetWidth;
        wipe.classList.add('is-on');
      }
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { set(b.dataset.themeSet); });
    });
  })();

  /* ══════════ 10. BGM（Snowdrop / Kyatto） ══════════ */
  (function bgm() {
    var a = $('#bgm'), box = $('#player'), btn = $('#playBtn'), vol = $('#vol');
    if (!a) return;
    function applyVol() { a.volume = Math.pow(vol.value / 100, 1.6) * .85; }
    applyVol();

    btn.addEventListener('click', function () {
      if (a.paused) {
        a.play().then(function () {
          box.classList.add('is-play');
          btn.textContent = '■';
        }).catch(function () {
          /* 自動再生がブロックされた場合はそのまま */
        });
      } else {
        a.pause();
        box.classList.remove('is-play');
        btn.textContent = '▶';
      }
    });
    vol.addEventListener('input', applyVol);
    a.addEventListener('ended', function () { box.classList.remove('is-play'); btn.textContent = '▶'; });
  })();

  /* ══════════ 11. もちもの ══════════ */
  (function inventory() {
    var slots = $$('.slot'), name = $('#invName'), text = $('#invText'), lv = $('#invLv');
    var picked = null;
    function show(s) {
      picked = s;
      slots.forEach(function (o) { o.classList.toggle('is-on', o === s); });
      name.textContent = s.dataset.n;
      text.textContent = s.dataset.d;
      lv.textContent = 'RANK ' + s.dataset.lv + '  ' + '★'.repeat({ A: 3, B: 2, C: 1 }[s.dataset.lv] || 1);
    }
    slots.forEach(function (s) {
      s.addEventListener('pointerenter', function () { show(s); });
      s.addEventListener('focus', function () { show(s); });
      s.addEventListener('click', function () { show(s); });
    });
    document.addEventListener('langchange', function () { if (picked) show(picked); });
  })();

  /* ══════════ 12. 会話ウィンドウ ══════════ */
  (function talk() {
    var el = $('#talkTxt'), cur = $('#talkNext');
    if (!el) return;
    var lines = [], li = 0, ci = 0, typing = false, timer = 0, started = false;

    function load() {
      var en = document.documentElement.lang === 'en' && el.dataset.linesEn;
      lines = (en ? el.dataset.linesEn : el.dataset.lines).split('|');
      li = 0; ci = 0;
    }
    load();

    function type() {
      typing = true; cur.style.visibility = 'hidden';
      clearInterval(timer);
      timer = setInterval(function () {
        ci++;
        el.textContent = lines[li].slice(0, ci);
        if (ci >= lines[li].length) {
          clearInterval(timer); typing = false; cur.style.visibility = 'visible';
        }
      }, reduced ? 0 : 34);
    }
    function nextLine() {
      if (typing) {
        clearInterval(timer); el.textContent = lines[li]; ci = lines[li].length;
        typing = false; cur.style.visibility = 'visible'; return;
      }
      li = (li + 1) % lines.length; ci = 0; el.textContent = ''; type();
    }
    el.parentNode.addEventListener('click', nextLine);
    document.addEventListener('langchange', function () { load(); el.textContent = ''; if (started) type(); });

    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { started = true; type(); io.disconnect(); }
    }, { threshold: .4 });
    io.observe(el);
  })();

  /* ══════════ 13. 代表作カルーセル ══════════ */
  (function pick() {
    var root = $('#pick');
    if (!root) return;
    var view = $('#pickView'), track = $('#pickTrack'), dots = $('#pDots'), now = $('#pNow');
    var slides = $$('.slide', track), n = slides.length;
    var i = 0, timer = 0, dragging = false, startX = 0, base = 0;

    slides.forEach(function (s, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', (k + 1) + ' / ' + n);
      b.addEventListener('click', function () { halt(); go(k); });
      dots.appendChild(b);
    });
    var dotEls = $$('button', dots);

    function paint() {
      dotEls.forEach(function (d, k) {
        d.classList.toggle('is-on', k === i);
        d.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      now.textContent = ('0' + (i + 1)).slice(-2);
    }
    function go(k, instant) {
      i = ((k % n) + n) % n;
      if (instant) TW.setVar(track, '--sx', -i * 100, '%');
      else TW.varTo(track, '--sx', -i * 100, { unit: '%', dur: 620, ease: 'outExpo' });
      paint();
    }

    function halt() { clearInterval(timer); timer = 0; }
    if (!reduced) timer = setInterval(function () { go(i + 1); }, 7000);

    $('#pPrev').addEventListener('click', function () { halt(); go(i - 1); });
    $('#pNext').addEventListener('click', function () { halt(); go(i + 1); });

    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a,button')) return;
      dragging = true; startX = e.clientX; base = -i * 100;
      halt();
      view.classList.add('is-drag');
      try { view.setPointerCapture(e.pointerId); } catch (err) {}
    });
    view.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      TW.setVar(track, '--sx', base + (e.clientX - startX) / view.clientWidth * 100, '%');
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      view.classList.remove('is-drag');
      var d = e.clientX - startX;
      if (Math.abs(d) > view.clientWidth * .12) go(i + (d < 0 ? 1 : -1));
      else go(i);
    }
    view.addEventListener('pointerup', release);
    view.addEventListener('pointercancel', release);

    addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var r = root.getBoundingClientRect();
      if (r.bottom < 120 || r.top > innerHeight - 120) return;
      halt();
      go(i + (e.key === 'ArrowRight' ? 1 : -1));
    });

    track.addEventListener('focusin', function (e) {
      var s = e.target.closest('.slide'), k = slides.indexOf(s);
      if (k >= 0 && k !== i) { halt(); go(k); }
      view.scrollLeft = 0;
    });

    var shots = $('#itrShots'), main = $('#itrMain'), lab = $('#itrLabel');
    if (shots && main) {
      $$('button', shots).forEach(function (b) {
        if (b.dataset.src === main.getAttribute('src')) b.classList.add('is-on');
        b.addEventListener('click', function () {
          main.src = b.dataset.src;
          if (lab && b.dataset.lab) lab.textContent = b.dataset.lab;
          $$('button', shots).forEach(function (o) { o.classList.toggle('is-on', o === b); });
        });
      });
    }

    go(0, true);
  })();

  /* ══════════ 14. 日本語 / English ══════════ */
  (function lang() {
    var btn = $('#langBtn');
    if (!btn) return;
    var nodes = $$('[data-en]');
    nodes.forEach(function (el) { el.dataset.ja = el.innerHTML; });

    var slots = $$('.slot');
    slots.forEach(function (s) { s.dataset.nJa = s.dataset.n; s.dataset.dJa = s.dataset.d; });

    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function set(l) {
      document.documentElement.lang = l;
      document.body.dataset.lang = l;
      nodes.forEach(function (el) {
        el.innerHTML = l === 'en' ? esc(el.dataset.en).replace(/\|/g, '<br>') : el.dataset.ja;
      });
      slots.forEach(function (s) {
        s.dataset.n = (l === 'en' && s.dataset.nEn) ? s.dataset.nEn : s.dataset.nJa;
        s.dataset.d = (l === 'en' && s.dataset.dEn) ? s.dataset.dEn : s.dataset.dJa;
      });
      btn.setAttribute('aria-label', l === 'en' ? '日本語に切り替え' : 'Switch to English');
      localStorage.setItem('gp-lang', l);
      document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
    }

    document.body.dataset.lang = 'ja';
    btn.addEventListener('click', function () {
      set(document.documentElement.lang === 'en' ? 'ja' : 'en');
    });
    if (localStorage.getItem('gp-lang') === 'en') set('en');
  })();

  /* ══════════ 15. TOP へ ══════════ */
  $('#toTop').addEventListener('click', function () {
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

})();
