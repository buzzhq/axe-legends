/**
 * Axe Legends — Golden Axe–style belt-scroller beat-em-up
 * Phaser 3.80.1 · offline · keyboard + Gamepad API
 * Original procedural pixel art · WebAudio SFX + chiptune
 * Kid-friendly: enemies flash and vanish, no blood.
 */
(function () {
  'use strict';

  var W = 960;
  var H = 540;
  var GROUND_TOP = 280;
  var GROUND_BOT = 500;
  var HS_KEY = 'axeLegendsHighScore';
  var POTION_CAP = 6;

  var HEROES = [
    {
      id: 'dwarf', name: 'GRIMAX', title: 'Dwarf Axeman',
      color: 0xc45c26, accent: 0x8b4513, hair: 0xd4a017, skin: 0xe8b896,
      hp: 14, speed: 110, damage: 3, attackFrames: 10, comboWindow: 280,
      magic: 'earth',
      blurb: 'Slow & sturdy. Crushing axe swings.\nEarth magic: quakes & boulders!'
    },
    {
      id: 'warrior', name: 'TYRIA', title: 'Flame Swordswoman',
      color: 0xc41e3a, accent: 0xffd700, hair: 0xffcc33, skin: 0xf5c9a8,
      hp: 10, speed: 170, damage: 2, attackFrames: 7, comboWindow: 320,
      magic: 'fire',
      blurb: 'Fast combos & fiery flair.\nFire magic: flames to a dragon!'
    },
    {
      id: 'barbarian', name: 'TORAN', title: 'Thunder Barbarian',
      color: 0x4a90d9, accent: 0xc9a66b, hair: 0xffe066, skin: 0xe0a878,
      hp: 12, speed: 140, damage: 2.5, attackFrames: 8, comboWindow: 300,
      magic: 'lightning',
      blurb: 'Balanced power. Overhead slam!\nLightning magic: bolts & storms!'
    }
  ];

  var AudioFX = {
    ctx: null, musicTimer: null, musicOn: true,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    beep: function (freq, dur, type, vol, when) {
      var ctx = this.ensure();
      if (!ctx || ctx.state !== 'running') return;
      var t0 = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || 0.1, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise: function (dur, vol, when) {
      var ctx = this.ensure();
      if (!ctx || ctx.state !== 'running') return;
      var t0 = ctx.currentTime + (when || 0);
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(g); g.connect(ctx.destination);
      src.start(t0); src.stop(t0 + dur + 0.02);
    },
    hit: function () { this.beep(180, 0.06, 'sawtooth', 0.12); this.noise(0.05, 0.06); },
    swing: function () { this.beep(320, 0.05, 'triangle', 0.07); this.beep(220, 0.06, 'sawtooth', 0.05, 0.03); },
    jump: function () { this.beep(400, 0.08, 'square', 0.07); this.beep(560, 0.1, 'square', 0.05, 0.05); },
    hurt: function () { this.beep(140, 0.12, 'sawtooth', 0.14); this.beep(90, 0.18, 'triangle', 0.1, 0.08); },
    death: function () { this.beep(200, 0.1, 'triangle', 0.1); this.beep(150, 0.15, 'triangle', 0.08, 0.1); this.beep(80, 0.25, 'sawtooth', 0.1, 0.22); },
    pickup: function () { this.beep(660, 0.06, 'sine', 0.1); this.beep(880, 0.1, 'sine', 0.09, 0.06); },
    select: function () { this.beep(440, 0.08, 'square', 0.1); this.beep(660, 0.12, 'square', 0.1, 0.08); },
    confirm: function () {
      var n = [523, 659, 784, 1047];
      for (var i = 0; i < n.length; i++) this.beep(n[i], 0.09, 'square', 0.1, i * 0.08);
    },
    magicEarth: function (tier) {
      this.noise(0.3, 0.12); this.beep(80, 0.4, 'sawtooth', 0.14);
      if (tier >= 2) { this.beep(60, 0.5, 'sawtooth', 0.12, 0.2); this.noise(0.4, 0.1, 0.15); }
      if (tier >= 3) { this.beep(40, 0.6, 'sawtooth', 0.15, 0.35); this.noise(0.5, 0.12, 0.3); }
    },
    magicFire: function (tier) {
      this.noise(0.25, 0.1); this.beep(220, 0.2, 'sawtooth', 0.1);
      this.beep(330, 0.25, 'triangle', 0.08, 0.1);
      if (tier >= 2) { this.beep(440, 0.3, 'sawtooth', 0.1, 0.2); this.noise(0.35, 0.1, 0.2); }
      if (tier >= 3) { this.beep(180, 0.5, 'sawtooth', 0.14, 0.35); this.beep(550, 0.4, 'triangle', 0.1, 0.4); }
    },
    magicLightning: function (tier) {
      this.noise(0.08, 0.15); this.beep(800, 0.05, 'square', 0.12);
      this.beep(1200, 0.04, 'square', 0.1, 0.04);
      if (tier >= 2) { this.noise(0.12, 0.14, 0.15); this.beep(900, 0.06, 'square', 0.12, 0.15); }
      if (tier >= 3) { this.noise(0.2, 0.16, 0.3); this.beep(600, 0.1, 'sawtooth', 0.12, 0.3); this.beep(1400, 0.08, 'square', 0.1, 0.35); }
    },
    boss: function () {
      this.beep(110, 0.3, 'sawtooth', 0.14);
      this.beep(130, 0.3, 'sawtooth', 0.14, 0.25);
      this.beep(165, 0.4, 'sawtooth', 0.16, 0.5);
    },
    win: function () {
      var n = [523, 659, 784, 1047, 784, 1047, 1319];
      for (var i = 0; i < n.length; i++) this.beep(n[i], 0.12, 'square', 0.1, i * 0.12);
    },
    gameOver: function () {
      this.beep(330, 0.2, 'triangle', 0.12);
      this.beep(262, 0.25, 'triangle', 0.12, 0.2);
      this.beep(196, 0.45, 'sawtooth', 0.14, 0.42);
    },
    stopMusic: function () {
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    },
    startMusic: function (style) {
      this.stopMusic();
      if (!this.musicOn) return;
      var self = this;
      var step = 0;
      var patterns = {
        title: [
          [262, 0.12], [330, 0.12], [392, 0.12], [523, 0.18],
          [392, 0.12], [330, 0.12], [294, 0.12], [262, 0.2],
          [294, 0.12], [330, 0.12], [349, 0.12], [392, 0.18],
          [349, 0.12], [330, 0.12], [294, 0.12], [262, 0.25]
        ],
        battle: [
          [196, 0.1], [196, 0.1], [247, 0.1], [196, 0.1],
          [220, 0.1], [196, 0.1], [175, 0.1], [165, 0.15],
          [196, 0.1], [247, 0.1], [294, 0.1], [247, 0.1],
          [220, 0.1], [196, 0.1], [175, 0.1], [147, 0.2]
        ],
        boss: [
          [110, 0.14], [130, 0.14], [147, 0.14], [110, 0.14],
          [98, 0.14], [110, 0.14], [130, 0.14], [82, 0.22],
          [110, 0.14], [147, 0.14], [165, 0.14], [147, 0.14],
          [130, 0.14], [110, 0.14], [98, 0.14], [87, 0.25]
        ]
      };
      var pat = patterns[style] || patterns.battle;
      this.musicTimer = setInterval(function () {
        if (!self.musicOn) return;
        var note = pat[step % pat.length];
        self.beep(note[0], note[1], 'triangle', 0.035);
        if (step % 4 === 0) self.beep(note[0] / 2, note[1] * 1.2, 'square', 0.02);
        step++;
      }, 220);
    }
  };

  function px(g, x, y, w, h, color, a) {
    g.fillStyle(color, a == null ? 1 : a);
    g.fillRect(x, y, w, h);
  }

  function drawHeroFrame(g, hero, frame, facing) {
    g.clear();
    var skin = hero.skin, hair = hero.hair, col = hero.color, acc = hero.accent;
    var ox = facing < 0 ? 47 : 0;
    function R(x, y, w, h, c, a) {
      var xx = facing < 0 ? ox - x - w + 1 : x;
      px(g, xx, y, w, h, c, a);
    }
    var bob = (frame === 'walk1') ? 1 : (frame === 'walk2') ? -1 : 0;
    var atk = frame === 'attack' || frame === 'attack2' || frame === 'slam';
    var jump = frame === 'jump';
    var hurt = frame === 'hurt';
    var dead = frame === 'death';
    var yOff = bob + (jump ? -8 : 0) + (hurt ? 2 : 0);

    if (dead) {
      R(4, 40, 40, 10, skin);
      R(8, 36, 12, 8, hair);
      R(20, 38, 18, 8, col);
      return;
    }

    if (hero.id === 'dwarf') {
      R(14, 18 + yOff, 20, 8, hair);
      R(16, 14 + yOff, 16, 12, skin);
      R(18, 16 + yOff, 4, 3, 0x222222);
      R(26, 16 + yOff, 4, 3, 0x222222);
      R(20, 22 + yOff, 8, 3, 0x8b0000);
      R(12, 26 + yOff, 24, 16, col);
      R(14, 28 + yOff, 20, 4, acc);
      if (frame === 'walk1') {
        R(14, 42 + yOff, 8, 12, 0x5c3317);
        R(26, 42 + yOff, 8, 10, 0x5c3317);
      } else if (frame === 'walk2') {
        R(14, 42 + yOff, 8, 10, 0x5c3317);
        R(26, 42 + yOff, 8, 12, 0x5c3317);
      } else {
        R(14, 42 + yOff, 8, 12, 0x5c3317);
        R(26, 42 + yOff, 8, 12, 0x5c3317);
      }
      R(12, 52 + yOff, 10, 4, 0x333333);
      R(26, 52 + yOff, 10, 4, 0x333333);
      var ax, ay;
      if (frame === 'slam') { ax = 22; ay = 4 + yOff; }
      else if (atk) { ax = 38; ay = 16 + yOff; }
      else { ax = 34; ay = 26 + yOff; }
      R(ax, ay, 4, 18, 0x8b6914);
      R(ax - 6, ay - 2, 16, 8, 0xaaaaaa);
      R(ax - 4, ay, 12, 4, 0xdddddd);
    } else if (hero.id === 'warrior') {
      R(16, 10 + yOff, 16, 6, hair);
      R(14, 14 + yOff, 6, 14, hair);
      R(28, 14 + yOff, 6, 14, hair);
      R(18, 14 + yOff, 12, 12, skin);
      R(20, 16 + yOff, 3, 3, 0x222222);
      R(26, 16 + yOff, 3, 3, 0x222222);
      R(22, 22 + yOff, 4, 2, 0xc06060);
      R(14, 26 + yOff, 20, 14, col);
      R(16, 28 + yOff, 16, 4, acc);
      R(18, 26 + yOff, 12, 6, 0xe8d4a8);
      R(14, 40 + yOff, 20, 6, col);
      R(16, 40 + yOff, 16, 4, acc);
      if (frame === 'walk1') {
        R(16, 46 + yOff, 6, 8, skin);
        R(26, 46 + yOff, 6, 6, skin);
      } else if (frame === 'walk2') {
        R(16, 46 + yOff, 6, 6, skin);
        R(26, 46 + yOff, 6, 8, skin);
      } else {
        R(16, 46 + yOff, 6, 8, skin);
        R(26, 46 + yOff, 6, 8, skin);
      }
      R(14, 52 + yOff, 8, 4, 0x884422);
      R(26, 52 + yOff, 8, 4, 0x884422);
      var sx, sy;
      if (frame === 'slam') { sx = 22; sy = 2 + yOff; }
      else if (atk && frame === 'attack2') { sx = 38; sy = 20 + yOff; }
      else if (atk) { sx = 36; sy = 14 + yOff; }
      else { sx = 34; sy = 24 + yOff; }
      R(sx, sy, 3, 20, 0xcccccc);
      R(sx - 2, sy + 16, 7, 4, acc);
      R(sx - 1, sy - 2, 5, 4, 0xeeeeee);
    } else {
      R(16, 8 + yOff, 16, 6, hair);
      R(14, 12 + yOff, 4, 10, hair);
      R(30, 12 + yOff, 4, 10, hair);
      R(18, 12 + yOff, 12, 12, skin);
      R(20, 14 + yOff, 3, 3, 0x222222);
      R(26, 14 + yOff, 3, 3, 0x222222);
      R(12, 24 + yOff, 24, 16, skin);
      R(14, 26 + yOff, 6, 8, 0xd09070);
      R(28, 26 + yOff, 6, 8, 0xd09070);
      R(12, 28 + yOff, 24, 3, acc);
      R(22, 24 + yOff, 4, 16, acc);
      R(16, 40 + yOff, 16, 8, 0x8b6914);
      R(14, 42 + yOff, 4, 6, 0xa07828);
      R(30, 42 + yOff, 4, 6, 0xa07828);
      if (frame === 'walk1') {
        R(16, 48 + yOff, 7, 6, skin);
        R(26, 48 + yOff, 7, 4, skin);
      } else if (frame === 'walk2') {
        R(16, 48 + yOff, 7, 4, skin);
        R(26, 48 + yOff, 7, 6, skin);
      } else {
        R(16, 48 + yOff, 7, 6, skin);
        R(26, 48 + yOff, 7, 6, skin);
      }
      R(14, 52 + yOff, 9, 4, 0x5c3317);
      R(26, 52 + yOff, 9, 4, 0x5c3317);
      var bx, by;
      if (frame === 'slam') { bx = 20; by = 0 + yOff; }
      else if (atk) { bx = 38; by = 10 + yOff; }
      else { bx = 36; by = 18 + yOff; }
      R(bx, by, 4, 28, 0xb0b0b0);
      R(bx - 3, by + 22, 10, 5, acc);
      R(bx - 1, by - 2, 6, 5, 0xeeeeee);
    }
  }

  function drawEnemyFrame(g, type, frame, facing) {
    g.clear();
    var ox = facing < 0 ? 47 : 0;
    function R(x, y, w, h, c, a) {
      var xx = facing < 0 ? ox - x - w + 1 : x;
      px(g, xx, y, w, h, c, a);
    }
    var bob = frame === 'walk1' ? 1 : frame === 'walk2' ? -1 : 0;
    var atk = frame === 'attack';
    var dead = frame === 'death';
    var y = bob;

    if (dead) { R(6, 42, 36, 10, 0x666666); return; }

    if (type === 'grunt') {
      R(16, 12 + y, 16, 12, 0xc4a070);
      R(18, 14 + y, 3, 3, 0x222222);
      R(26, 14 + y, 3, 3, 0x222222);
      R(14, 24 + y, 20, 14, 0x4a6741);
      R(16, 38 + y, 6, 12, 0xc4a070);
      R(26, 38 + y, 6, 12, 0xc4a070);
      R(14, 50 + y, 8, 4, 0x333333);
      R(26, 50 + y, 8, 4, 0x333333);
      var cx = atk ? 38 : 34, cy = atk ? 16 + y : 28 + y;
      R(cx, cy, 5, 16, 0x8b6914);
      R(cx - 2, cy - 4, 9, 8, 0x6b4423);
    } else if (type === 'knight') {
      R(16, 8 + y, 16, 6, 0x888888);
      R(18, 12 + y, 12, 10, 0xc4a070);
      R(16, 12 + y, 16, 4, 0x888888);
      R(20, 14 + y, 3, 3, 0xff0000);
      R(26, 14 + y, 3, 3, 0xff0000);
      R(12, 22 + y, 24, 18, 0x555555);
      R(14, 24 + y, 20, 4, 0x888888);
      R(16, 40 + y, 6, 12, 0x555555);
      R(26, 40 + y, 6, 12, 0x555555);
      R(14, 50 + y, 8, 4, 0x333333);
      R(26, 50 + y, 8, 4, 0x333333);
      var kx = atk ? 38 : 34, ky = atk ? 12 + y : 22 + y;
      R(kx, ky, 4, 22, 0xcccccc);
      R(kx - 2, ky + 18, 8, 4, 0x888888);
    } else if (type === 'thief') {
      R(18, 14 + y, 12, 10, 0xd4a070);
      R(16, 12 + y, 16, 4, 0x222222);
      R(14, 14 + y, 4, 10, 0x222222);
      R(30, 14 + y, 4, 10, 0x222222);
      R(20, 16 + y, 2, 2, 0xffff00);
      R(26, 16 + y, 2, 2, 0xffff00);
      R(16, 24 + y, 16, 14, 0x4a2060);
      R(18, 38 + y, 5, 12, 0xd4a070);
      R(26, 38 + y, 5, 12, 0xd4a070);
      R(16, 50 + y, 7, 4, 0x222222);
      R(26, 50 + y, 7, 4, 0x222222);
      R(10, 28 + y, 8, 8, 0x22aa44);
      R(12, 26 + y, 4, 4, 0x88ff88);
    } else if (type === 'beast') {
      R(8, 28 + y, 32, 16, 0x3d8b37);
      R(4, 32 + y, 10, 10, 0x2e6b2a);
      R(6, 34 + y, 3, 3, 0xffff00);
      R(36, 34 + y, 8, 8, 0x3d8b37);
      R(12, 42 + y, 6, 10, 0x2e6b2a);
      R(28, 42 + y, 6, 10, 0x2e6b2a);
      R(10, 50 + y, 8, 4, 0x1a4a18);
      R(26, 50 + y, 8, 4, 0x1a4a18);
      R(14, 24 + y, 16, 6, 0x50a048);
      if (atk) R(2, 30 + y, 8, 6, 0xff6666);
    } else if (type === 'boss1') {
      R(12, 4 + y, 24, 8, 0x2d5a27);
      R(14, 10 + y, 20, 14, 0x5a8a4a);
      R(16, 14 + y, 4, 4, 0xff0000);
      R(28, 14 + y, 4, 4, 0xff0000);
      R(10, 24 + y, 28, 20, 0x3d6b35);
      R(14, 44 + y, 8, 10, 0x5a8a4a);
      R(26, 44 + y, 8, 10, 0x5a8a4a);
      R(12, 52 + y, 10, 4, 0x222222);
      R(26, 52 + y, 10, 4, 0x222222);
      var bx = atk ? 40 : 36;
      R(bx, 10 + y, 6, 28, 0x8b4513);
      R(bx - 4, 6 + y, 14, 10, 0x666666);
    } else if (type === 'boss2') {
      R(14, 2 + y, 20, 8, 0x1a1a2e);
      R(16, 8 + y, 16, 12, 0x888888);
      R(18, 12 + y, 4, 4, 0x00ffff);
      R(26, 12 + y, 4, 4, 0x00ffff);
      R(10, 20 + y, 28, 22, 0x2a2a4a);
      R(12, 24 + y, 24, 4, 0x6a6aaa);
      R(14, 42 + y, 8, 12, 0x2a2a4a);
      R(26, 42 + y, 8, 12, 0x2a2a4a);
      R(12, 52 + y, 10, 4, 0x111111);
      R(26, 52 + y, 10, 4, 0x111111);
      R(atk ? 40 : 36, 8 + y, 5, 30, 0xaaaaaa);
      R(atk ? 38 : 34, 6 + y, 9, 6, 0x66aaff);
    } else if (type === 'boss3') {
      R(16, 2 + y, 16, 6, 0x4a0080);
      R(14, 6 + y, 20, 14, 0xc4a070);
      R(16, 10 + y, 4, 4, 0xff00ff);
      R(28, 10 + y, 4, 4, 0xff00ff);
      R(18, 16 + y, 12, 4, 0x222222);
      R(10, 20 + y, 28, 22, 0x4a0080);
      R(12, 24 + y, 24, 6, 0x7a00b0);
      R(20, 22 + y, 8, 16, 0xffd700);
      R(14, 42 + y, 8, 12, 0x4a0080);
      R(26, 42 + y, 8, 12, 0x4a0080);
      R(12, 52 + y, 10, 4, 0x222222);
      R(26, 52 + y, 10, 4, 0x222222);
      R(atk ? 40 : 38, 0 + y, 4, 40, 0x8b6914);
      R(atk ? 36 : 34, 0 + y, 12, 10, 0xff00ff);
    }
  }

  function makeTextures(scene) {
    var g = scene.make.graphics({ x: 0, y: 0, add: false });
    var frames = ['idle', 'walk1', 'walk2', 'attack', 'attack2', 'slam', 'jump', 'hurt', 'death'];
    var facings = [1, -1];
    for (var h = 0; h < HEROES.length; h++) {
      var hero = HEROES[h];
      for (var fi = 0; fi < frames.length; fi++) {
        for (var fci = 0; fci < facings.length; fci++) {
          var fac = facings[fci];
          var key = hero.id + '_' + frames[fi] + (fac < 0 ? '_L' : '');
          drawHeroFrame(g, hero, frames[fi], fac);
          g.generateTexture(key, 48, 56);
        }
      }
    }
    var etypes = ['grunt', 'knight', 'thief', 'beast', 'boss1', 'boss2', 'boss3'];
    var eframes = ['idle', 'walk1', 'walk2', 'attack', 'hurt', 'death'];
    for (var ei = 0; ei < etypes.length; ei++) {
      for (var ef = 0; ef < eframes.length; ef++) {
        for (var efc = 0; efc < facings.length; efc++) {
          var efacing = facings[efc];
          var ekey = etypes[ei] + '_' + eframes[ef] + (efacing < 0 ? '_L' : '');
          drawEnemyFrame(g, etypes[ei], eframes[ef], efacing);
          g.generateTexture(ekey, 48, 56);
        }
      }
    }
    g.clear();
    px(g, 4, 2, 8, 10, 0x22aa44); px(g, 6, 0, 4, 4, 0x88ff88); px(g, 5, 4, 6, 6, 0x44ff66);
    g.generateTexture('potion', 16, 16);
    g.clear();
    px(g, 6, 0, 4, 4, 0xffff00); px(g, 0, 6, 4, 4, 0xffaa00);
    px(g, 12, 6, 4, 4, 0xffaa00); px(g, 6, 12, 4, 4, 0xffff00); px(g, 6, 6, 4, 4, 0xffffff);
    g.generateTexture('spark', 16, 16);
    g.clear(); g.fillStyle(0x000000, 0.35); g.fillEllipse(16, 6, 28, 10); g.generateTexture('shadow', 32, 12);
    g.clear(); px(g, 0, 0, 4, 4, 0xffffff); g.generateTexture('dot', 4, 4);
    g.clear(); px(g, 0, 0, 6, 6, 0x8b4513); g.generateTexture('rock', 6, 6);
    g.clear(); px(g, 0, 0, 8, 8, 0xff4400); g.generateTexture('flame', 8, 8);
    g.clear(); px(g, 0, 0, 3, 16, 0xffffaa); g.generateTexture('bolt', 3, 16);
    g.clear();
    px(g, 20, 40, 80, 30, 0xff2200); px(g, 10, 30, 30, 25, 0xff4400);
    px(g, 0, 35, 16, 12, 0xff6600); px(g, 14, 28, 6, 6, 0xffff00);
    px(g, 90, 35, 40, 16, 0xff3300); px(g, 40, 20, 20, 25, 0xff5500);
    px(g, 55, 15, 25, 20, 0xff4400); px(g, 100, 30, 20, 10, 0xffaa00); px(g, 115, 28, 25, 14, 0xffff00);
    g.generateTexture('firedragon', 160, 80);
    g.destroy();
  }

  function InputState() {
    this.left = false; this.right = false; this.up = false; this.down = false;
    this.attack = false; this.jump = false; this.magic = false;
    this.attackPressed = false; this.jumpPressed = false; this.magicPressed = false;
    this._prevA = false; this._prevJ = false; this._prevM = false;
  }
  InputState.prototype.poll = function (cursors, wasd, keys, pads) {
    var l = cursors.left.isDown || wasd.A.isDown;
    var r = cursors.right.isDown || wasd.D.isDown;
    var u = cursors.up.isDown || wasd.W.isDown;
    var d = cursors.down.isDown || wasd.S.isDown;
    var a = keys.J.isDown || keys.Z.isDown;
    var j = keys.K.isDown || keys.X.isDown;
    var m = keys.L.isDown || keys.C.isDown;
    if (pads) {
      for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (!p || !p.connected) continue;
        var ls = p.leftStick;
        if (ls) {
          if (ls.x < -0.35) l = true;
          if (ls.x > 0.35) r = true;
          if (ls.y < -0.35) u = true;
          if (ls.y > 0.35) d = true;
        }
        if (p.left) l = true; if (p.right) r = true;
        if (p.up) u = true; if (p.down) d = true;
        if (p.A || p.X) a = true;
        if (p.B) j = true;
        if (p.Y || p.L1 || p.R1) m = true;
        if (p.buttons) {
          if (p.buttons.length > 0 && p.buttons[0].pressed) a = true;
          if (p.buttons.length > 1 && p.buttons[1].pressed) j = true;
          if (p.buttons.length > 2 && p.buttons[2].pressed) m = true;
        }
      }
    }
    this.left = l; this.right = r; this.up = u; this.down = d;
    this.attack = a; this.jump = j; this.magic = m;
    this.attackPressed = a && !this._prevA;
    this.jumpPressed = j && !this._prevJ;
    this.magicPressed = m && !this._prevM;
    this._prevA = a; this._prevJ = j; this._prevM = m;
  };

  function depthY(y) { return Math.round(y); }
  function clampY(y) { return Phaser.Math.Clamp(y, GROUND_TOP, GROUND_BOT); }
  function onSameLane(a, b, tol) { return Math.abs(a.y - b.y) < (tol || 28); }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() { makeTextures(this); this.scene.start('Title'); }
  }

  class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      AudioFX.ensure();
      AudioFX.startMusic('title');
      this.cameras.main.setBackgroundColor(0x1a0a20);
      var g = this.add.graphics();
      g.fillGradientStyle(0x2a1040, 0x2a1040, 0x0a0612, 0x0a0612, 1);
      g.fillRect(0, 0, W, H);
      g.fillStyle(0x3a2060, 1);
      g.fillTriangle(0, 320, 200, 160, 400, 320);
      g.fillTriangle(300, 320, 520, 140, 740, 320);
      g.fillTriangle(600, 320, 820, 180, 960, 320);
      g.fillStyle(0x1a4030, 1);
      g.fillRect(0, 300, W, H - 300);
      var title = this.add.text(W / 2, 100, 'AXE LEGENDS', {
        fontFamily: 'Courier New, monospace', fontSize: '56px', color: '#ffcc33',
        stroke: '#8b0000', strokeThickness: 8
      }).setOrigin(0.5);
      this.add.text(W / 2, 160, 'A Golden Axe–style adventure', {
        fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#ccaa66'
      }).setOrigin(0.5);
      var hs = 0;
      try { hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch (e) {}
      this.add.text(W / 2, 200, 'HIGH SCORE: ' + hs, {
        fontFamily: 'Courier New, monospace', fontSize: '18px', color: '#88ff88'
      }).setOrigin(0.5);
      this.add.text(W / 2, 280, 'PRESS ENTER / SPACE / START', {
        fontFamily: 'Courier New, monospace', fontSize: '22px', color: '#ffffff'
      }).setOrigin(0.5);
      this.add.text(W / 2, 340, 'Arrows/WASD move · J/Z attack · K/X jump · L/C magic\nGamepad: stick/D-pad · Cross/A attack · Circle/B jump · Square magic', {
        fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#aaaaaa', align: 'center'
      }).setOrigin(0.5);
      this.add.text(W / 2, 500, 'Kid-friendly: foes flash & vanish · no blood', {
        fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#666666'
      }).setOrigin(0.5);
      this.tweens.add({ targets: title, y: 108, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-ENTER', this.go, this);
      this.input.keyboard.once('keydown-SPACE', this.go, this);
      this._pads = this.input.gamepad;
    }
    update() {
      if (!this._pads) return;
      var pads = this._pads.getAll();
      for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (p && (p.A || p.B || p.X || p.Y || (p.buttons && p.buttons[9] && p.buttons[9].pressed))) {
          this.go(); return;
        }
      }
    }
    go() { AudioFX.select(); this.scene.start('Select'); }
  }

  class SelectScene extends Phaser.Scene {
    constructor() { super('Select'); }
    create() {
      AudioFX.startMusic('title');
      this.cameras.main.setBackgroundColor(0x12081a);
      this.idx = 0;
      this.add.text(W / 2, 40, 'CHOOSE YOUR HERO', {
        fontFamily: 'Courier New, monospace', fontSize: '32px', color: '#ffcc33'
      }).setOrigin(0.5);
      this.cards = []; this.portraits = [];
      for (var i = 0; i < HEROES.length; i++) {
        var hx = 160 + i * 280;
        var hero = HEROES[i];
        var card = this.add.rectangle(hx, 260, 220, 320, 0x2a1a30).setStrokeStyle(3, 0x666666);
        this.cards.push(card);
        var spr = this.add.image(hx, 180, hero.id + '_idle').setScale(3);
        this.portraits.push(spr);
        this.add.text(hx, 300, hero.name, {
          fontFamily: 'Courier New, monospace', fontSize: '22px', color: '#ffffff'
        }).setOrigin(0.5);
        this.add.text(hx, 330, hero.title, {
          fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#ccaa66'
        }).setOrigin(0.5);
        this.add.text(hx, 370, 'HP ' + hero.hp + '  SPD ' + hero.speed + '\nDMG ' + hero.damage, {
          fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#88cc88', align: 'center'
        }).setOrigin(0.5);
      }
      this.blurb = this.add.text(W / 2, 460, '', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#dddddd', align: 'center'
      }).setOrigin(0.5);
      this.add.text(W / 2, 510, '← → select · ENTER / J confirm', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#888888'
      }).setOrigin(0.5);
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
      this.keys = this.input.keyboard.addKeys('J,Z,K,X,L,C,ENTER,SPACE');
      this._pads = this.input.gamepad;
      this.inputState = new InputState();
      this._leftLatch = false; this._rightLatch = false;
      this.refresh();
      this.walkTimer = 0;
      var self = this;
      this.input.keyboard.on('keydown-ENTER', function () { self.confirmHero(); });
      this.input.keyboard.on('keydown-SPACE', function () { self.confirmHero(); });
    }
    confirmHero() {
      if (this._confirmed) return;
      this._confirmed = true;
      AudioFX.confirm();
      this.scene.start('Game', { heroIndex: this.idx, stage: 1, lives: 3, score: 0, potions: 0 });
    }
    refresh() {
      for (var i = 0; i < this.cards.length; i++) {
        this.cards[i].setStrokeStyle(3, i === this.idx ? 0xffcc33 : 0x666666);
        this.cards[i].setFillStyle(i === this.idx ? 0x3a2a50 : 0x2a1a30);
      }
      this.blurb.setText(HEROES[this.idx].blurb);
    }
    update(t, dt) {
      this.inputState.poll(this.cursors, this.wasd, this.keys, this._pads ? this._pads.getAll() : null);
      var inp = this.inputState;
      if (inp.left && !this._leftLatch) { this.idx = (this.idx + HEROES.length - 1) % HEROES.length; AudioFX.select(); this.refresh(); }
      if (inp.right && !this._rightLatch) { this.idx = (this.idx + 1) % HEROES.length; AudioFX.select(); this.refresh(); }
      this._leftLatch = inp.left; this._rightLatch = inp.right;
      if (inp.attackPressed) this.confirmHero();
      this.walkTimer += dt;
      var fr = (Math.floor(this.walkTimer / 200) % 2 === 0) ? 'walk1' : 'walk2';
      this.portraits[this.idx].setTexture(HEROES[this.idx].id + '_' + fr);
    }
  }

  var STAGES = [
    {
      id: 1, name: 'TURTLE VILLAGE',
      skyTop: 0x87b8e0, skyBot: 0xc8e0a0, ground: 0x5a8a3a, groundDark: 0x3a6a28, far: 0x6a9a50, mid: 0x4a7a38,
      waves: [
        [{ t: 'grunt', n: 3 }, { t: 'grunt', n: 2 }],
        [{ t: 'grunt', n: 2 }, { t: 'knight', n: 1 }, { t: 'thief', n: 1 }],
        [{ t: 'grunt', n: 3 }, { t: 'beast', n: 1 }, { t: 'knight', n: 1 }]
      ],
      boss: 'boss1', bossHp: 30, bossName: 'ORC WARLORD'
    },
    {
      id: 2, name: 'FIENDISH CAVERNS',
      skyTop: 0x2a1840, skyBot: 0x4a2860, ground: 0x4a3a2a, groundDark: 0x2a1a10, far: 0x3a2a40, mid: 0x5a3a20,
      waves: [
        [{ t: 'knight', n: 2 }, { t: 'grunt', n: 2 }],
        [{ t: 'knight', n: 2 }, { t: 'beast', n: 1 }, { t: 'thief', n: 1 }],
        [{ t: 'grunt', n: 2 }, { t: 'knight', n: 2 }, { t: 'beast', n: 1 }]
      ],
      boss: 'boss2', bossHp: 40, bossName: 'DARK KNIGHT'
    },
    {
      id: 3, name: 'CASTLE OF EVIL',
      skyTop: 0x1a0a20, skyBot: 0x4a1020, ground: 0x3a3a4a, groundDark: 0x1a1a2a, far: 0x2a1a30, mid: 0x4a2a3a,
      waves: [
        [{ t: 'knight', n: 3 }, { t: 'thief', n: 1 }],
        [{ t: 'beast', n: 2 }, { t: 'knight', n: 2 }],
        [{ t: 'grunt', n: 2 }, { t: 'knight', n: 3 }, { t: 'beast', n: 1 }]
      ],
      boss: 'boss3', bossHp: 55, bossName: 'SORCERER KING'
    }
  ];

  var ENEMY_STATS = {
    grunt: { hp: 4, speed: 70, damage: 1, score: 100, w: 28, h: 40 },
    knight: { hp: 8, speed: 55, damage: 2, score: 250, w: 30, h: 44 },
    thief: { hp: 3, speed: 120, damage: 1, score: 150, w: 26, h: 38, flee: true },
    beast: { hp: 10, speed: 90, damage: 2, score: 300, w: 40, h: 36, rideable: true },
    boss1: { hp: 30, speed: 60, damage: 3, score: 1000, w: 36, h: 48 },
    boss2: { hp: 40, speed: 70, damage: 3, score: 1500, w: 36, h: 50 },
    boss3: { hp: 55, speed: 80, damage: 4, score: 2500, w: 36, h: 52 }
  };

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    init(data) {
      this.heroIndex = data.heroIndex || 0;
      this.stageNum = data.stage || 1;
      this.lives = data.lives != null ? data.lives : 3;
      this.score = data.score || 0;
      this.potions = data.potions || 0;
      this.heroDef = HEROES[this.heroIndex];
      this.stage = STAGES[this.stageNum - 1];
    }
    create() {
      AudioFX.startMusic('battle');
      this.cameras.main.setBackgroundColor(this.stage.skyTop);
      this.physics.world.setBounds(0, 0, 3200, H);
      this.waveIndex = 0; this.waveEnemiesLeft = 0; this.bossSpawned = false;
      this.stageClear = false; this.magicBusy = false; this.paused = false;
      this.buildBackground();
      this.enemies = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.createPlayer();
      this.setupInput();
      this.buildHUD();
      this.showStageBanner();
      this.spawnWave();
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.setBounds(0, 0, 3200, H);
      this.cameras.main.setDeadzone(100, 80);
      this.hitCooldown = 0; this.comboCount = 0; this.comboTimer = 0;
      this.attackLock = 0; this.isJumping = false; this.jumpVy = 0; this.jumpZ = 0;
      this.isDashing = false; this.dashTimer = 0; this.facing = 1;
      this.throwTimer = 0; this.invuln = 0; this.riding = null;
      this.animTimer = 0; this.walkFrame = 0; this.lastAttackKind = 'attack';
      this._waveDelay = false;
    }

    buildBackground() {
      var s = this.stage;
      var g = this.add.graphics().setScrollFactor(0);
      g.fillGradientStyle(s.skyTop, s.skyTop, s.skyBot, s.skyBot, 1);
      g.fillRect(0, 0, W, GROUND_TOP);
      this.farLayer = this.add.container(0, 0).setScrollFactor(0.2);
      var fg = this.add.graphics();
      fg.fillStyle(s.far, 1);
      for (var i = 0; i < 8; i++) {
        var hx = i * 500 - 100;
        fg.fillTriangle(hx, GROUND_TOP, hx + 250, GROUND_TOP - 80 - (i % 3) * 20, hx + 500, GROUND_TOP);
      }
      this.farLayer.add(fg);
      this.midLayer = this.add.container(0, 0).setScrollFactor(0.5);
      var mg = this.add.graphics();
      mg.fillStyle(s.mid, 1);
      for (var j = 0; j < 10; j++) {
        var mx = j * 400;
        mg.fillRect(mx, GROUND_TOP - 40 - (j % 2) * 20, 80, 40 + (j % 2) * 20);
        mg.fillRect(mx + 100, GROUND_TOP - 60, 50, 60);
      }
      this.midLayer.add(mg);
      var ground = this.add.graphics();
      ground.fillStyle(s.ground, 1);
      ground.fillRect(0, GROUND_TOP, 3200, H - GROUND_TOP);
      ground.fillStyle(s.groundDark, 0.35);
      for (var ly = GROUND_TOP; ly < H; ly += 40) ground.fillRect(0, ly, 3200, 2);
      ground.fillStyle(s.groundDark, 0.25);
      for (var tx = 0; tx < 3200; tx += 48) {
        for (var ty = GROUND_TOP + 10; ty < H; ty += 36) {
          if (((tx + ty) / 12) % 2 < 1) ground.fillRect(tx, ty, 24, 18);
        }
      }
    }

    createPlayer() {
      var startX = 120, startY = 400;
      this.shadow = this.add.image(startX, startY + 4, 'shadow').setDepth(1);
      this.player = this.physics.add.sprite(startX, startY, this.heroDef.id + '_idle');
      this.player.setCollideWorldBounds(true);
      this.player.body.setSize(24, 20);
      this.player.body.setOffset(12, 36);
      this.player.setDepth(depthY(startY));
      this.playerHP = this.heroDef.hp;
      this.playerMaxHP = this.heroDef.hp;
      this.baseY = startY;
    }

    setupInput() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
      this.keys = this.input.keyboard.addKeys('J,Z,K,X,L,C,ENTER,SPACE,P,M');
      this._pads = this.input.gamepad;
      this.inputState = new InputState();
      this.input.keyboard.on('keydown-M', function () {
        AudioFX.musicOn = !AudioFX.musicOn;
        if (!AudioFX.musicOn) AudioFX.stopMusic();
        else AudioFX.startMusic(this.bossSpawned ? 'boss' : 'battle');
      }, this);
    }

    buildHUD() {
      this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
      this.hud.add(this.add.rectangle(0, 0, W, 48, 0x000000, 0.55).setOrigin(0));
      this.hudName = this.add.text(12, 6, this.heroDef.name, {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#ffcc33'
      });
      this.hud.add(this.hudName);
      this.hpBars = [];
      for (var i = 0; i < this.playerMaxHP; i++) {
        var bar = this.add.rectangle(12 + i * 14, 28, 12, 10, 0x33cc33).setOrigin(0);
        this.hpBars.push(bar); this.hud.add(bar);
      }
      this.hudLives = this.add.text(12 + this.playerMaxHP * 14 + 16, 22, 'P×' + this.lives, {
        fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#ffffff'
      });
      this.hud.add(this.hudLives);
      this.hudScore = this.add.text(W - 12, 8, 'SCORE 0', {
        fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#ffffff'
      }).setOrigin(1, 0);
      this.hud.add(this.hudScore);
      this.hudPotions = this.add.text(W - 12, 28, 'POTIONS 0', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#88ff88'
      }).setOrigin(1, 0);
      this.hud.add(this.hudPotions);
      this.hudStage = this.add.text(W / 2, 8, 'STAGE ' + this.stageNum + ': ' + this.stage.name, {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#ccaa66'
      }).setOrigin(0.5, 0);
      this.hud.add(this.hudStage);
      this.updateHUD();
    }

    updateHUD() {
      for (var i = 0; i < this.hpBars.length; i++) {
        this.hpBars[i].setFillStyle(i < this.playerHP ? 0x33cc33 : 0x442222);
      }
      this.hudLives.setText('P×' + this.lives);
      this.hudScore.setText('SCORE ' + this.score);
      var potStr = 'POTIONS ' + this.potions;
      if (this.potions >= 3) potStr += '  [MAX]';
      this.hudPotions.setText(potStr);
      this.hudPotions.setColor(this.potions >= 3 ? '#ffdd44' : '#88ff88');
    }

    showStageBanner() {
      var t = this.add.text(W / 2, H / 2, 'STAGE ' + this.stageNum + '\n' + this.stage.name, {
        fontFamily: 'Courier New, monospace', fontSize: '36px', color: '#ffcc33',
        align: 'center', stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
      this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 600, onComplete: function () { t.destroy(); } });
    }

    spawnWave() {
      if (this.waveIndex >= this.stage.waves.length) { this.spawnBoss(); return; }
      var wave = this.stage.waves[this.waveIndex];
      var camX = this.cameras.main.scrollX;
      var count = 0;
      for (var i = 0; i < wave.length; i++) {
        var spec = wave[i];
        for (var n = 0; n < spec.n; n++) {
          var x = camX + W + 40 + n * 50 + i * 30;
          var y = GROUND_TOP + 40 + Math.random() * (GROUND_BOT - GROUND_TOP - 60);
          this.spawnEnemy(spec.t, x, y);
          count++;
        }
      }
      if (Math.random() < 0.5) {
        this.spawnEnemy('thief', camX - 40, GROUND_TOP + 60 + Math.random() * 200);
        count++;
      }
      this.waveEnemiesLeft = count;
      this.waveIndex++;
    }

    spawnBoss() {
      if (this.bossSpawned) return;
      this.bossSpawned = true;
      AudioFX.stopMusic(); AudioFX.boss(); AudioFX.startMusic('boss');
      var camX = this.cameras.main.scrollX;
      var boss = this.spawnEnemy(this.stage.boss, camX + W - 120, 400);
      boss.isBoss = true; boss.hp = this.stage.bossHp; boss.maxHp = this.stage.bossHp;
      this.waveEnemiesLeft = 1;
      var banner = this.add.text(W / 2, 80, 'BOSS: ' + this.stage.bossName, {
        fontFamily: 'Courier New, monospace', fontSize: '28px', color: '#ff4444',
        stroke: '#000', strokeThickness: 5
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
      this.tweens.add({ targets: banner, alpha: 0, delay: 2000, duration: 500, onComplete: function () { banner.destroy(); } });
      this.bossHpText = this.add.text(W / 2, 52, '', {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#ff8888'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
      this.hud.add(this.bossHpText);
    }

    spawnEnemy(type, x, y) {
      var st = ENEMY_STATS[type];
      var e = this.enemies.create(x, y, type + '_idle');
      e.type = type; e.hp = st.hp; e.maxHp = st.hp; e.speed = st.speed;
      e.damage = st.damage; e.scoreValue = st.score; e.facing = -1;
      e.attackCd = 0; e.hurtTimer = 0; e.state = 'chase'; e.animT = 0; e.walkF = 0;
      e.body.setSize(st.w * 0.6, 18); e.body.setOffset((48 - st.w * 0.6) / 2, 36);
      e.setDepth(depthY(y));
      e.shadow = this.add.image(x, y + 4, 'shadow').setDepth(1);
      if (st.flee) e.state = 'flee';
      if (st.rideable) e.rideable = true;
      return e;
    }

    update(time, dt) {
      if (this.stageClear || this.paused) return;
      this.inputState.poll(this.cursors, this.wasd, this.keys, this._pads ? this._pads.getAll() : null);
      if (this.hitCooldown > 0) this.hitCooldown -= dt;
      if (this.attackLock > 0) this.attackLock -= dt;
      if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.comboCount = 0; }
      if (this.invuln > 0) this.invuln -= dt;
      if (this.dashTimer > 0) this.dashTimer -= dt;
      if (this.throwTimer > 0) this.throwTimer -= dt;
      if (!this.magicBusy && this.playerHP > 0) this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updatePickups();
      this.syncDepth();
      this.checkWaveClear();
      if (this.bossHpText && this.bossSpawned) {
        var boss = null;
        this.enemies.children.each(function (e) { if (e.active && e.isBoss) boss = e; });
        if (boss) this.bossHpText.setText('BOSS HP ' + Math.max(0, Math.ceil(boss.hp)) + '/' + boss.maxHp);
        else this.bossHpText.setText('');
      }
    }

    updatePlayer(dt) {
      var inp = this.inputState;
      var spd = this.heroDef.speed;
      if (this.riding) spd *= 1.4;
      if (this.isJumping) {
        this.jumpVy += 0.6;
        this.jumpZ += this.jumpVy;
        if (this.jumpZ >= 0) { this.jumpZ = 0; this.isJumping = false; this.jumpVy = 0; }
      }
      var vx = 0, vy = 0;
      var canMove = this.attackLock <= 0 && !this.isDashing && this.throwTimer <= 0;
      if (canMove && !this.isJumping) {
        if (inp.left) { vx = -spd; this.facing = -1; }
        if (inp.right) { vx = spd; this.facing = 1; }
        if (inp.up) vy = -spd * 0.7;
        if (inp.down) vy = spd * 0.7;
      } else if (this.isJumping) {
        if (inp.left) { vx = -spd * 0.8; this.facing = -1; }
        if (inp.right) { vx = spd * 0.8; this.facing = 1; }
      }
      if (canMove && inp.attackPressed && Math.abs(vx) > spd * 0.5 && !this.isJumping) {
        this.isDashing = true; this.dashTimer = 220; this.attackLock = 220;
        AudioFX.swing(); this.doAttack('dash');
      } else if (inp.attackPressed && this.attackLock <= 0) {
        if (this.isJumping) {
          this.attackLock = 200; AudioFX.swing(); this.doAttack('jump');
        } else if (this.heroDef.id === 'barbarian' && this.comboCount >= 2) {
          this.attackLock = this.heroDef.attackFrames * 20;
          AudioFX.swing(); this.doAttack('slam'); this.comboCount = 0;
        } else {
          var grabbed = this.tryGrab();
          if (!grabbed) {
            this.attackLock = this.heroDef.attackFrames * 16;
            AudioFX.swing();
            this.comboCount++;
            this.comboTimer = this.heroDef.comboWindow;
            var kind = this.comboCount >= 3 ? 'attack2' : 'attack';
            this.doAttack(kind);
            if (this.comboCount >= 3) this.comboCount = 0;
          }
        }
      }
      if (inp.jumpPressed && !this.isJumping && this.attackLock <= 0) {
        if (this.riding) { this.dismount(); }
        else {
          this.isJumping = true; this.jumpVy = -9; this.jumpZ = -0.1; AudioFX.jump();
        }
      }
      if (inp.magicPressed && this.potions > 0 && !this.magicBusy) this.castMagic();
      if (!this.riding && inp.up) this.tryMount();
      if (this.isDashing) {
        vx = this.facing * spd * 2.2; vy = 0;
        if (this.dashTimer <= 0) this.isDashing = false;
      }
      this.player.setVelocity(vx, this.isJumping ? 0 : vy);
      if (!this.isJumping) {
        this.player.y = clampY(this.player.y);
        this.baseY = this.player.y;
      } else {
        this.player.y = this.baseY;
      }
      this.animTimer += dt;
      var tex, face = this.facing < 0 ? '_L' : '';
      if (this.invuln > 0 && Math.floor(this.invuln / 50) % 2 === 0) this.player.setAlpha(0.5);
      else this.player.setAlpha(1);
      if (this.attackLock > 0) {
        if (this.lastAttackKind === 'slam') tex = this.heroDef.id + '_slam' + face;
        else if (this.lastAttackKind === 'attack2') tex = this.heroDef.id + '_attack2' + face;
        else tex = this.heroDef.id + '_attack' + face;
      } else if (this.isJumping) {
        tex = this.heroDef.id + '_jump' + face;
      } else if (Math.abs(vx) > 10 || Math.abs(vy) > 10) {
        if (this.animTimer > 120) { this.animTimer = 0; this.walkFrame = 1 - this.walkFrame; }
        tex = this.heroDef.id + '_' + (this.walkFrame ? 'walk1' : 'walk2') + face;
      } else {
        tex = this.heroDef.id + '_idle' + face;
      }
      this.player.setTexture(tex);
      this.player.y = this.baseY + this.jumpZ;
      this.player.setDepth(depthY(this.baseY));
      this.shadow.setPosition(this.player.x, this.baseY + 4);
      this.shadow.setAlpha(this.isJumping ? 0.2 : 0.35);
      this.shadow.setScale(this.isJumping ? 0.7 : 1);
    }

    doAttack(kind) {
      this.lastAttackKind = kind;
      var range = kind === 'dash' ? 50 : kind === 'slam' ? 55 : 42;
      var dmg = this.heroDef.damage;
      if (kind === 'slam') dmg *= 2;
      if (kind === 'attack2') dmg *= 1.5;
      if (kind === 'dash') dmg *= 1.3;
      if (kind === 'jump') dmg *= 1.4;
      if (this.riding) dmg *= 1.2;
      var self = this, hitAny = false;
      this.enemies.children.each(function (e) {
        if (!e.active || e.hp <= 0) return;
        if (!onSameLane({ y: self.baseY }, e, kind === 'slam' ? 40 : 28) && !self.isJumping) return;
        var dx = e.x - self.player.x;
        if (self.facing > 0 && dx < 0) return;
        if (self.facing < 0 && dx > 0) return;
        if (Math.abs(dx) > range) return;
        if (kind === 'jump' && Math.abs(e.y - self.baseY) > 36) return;
        self.damageEnemy(e, dmg);
        hitAny = true;
      });
      if (hitAny) this.cameras.main.shake(60, 0.004);
    }

    tryGrab() {
      if (this.heroDef.id === 'dwarf') return false;
      var self = this, target = null;
      this.enemies.children.each(function (e) {
        if (!e.active || e.hp <= 0 || e.isBoss || e.type === 'beast') return;
        if (!onSameLane({ y: self.baseY }, e, 24)) return;
        var dx = e.x - self.player.x;
        if (Math.abs(dx) < 30 && Math.abs(dx) > 4 && ((self.facing > 0 && dx > 0) || (self.facing < 0 && dx < 0))) {
          if (e.hurtTimer > 0 || e.hp <= e.maxHp * 0.4) target = e;
        }
      });
      if (!target) return false;
      AudioFX.hit();
      this.throwTimer = 300; this.attackLock = 300;
      var dir = this.facing;
      target.hp = 0;
      this.tweens.add({
        targets: target, x: target.x + dir * 180, y: target.y - 40, alpha: 0.3, duration: 350,
        onComplete: function () {
          self.killEnemy(target, true);
          self.enemies.children.each(function (e) {
            if (!e.active || e === target) return;
            if (Math.abs(e.x - target.x) < 60 && onSameLane(e, target, 36)) {
              self.damageEnemy(e, self.heroDef.damage * 1.5);
            }
          });
        }
      });
      this.comboCount = 0; this.lastAttackKind = 'attack';
      return true;
    }

    tryMount() {
      var self = this;
      this.enemies.children.each(function (e) {
        if (!e.active || !e.rideable || e.hp <= 0) return;
        if (Math.abs(e.x - self.player.x) < 36 && onSameLane({ y: self.baseY }, e, 24)) {
          self.riding = e; e.state = 'ridden'; e.setAlpha(0.9); AudioFX.pickup();
        }
      });
    }

    dismount() {
      if (!this.riding) return;
      this.riding.state = 'chase'; this.riding.setAlpha(1); this.riding = null;
    }

    damageEnemy(e, dmg) {
      if (e.hp <= 0) return;
      e.hp -= dmg; e.hurtTimer = 200; e.setTint(0xffffff);
      AudioFX.hit(); this.spawnSpark(e.x, e.y - 20);
      this.cameras.main.shake(40, 0.003);
      e.x += this.facing * 12;
      if (e.hp <= 0) this.killEnemy(e, false);
      else {
        this.time.delayedCall(80, function () { if (e.active) e.clearTint(); });
      }
    }

    killEnemy(e, fromThrow) {
      if (!e.active) return;
      if (this.riding === e) this.dismount();
      e.hp = 0; AudioFX.death();
      this.score += e.scoreValue || 100; this.updateHUD();
      try {
        var hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;
        if (this.score > hs) localStorage.setItem(HS_KEY, String(this.score));
      } catch (err) {}
      if (e.type === 'thief' || Math.random() < 0.12) this.spawnPotion(e.x, e.y);
      var face = e.facing < 0 ? '_L' : '';
      e.setTexture(e.type + '_death' + face);
      e.body.enable = false;
      var self = this, flashes = 0;
      this.time.addEvent({
        delay: 80, repeat: 5,
        callback: function () {
          flashes++;
          if (!e.active) return;
          e.setAlpha(flashes % 2 === 0 ? 1 : 0.2);
          e.setTint(flashes % 2 === 0 ? 0xffffff : 0x88ffff);
          if (flashes >= 5) {
            if (e.shadow) e.shadow.destroy();
            e.destroy();
            self.waveEnemiesLeft = Math.max(0, self.waveEnemiesLeft - 1);
          }
        }
      });
    }

    spawnPotion(x, y) {
      var p = this.pickups.create(x, y - 10, 'potion');
      p.body.setAllowGravity(false);
      p.setDepth(depthY(y));
    }

    spawnSpark(x, y) {
      var s = this.add.image(x, y, 'spark').setDepth(900);
      this.tweens.add({ targets: s, alpha: 0, scale: 2, y: y - 20, duration: 200, onComplete: function () { s.destroy(); } });
    }

    updateEnemies(dt) {
      var self = this;
      this.enemies.children.each(function (e) {
        if (!e.active || e.hp <= 0) return;
        if (e.state === 'ridden') {
          e.x = self.player.x + self.facing * 4;
          e.y = self.baseY + 4;
          e.setDepth(depthY(e.y) - 1);
          if (e.shadow) e.shadow.setPosition(e.x, e.y + 4);
          return;
        }
        if (e.hurtTimer > 0) {
          e.hurtTimer -= dt; e.setVelocity(0, 0);
          var face = e.facing < 0 ? '_L' : '';
          e.setTexture(e.type + '_hurt' + face);
          if (e.shadow) e.shadow.setPosition(e.x, e.y + 4);
          e.setDepth(depthY(e.y));
          return;
        }
        if (e.attackCd > 0) e.attackCd -= dt;
        var dx = self.player.x - e.x;
        var dy = self.baseY - e.y;
        e.facing = dx < 0 ? -1 : 1;
        if (e.state === 'flee' || e.type === 'thief') {
          var fleeDir = e.x < self.cameras.main.scrollX + W / 2 ? -1 : 1;
          if (Math.abs(dx) < 80) fleeDir = dx < 0 ? 1 : -1;
          e.setVelocity(fleeDir * e.speed * 1.3, Math.sin(Date.now() / 200) * 20);
          if (e.x < self.cameras.main.scrollX - 80 || e.x > self.cameras.main.scrollX + W + 80) {
            if (e.shadow) e.shadow.destroy();
            e.destroy();
            self.waveEnemiesLeft = Math.max(0, self.waveEnemiesLeft - 1);
            return;
          }
        } else {
          var dist = Math.abs(dx);
          var sameLane = Math.abs(dy) < 24;
          if (dist < 36 && sameLane && e.attackCd <= 0 && !self.isJumping) {
            e.setVelocity(0, 0);
            e.attackCd = e.isBoss ? 900 : 1100;
            var face2 = e.facing < 0 ? '_L' : '';
            e.setTexture(e.type + '_attack' + face2);
            if (self.invuln <= 0 && self.playerHP > 0) self.hurtPlayer(e.damage);
          } else {
            var spd = e.speed, vx = 0, vy = 0;
            if (dist > 30) vx = Math.sign(dx) * spd;
            if (Math.abs(dy) > 10) vy = Math.sign(dy) * spd * 0.65;
            e.setVelocity(vx, vy);
            e.y = clampY(e.y);
          }
        }
        e.animT += dt;
        if (e.attackCd <= 0 || e.attackCd > 800) {
          var moving = Math.abs(e.body.velocity.x) > 5 || Math.abs(e.body.velocity.y) > 5;
          var face3 = e.facing < 0 ? '_L' : '';
          if (moving) {
            if (e.animT > 140) { e.animT = 0; e.walkF = 1 - e.walkF; }
            e.setTexture(e.type + '_' + (e.walkF ? 'walk1' : 'walk2') + face3);
          } else if (e.attackCd <= 0) {
            e.setTexture(e.type + '_idle' + face3);
          }
        }
        e.setDepth(depthY(e.y));
        if (e.shadow) e.shadow.setPosition(e.x, e.y + 4);
      });
    }

    hurtPlayer(dmg) {
      if (this.invuln > 0 || this.playerHP <= 0) return;
      this.playerHP -= dmg; this.invuln = 1000;
      AudioFX.hurt(); this.cameras.main.shake(120, 0.01);
      this.player.setTint(0xff6666);
      var self = this;
      this.time.delayedCall(150, function () { self.player.clearTint(); });
      this.updateHUD();
      if (this.playerHP <= 0) this.playerDeath();
    }

    playerDeath() {
      AudioFX.death(); this.dismount();
      var face = this.facing < 0 ? '_L' : '';
      this.player.setTexture(this.heroDef.id + '_death' + face);
      this.player.setVelocity(0, 0);
      this.lives--; this.updateHUD();
      var self = this;
      if (this.lives < 0) {
        this.time.delayedCall(800, function () { self.gameOver(); });
      } else {
        this.time.delayedCall(1000, function () {
          self.playerHP = self.playerMaxHP; self.invuln = 2000;
          self.player.x = self.cameras.main.scrollX + 120;
          self.baseY = 400; self.player.y = 400;
          self.jumpZ = 0; self.isJumping = false; self.updateHUD();
        });
      }
    }

    updatePickups() {
      var self = this;
      this.pickups.children.each(function (p) {
        if (!p.active) return;
        if (Phaser.Math.Distance.Between(p.x, p.y, self.player.x, self.player.y) < 32) {
          if (self.potions < POTION_CAP) self.potions++;
          AudioFX.pickup(); self.updateHUD(); p.destroy();
        }
      });
    }

    syncDepth() { this.player.setDepth(depthY(this.baseY)); }

    checkWaveClear() {
      if (this.stageClear || this.magicBusy) return;
      var alive = 0;
      this.enemies.children.each(function (e) { if (e.active && e.hp > 0) alive++; });
      this.waveEnemiesLeft = alive;
      if (alive === 0) {
        if (!this.bossSpawned && this.waveIndex >= this.stage.waves.length) {
          this.spawnBoss();
        } else if (!this.bossSpawned) {
          if (!this._waveDelay) {
            this._waveDelay = true;
            var self = this;
            this.time.delayedCall(900, function () { self._waveDelay = false; self.spawnWave(); });
          }
        } else {
          this.onStageClear();
        }
      }
    }

    onStageClear() {
      if (this.stageClear) return;
      this.stageClear = true;
      AudioFX.stopMusic(); AudioFX.win();
      var self = this;
      var msg = this.stageNum >= 3 ? 'YOU SAVED THE LAND!' : 'STAGE CLEAR!';
      this.add.text(W / 2, H / 2, msg, {
        fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ffcc33',
        stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
      this.time.delayedCall(2200, function () {
        if (self.stageNum >= 3) self.victory();
        else {
          self.scene.start('Game', {
            heroIndex: self.heroIndex, stage: self.stageNum + 1,
            lives: self.lives, score: self.score + 500, potions: self.potions
          });
        }
      });
    }

    // Magic: spends ALL potions. Tier 1=small, 2=medium, 3+=MAX
    castMagic() {
      if (this.potions <= 0 || this.magicBusy) return;
      var used = this.potions;
      var tier = used >= 3 ? 3 : used;
      this.potions = 0; this.updateHUD();
      this.magicBusy = true; this.player.setVelocity(0, 0);
      var type = this.heroDef.magic;
      if (type === 'earth') AudioFX.magicEarth(tier);
      else if (type === 'fire') AudioFX.magicFire(tier);
      else AudioFX.magicLightning(tier);
      var self = this;
      var baseDmg = 3 + tier * 3;
      if (type === 'fire') baseDmg += 1;
      if (type === 'earth') baseDmg += 1;
      var overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
      var flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.0);
      overlay.add(flash);
      if (type === 'earth') this.animEarth(overlay, tier, flash);
      else if (type === 'fire') this.animFire(overlay, tier, flash);
      else this.animLightning(overlay, tier, flash);
      this.cameras.main.shake(400 + tier * 200, 0.008 + tier * 0.006);
      var camX = this.cameras.main.scrollX;
      this.enemies.children.each(function (e) {
        if (!e.active || e.hp <= 0) return;
        if (e.x < camX - 20 || e.x > camX + W + 20) return;
        var dmg = baseDmg;
        if (e.isBoss) dmg = Math.ceil(dmg * 0.6);
        self.time.delayedCall(300 + Math.random() * 400, function () {
          if (e.active) self.damageEnemy(e, dmg);
        });
      });
      this.time.delayedCall(1200 + tier * 400, function () {
        overlay.destroy(); self.magicBusy = false;
      });
    }

    animEarth(overlay, tier, flash) {
      this.tweens.add({ targets: flash, fillAlpha: 0.35, duration: 100, yoyo: true });
      var g = this.add.graphics().setScrollFactor(0);
      overlay.add(g);
      g.lineStyle(3, 0x8b4513, 1);
      for (var i = 0; i < 4 + tier * 3; i++) {
        var x0 = 40 + Math.random() * (W - 80);
        g.lineBetween(x0, GROUND_TOP, x0 + (Math.random() - 0.5) * 80, H - 20);
        g.lineBetween(x0 + 10, GROUND_TOP + 30, x0 + (Math.random() - 0.5) * 100, H - 40);
      }
      var count = 6 + tier * 8;
      for (var r = 0; r < count; r++) {
        var rock = this.add.image(60 + Math.random() * (W - 120), -20 - Math.random() * 80, 'rock')
          .setScrollFactor(0).setScale(tier >= 3 ? 3 + Math.random() * 2 : 1.5 + Math.random());
        rock.setTint(tier >= 3 ? 0x888888 : 0x8b4513);
        overlay.add(rock);
        this.tweens.add({
          targets: rock, y: GROUND_TOP + 40 + Math.random() * 160,
          angle: 180 + Math.random() * 180, duration: 400 + Math.random() * 500,
          ease: 'Bounce.easeOut', delay: Math.random() * 300
        });
      }
      if (tier >= 3) {
        for (var b = 0; b < 4; b++) {
          var boulder = this.add.rectangle(
            100 + b * 220 + Math.random() * 40, -40, 50 + Math.random() * 30, 40 + Math.random() * 20, 0x666666
          ).setScrollFactor(0);
          overlay.add(boulder);
          this.tweens.add({ targets: boulder, y: 380 + Math.random() * 80, duration: 600, delay: 100 + b * 80, ease: 'Cubic.easeIn' });
        }
        overlay.add(this.add.text(W / 2, 120, 'EARTHQUAKE!', {
          fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ddaa44', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0));
      } else if (tier === 2) {
        overlay.add(this.add.text(W / 2, 120, 'TREMOR!', {
          fontFamily: 'Courier New, monospace', fontSize: '32px', color: '#cc9944', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0));
      }
    }

    animFire(overlay, tier, flash) {
      flash.setFillStyle(0xff4400, 0);
      this.tweens.add({ targets: flash, fillAlpha: 0.4, duration: 150, yoyo: true, repeat: 2 });
      var count = 10 + tier * 12;
      for (var i = 0; i < count; i++) {
        var fl = this.add.image(40 + Math.random() * (W - 80), H - 20, 'flame')
          .setScrollFactor(0).setScale(1.5 + Math.random() * tier);
        overlay.add(fl);
        this.tweens.add({
          targets: fl, y: 80 + Math.random() * 200, alpha: 0, scale: 3,
          duration: 500 + Math.random() * 500, delay: Math.random() * 400
        });
      }
      for (var p = 0; p < 2 + tier * 2; p++) {
        var pillar = this.add.rectangle(80 + p * (W / (2 + tier * 2)), H, 30 + tier * 10, 0, 0xff6600, 0.7)
          .setOrigin(0.5, 1).setScrollFactor(0);
        overlay.add(pillar);
        this.tweens.add({ targets: pillar, height: 200 + tier * 80, duration: 400, delay: p * 60, yoyo: true, hold: 300 });
      }
      if (tier >= 3) {
        var dragon = this.add.image(-80, 200, 'firedragon').setScrollFactor(0).setScale(2);
        overlay.add(dragon);
        this.tweens.add({ targets: dragon, x: W + 100, duration: 1400, ease: 'Sine.easeInOut' });
        overlay.add(this.add.text(W / 2, 100, 'FIRE DRAGON!', {
          fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ff6622', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0));
      } else if (tier === 2) {
        overlay.add(this.add.text(W / 2, 100, 'BLAZE!', {
          fontFamily: 'Courier New, monospace', fontSize: '32px', color: '#ff8844', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0));
      }
    }

    animLightning(overlay, tier, flash) {
      flash.setFillStyle(0xaaccff, 0);
      var self = this;
      var bolts = 2 + tier * 3;
      for (var i = 0; i < bolts; i++) {
        this.time.delayedCall(i * 120, (function (idx) {
          return function () {
            flash.setFillStyle(0xffffff, 0.7);
            self.tweens.add({ targets: flash, fillAlpha: 0, duration: 80 });
            var bx = 60 + Math.random() * (W - 120);
            var bolt = self.add.graphics().setScrollFactor(0);
            overlay.add(bolt);
            bolt.lineStyle(3 + tier, 0xffffaa, 1);
            var y = 0, x = bx;
            while (y < H - 40) {
              var nx = x + (Math.random() - 0.5) * 60;
              var ny = y + 30 + Math.random() * 40;
              bolt.lineBetween(x, y, nx, ny);
              if (Math.random() < 0.4) {
                bolt.lineStyle(2, 0xaaddff, 0.8);
                bolt.lineBetween(nx, ny, nx + (Math.random() - 0.5) * 80, ny + 40);
                bolt.lineStyle(3 + tier, 0xffffaa, 1);
              }
              x = nx; y = ny;
            }
            self.time.delayedCall(200, function () { bolt.clear(); });
          };
        })(i));
      }
      if (tier >= 3) {
        overlay.add(this.add.rectangle(W / 2, 60, W, 100, 0x222244, 0.7).setScrollFactor(0));
        overlay.add(this.add.text(W / 2, 100, 'THUNDER STORM!', {
          fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#aaccff', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0));
        this.tweens.add({ targets: flash, fillAlpha: 0.8, duration: 50, yoyo: true, repeat: 6, delay: 200 });
      } else if (tier === 2) {
        overlay.add(this.add.text(W / 2, 100, 'THUNDER!', {
          fontFamily: 'Courier New, monospace', fontSize: '32px', color: '#88bbff', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0));
      }
    }

    gameOver() {
      AudioFX.stopMusic(); AudioFX.gameOver();
      try {
        var hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;
        if (this.score > hs) localStorage.setItem(HS_KEY, String(this.score));
      } catch (e) {}
      this.scene.start('End', { win: false, score: this.score });
    }

    victory() {
      try {
        var hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;
        if (this.score > hs) localStorage.setItem(HS_KEY, String(this.score));
      } catch (e) {}
      this.scene.start('End', { win: true, score: this.score });
    }
  }

  class EndScene extends Phaser.Scene {
    constructor() { super('End'); }
    init(data) { this.win = data.win; this.score = data.score || 0; }
    create() {
      this.cameras.main.setBackgroundColor(0x0a0612);
      var hs = 0;
      try { hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch (e) {}
      this.add.text(W / 2, 140, this.win ? 'VICTORY!' : 'GAME OVER', {
        fontFamily: 'Courier New, monospace', fontSize: '52px',
        color: this.win ? '#ffcc33' : '#ff4444', stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5);
      this.add.text(W / 2, 240, 'SCORE: ' + this.score + '\nHIGH: ' + hs, {
        fontFamily: 'Courier New, monospace', fontSize: '24px', color: '#ffffff', align: 'center'
      }).setOrigin(0.5);
      this.add.text(W / 2, 360, 'PRESS ENTER TO RETURN', {
        fontFamily: 'Courier New, monospace', fontSize: '18px', color: '#aaaaaa'
      }).setOrigin(0.5);
      this.input.keyboard.once('keydown-ENTER', function () { AudioFX.select(); this.scene.start('Title'); }, this);
      this.input.keyboard.once('keydown-SPACE', function () { this.scene.start('Title'); }, this);
    }
  }

  var config = {
    type: Phaser.AUTO, width: W, height: H, parent: 'game-container',
    backgroundColor: '#0a0612', pixelArt: true, input: { gamepad: true },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, SelectScene, GameScene, EndScene]
  };

  function startGame() {
    if (window.game) return;
    window.__AXE_LEGENDS__ = { HEROES: HEROES, STAGES: STAGES };
    window.game = new Phaser.Game(config);
  }
  if (document.readyState === 'complete') startGame();
  else window.addEventListener('load', startGame);
})();
