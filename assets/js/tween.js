/* ============================================================
   tween.js — ちいさな補間エンジン
   CSS変数を rAF で動かす。ボタンの沈み込み・持ち上がりは全部これ。
   ============================================================ */
(function (global) {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- イージング --------------------------------------- */
  var ease = {
    linear:  function (t) { return t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutQuad: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    outExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    outBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    inOutBack: function (t) {
      var c2 = 1.70158 * 1.525;
      return t < .5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },
    outElastic: function (t) {
      var c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c4) + 1;
    },
    outBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375;
      return n1 * (t -= 2.625 / d1) * t + .984375;
    },
    /* ドット絵らしく段つきで動かしたいとき */
    steps: function (n) {
      return function (t) { return Math.min(1, Math.floor(t * n + 1e-6) / (n - 1)); };
    }
  };

  /* --- 本体 --------------------------------------------- */
  function tween(o) {
    var from = o.from, to = o.to,
        dur = REDUCED ? 0 : (o.dur == null ? 400 : o.dur),
        fn = typeof o.ease === 'function' ? o.ease : (ease[o.ease] || ease.outQuad),
        delay = REDUCED ? 0 : (o.delay || 0),
        start = null, raf = 0, dead = false;

    function step(now) {
      if (dead) return;
      if (start === null) start = now;
      var e = now - start - delay;
      if (e < 0) { raf = requestAnimationFrame(step); return; }
      var t = dur <= 0 ? 1 : Math.min(1, e / dur);
      var v = from + (to - from) * fn(t);
      if (o.onUpdate) o.onUpdate(v, t);
      if (t < 1) raf = requestAnimationFrame(step);
      else if (o.onDone) o.onDone();
    }
    raf = requestAnimationFrame(step);

    return { cancel: function () { dead = true; cancelAnimationFrame(raf); } };
  }

  /* --- CSS変数を補間する（同じ変数の二重掛けは自動キャンセル） --- */
  var REG = new WeakMap();
  function varTo(el, name, to, opt) {
    opt = opt || {};
    var unit = opt.unit == null ? 'px' : opt.unit;
    var map = REG.get(el);
    if (!map) { map = {}; REG.set(el, map); }
    if (map[name] && map[name].h) map[name].h.cancel();

    var cur = map[name] ? map[name].v : parseFloat(getComputedStyle(el).getPropertyValue(name));
    if (isNaN(cur)) cur = opt.from == null ? 0 : opt.from;

    map[name] = { v: cur, h: null };
    map[name].h = tween({
      from: cur, to: to, dur: opt.dur, ease: opt.ease, delay: opt.delay,
      onUpdate: function (v) {
        map[name].v = v;
        el.style.setProperty(name, unit ? (Math.round(v * 100) / 100) + unit : String(v));
      },
      onDone: opt.onDone
    });
    return map[name].h;
  }

  /* --- 補間を挟まず即値で入れる（ドラッグ中など） --------- */
  function setVar(el, name, v, unit) {
    var map = REG.get(el);
    if (!map) { map = {}; REG.set(el, map); }
    if (map[name] && map[name].h) map[name].h.cancel();
    map[name] = { v: v, h: null };
    el.style.setProperty(name, unit == null ? String(v) : v + unit);
  }

  /* --- 数字カウンタ ------------------------------------- */
  function count(el, to, opt) {
    opt = opt || {};
    tween({
      from: opt.from || 0, to: to, dur: opt.dur || 1100, ease: opt.ease || 'outExpo',
      delay: opt.delay || 0,
      onUpdate: function (v) { el.textContent = Math.round(v); }
    });
  }

  global.TW = { ease: ease, tween: tween, varTo: varTo, setVar: setVar, count: count, reduced: REDUCED };
})(window);
