/* ============================================================
   scene.js — 背景のドット絵を canvas にその場で描く
   低解像度（1ドット = 3〜5px）で描いて、CSS で整数倍に拡大する。
   色は CSS 変数から読むので、テーマを変えると絵も変わる。
   ============================================================ */
(function (global) {
  'use strict';

  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function rng(seed) {                       /* mulberry32 */
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 2色をディザで混ぜながら縦グラデーションを塗る */
  function ditherV(ctx, x0, y0, w, h, cA, cB, curve) {
    for (var y = 0; y < h; y++) {
      var r = h <= 1 ? 1 : y / (h - 1);
      if (curve) r = curve(r);
      for (var x = 0; x < w; x++) {
        var th = (BAYER[y & 3][x & 3] + .5) / 16;
        ctx.fillStyle = r > th ? cB : cA;
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  /* ══════════════════════════════════════════════════
     ヒーローの風景
     ══════════════════════════════════════════════════ */
  function PixelScene(canvas, wrap) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.wrap = wrap;
    this.bg = document.createElement('canvas');
    this.bgx = this.bg.getContext('2d');
    this.t0 = performance.now();
    this.visible = true;
    this.W = 0; this.H = 0; this.S = 4;
    this.clouds = [];
    this.stars = [];
    this.trainAt = -9999;
    this.resize();

    var self = this;
    addEventListener('resize', function () { self.resize(); });
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; },
        { threshold: 0 }).observe(wrap);
    }
    requestAnimationFrame(function loop(t) { self.frame(t); requestAnimationFrame(loop); });
  }

  PixelScene.prototype.pal = function () {
    return {
      sky1: css('--sky1'), sky2: css('--sky2'), sky3: css('--sky3'),
      sea1: css('--sea1'), sea2: css('--sea2'),
      land: css('--land'), grass: css('--grass'),
      sun: css('--sun'), hi: css('--hi'), paper: css('--paper'),
      ink: css('--ink'), pink: css('--pink'), accent: css('--accent'),
      night: document.documentElement.dataset.theme === 'night',
      /* 線路・電柱など構造物の色。夜は白く光りすぎないよう中間色にする */
      st: document.documentElement.dataset.theme === 'night' ? css('--sky3') : css('--ink')
    };
  };

  PixelScene.prototype.resize = function () {
    var r = this.wrap.getBoundingClientRect();
    var cw = Math.max(320, Math.ceil(r.width)), ch = Math.max(360, Math.ceil(r.height));
    this.S = cw < 700 ? 3 : (cw > 1600 ? 5 : 4);
    this.W = Math.ceil(cw / this.S);
    this.H = Math.ceil(ch / this.S);
    this.cv.width = this.W; this.cv.height = this.H;
    this.cv.style.width = (this.W * this.S) + 'px';
    this.cv.style.height = (this.H * this.S) + 'px';
    this.bg.width = this.W; this.bg.height = this.H;
    this.ctx.imageSmoothingEnabled = false;

    /* 雲と星を配置しなおす */
    var rn = rng(20260820), i;
    this.clouds = [];
    for (i = 0; i < 9; i++) {
      this.clouds.push({
        x: rn() * this.W, y: 10 + rn() * (this.H * .30),
        s: .5 + rn() * .5, k: (i % 3), sp: 1.6 + rn() * 2.6
      });
    }
    this.stars = [];
    for (i = 0; i < 70; i++) {
      this.stars.push({ x: (rn() * this.W) | 0, y: (rn() * this.H * .45) | 0, p: rn() * 6.28 });
    }
    this.buildBG();
  };

  /* 動かない部分をキャッシュ */
  PixelScene.prototype.buildBG = function () {
    var g = this.bgx, W = this.W, H = this.H, p = this.pal();
    var hz = Math.round(H * .60);          /* 水平線 */
    var seaB = Math.round(H * .76);        /* 海の下端 */
    var rail = Math.round(H * .885);       /* 線路 */
    this.hz = hz; this.seaB = seaB; this.rail = rail;

    g.clearRect(0, 0, W, H);

    /* --- 空：3色を2段のディザでつなぐ --- */
    var upper = Math.round(hz * .55);
    ditherV(g, 0, 0, W, upper, p.sky1, p.sky2);
    ditherV(g, 0, upper, W, hz - upper, p.sky2, p.sky3);

    /* --- 星（夜だけ） --- */
    if (p.night) {
      g.fillStyle = p.hi;
      for (var s = 0; s < this.stars.length; s += 2) {
        g.fillRect(this.stars[s].x, this.stars[s].y, 1, 1);
      }
    }

    /* --- 太陽（または月） --- */
    var sx = Math.round(W * .74), sy = Math.round(hz * .34), R = 9;
    g.fillStyle = p.sun;
    for (var y = -R; y <= R; y++) {
      var wRow = Math.floor(Math.sqrt(R * R - y * y));
      g.fillRect(sx - wRow, sy + y, wRow * 2 + 1, 1);
    }
    /* 光のにじみ */
    for (var ring = 1; ring <= 3; ring++) {
      var rr = R + ring * 3, step = ring + 1;
      for (var a = 0; a < 360; a += 6) {
        var px = sx + Math.round(Math.cos(a * Math.PI / 180) * rr);
        var py = sy + Math.round(Math.sin(a * Math.PI / 180) * rr);
        if ((px + py) % step === 0) { g.fillStyle = p.sun; g.fillRect(px, py, 1, 1); }
      }
    }
    if (p.night) {                      /* 月は欠けさせる */
      g.fillStyle = p.sky1;
      for (var my = -R; my <= R; my++) {
        var mw = Math.floor(Math.sqrt(R * R - my * my));
        g.fillRect(sx - mw + 5, sy + my - 3, mw * 2 + 1, 1);
      }
    }
    this.sunX = sx;

    /* --- 遠くの島 --- */
    var rn = rng(7788);
    g.fillStyle = p.land;
    var peakX = Math.round(W * .18), peakH = Math.round(H * .11);
    for (var ix = -1; ix < W; ix++) {
      var d = Math.abs(ix - peakX);
      var hgt = Math.max(0, peakH - Math.round(d * .42) - (rn() < .25 ? 1 : 0));
      if (hgt > 0) g.fillRect(ix, hz - hgt, 1, hgt);
    }
    var peak2 = Math.round(W * .40), p2h = Math.round(H * .07);
    for (var jx = -1; jx < W; jx++) {
      var d2 = Math.abs(jx - peak2);
      var h2 = Math.max(0, p2h - Math.round(d2 * .5));
      if (h2 > 0) g.fillRect(jx, hz - h2, 1, h2);
    }
    /* 陽の当たらない側を落とす */
    g.save();
    g.globalAlpha = .22; g.fillStyle = '#000';
    for (var sx2 = -1; sx2 < peakX; sx2++) {
      var ds = Math.abs(sx2 - peakX);
      var hs = Math.max(0, peakH - Math.round(ds * .42));
      if (hs > 0) g.fillRect(sx2, hz - hs, 1, hs);
    }
    g.restore();
    /* 稜線のきらめき */
    g.fillStyle = p.hi;
    for (var lx = peakX; lx < peakX + peakH * 2; lx += 2) {
      var lh = Math.max(0, peakH - Math.round((lx - peakX) * .42));
      if (lh > 1) g.fillRect(lx, hz - lh, 1, 1);
    }

    /* --- 海 --- */
    ditherV(g, 0, hz, W, seaB - hz, p.sea1, p.sea2, function (r) { return Math.pow(r, .8); });
    g.fillStyle = p.hi;
    g.fillRect(0, hz, W, 1);

    /* --- 護岸 --- */
    g.fillStyle = p.paper;
    g.fillRect(0, seaB, W, 4);
    g.fillStyle = p.st;
    for (var bx = 0; bx < W; bx += 8) g.fillRect(bx, seaB, 1, 4);
    g.fillRect(0, seaB + 4, W, 1);

    /* --- 草地 --- */
    ditherV(g, 0, seaB + 5, W, rail - seaB - 5, p.grass, p.land);

    /* --- 盛土と線路 --- */
    g.fillStyle = p.paper;
    g.fillRect(0, rail, W, 3);
    g.fillStyle = p.st;
    for (var tx = 0; tx < W; tx += 6) g.fillRect(tx, rail, 3, 3);   /* まくらぎ */
    g.fillStyle = p.hi;
    g.fillRect(0, rail + 1, W, 1);
    g.fillStyle = p.st;
    g.fillRect(0, rail + 3, W, 1);

    /* --- 手前の草 --- */
    ditherV(g, 0, rail + 4, W, H - rail - 4, p.grass, p.land, function (r) { return r * .9; });
    g.fillStyle = p.land;
    var rn2 = rng(4242);
    for (var gx = 0; gx < W; gx += 2) {
      if (rn2() < .5) g.fillRect(gx, rail + 4 + ((rn2() * 3) | 0), 1, 2);
    }

    /* --- 電柱 --- */
    for (var px2 = 12; px2 < W; px2 += 54) this.pole(g, px2, rail - 2, p);
  };

  PixelScene.prototype.pole = function (g, x, base, p) {
    var h = 26;
    g.fillStyle = p.st;
    g.fillRect(x, base - h, 2, h);
    g.fillRect(x - 4, base - h + 3, 10, 1);
    g.fillRect(x - 3, base - h + 7, 8, 1);
    /* たるんだ電線 */
    g.fillStyle = p.st;
    for (var i = 0; i < 54; i++) {
      var t = i / 54, sag = Math.round(Math.sin(t * Math.PI) * 3);
      g.fillRect(x + 1 + i, base - h + 3 + sag, 1, 1);
    }
  };

  /* --- 雲のかたち --- */
  var CLOUD = [
    [[0, 2, 14, 3], [2, 1, 9, 1], [4, 0, 5, 1], [1, 5, 12, 1]],
    [[0, 1, 9, 2], [2, 0, 4, 1], [1, 3, 7, 1]],
    [[0, 2, 22, 3], [3, 1, 13, 1], [7, 0, 6, 1], [2, 5, 18, 1], [6, 6, 8, 1]]
  ];

  PixelScene.prototype.frame = function (now) {
    if (!this.visible) return;
    var g = this.ctx, W = this.W, H = this.H, p = this.pal();
    var t = (now - this.t0) / 1000;

    g.clearRect(0, 0, W, H);
    g.drawImage(this.bg, 0, 0);

    /* --- 雲 --- */
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var x = ((c.x - t * c.sp) % (W + 40) + (W + 40)) % (W + 40) - 20;
      var blocks = CLOUD[c.k];
      g.fillStyle = p.night ? p.sky3 : p.paper;
      for (var b = 0; b < blocks.length; b++) {
        var q = blocks[b];
        g.fillRect(Math.round(x + q[0]), Math.round(c.y + q[1]), q[2], q[3]);
      }
      g.fillStyle = p.night ? p.sky2 : p.sky1;   /* 下側の影 */
      var last = blocks[blocks.length - 1];
      g.fillRect(Math.round(x + last[0]), Math.round(c.y + last[1]), last[2], 1);
    }

    /* --- 星のまたたき --- */
    if (p.night) {
      g.fillStyle = p.hi;
      for (var s = 0; s < this.stars.length; s++) {
        var st = this.stars[s];
        if (Math.sin(t * 2 + st.p) > .3) g.fillRect(st.x, st.y, 1, 1);
      }
    }

    /* --- 波 --- */
    var hz = this.hz, seaB = this.seaB;
    var rn = rng(999);
    g.fillStyle = p.hi;
    for (var w = 0; w < 90; w++) {
      var wy = hz + 2 + Math.floor(rn() * (seaB - hz - 3));
      var speed = .6 + (wy - hz) / (seaB - hz) * 3.2;
      var wx = ((rn() * W + t * speed * 6) % (W + 12)) - 6;
      var len = 2 + ((wy - hz) / (seaB - hz) * 3) | 0;
      g.fillRect(Math.round(wx), wy, len, 1);
    }

    /* --- 太陽の照り返し --- */
    var rn2 = rng(555);
    g.fillStyle = p.sun;
    for (var k = 0; k < 34; k++) {
      var gy = hz + 1 + Math.floor(rn2() * (seaB - hz - 2));
      var spread = 2 + (gy - hz) * .9;
      var gx = this.sunX + Math.round((rn2() - .5) * spread * 2);
      if (Math.sin(t * 3 + k) > 0) g.fillRect(gx, gy, 1 + ((rn2() * 2) | 0), 1);
    }

    /* --- 列車（ときどき通る） --- */
    var cycle = 17, phase = t % cycle;
    if (phase < 7) this.train(g, p, phase / 7);

    /* --- 鳥 --- */
    var bt = (t * .5) % 24;
    if (bt < 14) {
      var bx0 = Math.round(-20 + (bt / 14) * (W + 40));
      var by0 = Math.round(this.hz * .42 + Math.sin(t * .8) * 3);
      g.fillStyle = p.st;
      for (var bi = 0; bi < 3; bi++) {
        var flap = Math.sin(t * 6 + bi) > 0 ? 1 : 0;
        var bx = bx0 - bi * 9, by = by0 + (bi % 2 ? 5 : 0);
        g.fillRect(bx, by, 1, 1);
        g.fillRect(bx - 2, by - flap, 2, 1);
        g.fillRect(bx + 1, by - flap, 2, 1);
      }
    }

    /* --- 手前の草がすこし揺れる --- */
    g.fillStyle = p.grass;
    var rn3 = rng(31337);
    for (var f = 0; f < W; f += 3) {
      var sw = Math.round(Math.sin(t * 1.6 + f * .35) * 1);
      var fy = H - 2 - ((rn3() * 3) | 0);
      g.fillRect(f + sw, fy, 1, 2);
    }
  };

  /* 4両編成 */
  PixelScene.prototype.train = function (g, p, prog) {
    var W = this.W, y = this.rail - 13;
    var total = 4 * 30 + 6;
    var x = Math.round(-total + prog * (W + total * 2));
    for (var c = 0; c < 4; c++) {
      var cx = x + c * 30;
      if (cx > W || cx + 28 < 0) continue;
      /* 車体 */
      g.fillStyle = p.paper;
      g.fillRect(cx, y, 28, 12);
      g.fillStyle = p.accent;
      g.fillRect(cx, y + 8, 28, 2);
      g.fillStyle = p.st;
      g.fillRect(cx, y, 28, 1);
      g.fillRect(cx, y + 11, 28, 1);
      g.fillRect(cx, y, 1, 12);
      g.fillRect(cx + 27, y, 1, 12);
      /* 窓 */
      g.fillStyle = p.night ? p.sun : p.sea1;
      for (var wI = 0; wI < 4; wI++) g.fillRect(cx + 4 + wI * 6, y + 3, 4, 4);
      /* 足まわり */
      g.fillStyle = p.st;
      g.fillRect(cx + 4, y + 12, 5, 2);
      g.fillRect(cx + 19, y + 12, 5, 2);
      /* パンタグラフ */
      g.fillRect(cx + 12, y - 3, 1, 3);
      g.fillRect(cx + 8, y - 4, 9, 1);
    }
    if (p.night) {                         /* 前照灯 */
      g.fillStyle = p.sun;
      g.fillRect(x + 4 * 30 - 2, y + 5, 3, 2);
    }
  };

  /* ══════════════════════════════════════════════════
     作品サムネ：シードから風景を1枚つくる
     ══════════════════════════════════════════════════ */
  var THUMB_PAL = [
    { s1: '#ffe9b8', s2: '#ffa9a0', s3: '#ff7d9c', a: '#5b3a68', b: '#2c1b3d', o: '#fff3d0' },
    { s1: '#d8f6ff', s2: '#7fd8f0', s3: '#3aa7d8', a: '#1d5c86', b: '#123a5c', o: '#fffbe8' },
    { s1: '#f3e0ff', s2: '#b79bf0', s3: '#7a6ad8', a: '#3b2f78', b: '#231c4d', o: '#ffe9a8' },
    { s1: '#e8ffe0', s2: '#9fe6a0', s3: '#4fb98a', a: '#22684f', b: '#123f33', o: '#fff6c8' },
    { s1: '#fff0d8', s2: '#ffc06a', s3: '#f0784a', a: '#8a3550', b: '#4d1f38', o: '#fff8e0' },
    { s1: '#0d1836', s2: '#22366e', s3: '#3d5a9e', a: '#0a1226', b: '#050a18', o: '#eaf2ff' }
  ];

  function drawThumb(cv, seed, w, h) {
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    var rn = rng(seed * 2654435761 % 2147483647);
    var p = THUMB_PAL[(rn() * THUMB_PAL.length) | 0];
    var hz = Math.round(h * (.5 + rn() * .18));

    ditherV(g, 0, 0, w, Math.round(hz * .6), p.s1, p.s2);
    ditherV(g, 0, Math.round(hz * .6), w, hz - Math.round(hz * .6), p.s2, p.s3);

    /* 太陽か月 */
    var sx = 8 + ((rn() * (w - 16)) | 0), sy = 6 + ((rn() * (hz * .4)) | 0), R = 4 + ((rn() * 4) | 0);
    g.fillStyle = p.o;
    for (var y = -R; y <= R; y++) {
      var ww = Math.floor(Math.sqrt(R * R - y * y));
      g.fillRect(sx - ww, sy + y, ww * 2 + 1, 1);
    }

    /* 星 */
    if (p.s1 === '#0d1836') {
      g.fillStyle = p.o;
      for (var st = 0; st < 26; st++) g.fillRect((rn() * w) | 0, (rn() * hz * .8) | 0, 1, 1);
    }

    /* 遠景の山 */
    var mk = 1 + ((rn() * 2) | 0);
    for (var m = 0; m < mk; m++) {
      var px = (rn() * w) | 0, ph = 6 + ((rn() * (h * .22)) | 0), slope = .4 + rn() * .5;
      g.fillStyle = m === 0 ? p.a : p.b;
      for (var ix = 0; ix < w; ix++) {
        var hh = Math.max(0, ph - Math.round(Math.abs(ix - px) * slope));
        if (hh > 0) g.fillRect(ix, hz - hh, 1, hh);
      }
    }

    /* 水面 */
    ditherV(g, 0, hz, w, h - hz, p.s3, p.b, function (r) { return Math.pow(r, .7); });
    g.fillStyle = p.o;
    g.fillRect(0, hz, w, 1);
    for (var q = 0; q < 30; q++) {
      var wy = hz + 2 + ((rn() * (h - hz - 3)) | 0);
      g.fillStyle = q % 3 ? p.o : p.s2;
      g.fillRect((rn() * w) | 0, wy, 1 + ((rn() * 3) | 0), 1);
    }
    /* 照り返し */
    g.fillStyle = p.o;
    for (var r2 = 0; r2 < 10; r2++) {
      var ry = hz + 1 + r2 * 2;
      if (ry > h) break;
      g.fillRect(sx - 1 - ((rn() * 3) | 0), ry, 2 + ((rn() * 3) | 0), 1);
    }

    /* 手前のシルエット */
    g.fillStyle = p.b;
    var fy = h - 3 - ((rn() * 3) | 0);
    g.fillRect(0, fy, w, h - fy);
    for (var t2 = 0; t2 < 4; t2++) {
      var tx = ((rn() * w) | 0), th = 3 + ((rn() * 6) | 0);
      g.fillRect(tx, fy - th, 1, th);
      g.fillRect(tx - 1, fy - th - 2, 3, 3);
    }
  }

  /* ══════════════════════════════════════════════════
     ポラロイドの下に敷く、桜のちいさな背景
     ══════════════════════════════════════════════════ */
  function drawSakura(cv, w, h) {
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    var night = document.documentElement.dataset.theme === 'night';
    var top = css('--sky1'), bot = css('--sky2');
    var petal = css('--pink'), hi = css('--hi'), sun = css('--sun');

    /* 空 */
    ditherV(g, 0, 0, w, h, top, bot, function (r) { return Math.pow(r, .85); });

    /* うっすら陽だまり */
    var rn = rng(52200);
    g.globalAlpha = night ? .18 : .30;
    g.fillStyle = sun;
    for (var b = 0; b < 40; b++) {
      var bx = (rn() * w) | 0, by = (rn() * h * .5) | 0, br = 2 + ((rn() * 5) | 0);
      g.fillRect(bx, by, br, br);
    }
    g.globalAlpha = 1;

    /* 花びら：4ドットで1枚 */
    var rn2 = rng(777);
    for (var i = 0; i < 34; i++) {
      var x = (rn2() * w) | 0, y = (rn2() * h) | 0;
      var big = rn2() < .35;
      g.fillStyle = rn2() < .25 ? hi : petal;
      g.fillRect(x, y, 2, 2);
      if (big) {
        g.fillRect(x + 2, y - 1, 1, 1);
        g.fillRect(x - 1, y + 2, 1, 1);
      }
    }

    /* 下のほうに草の気配 */
    g.fillStyle = css('--grass');
    var rn3 = rng(31);
    for (var gx = 0; gx < w; gx += 2) {
      if (rn3() < .55) g.fillRect(gx, h - 1 - ((rn3() * 4) | 0), 1, 4);
    }
  }

  global.PixelScene = PixelScene;
  global.drawThumb = drawThumb;
  global.drawSakura = drawSakura;
})(window);
