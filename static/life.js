/* Cyber Mirage — life.js (3D)
   خلفية حيّة ثلاثية الأبعاد لكل صفحات الموقع:
   - كرة أرضية تدور وتصلها أقواس هجوم حمراء إلى الفخ (الرياض)
   - بدون مجسمات هندسية (CLEAN = true)
   - أرضية شبكية بمنظور تتحرك نحوك
   - مجسمات سلكية تدور (واحد أحمر = "مهاجم")
   - شبكة عقد ثلاثية الأبعاد تتمايل مع الماوس
   - نجوم بعمق تقترب ببطء + نجمة عابرة
   - حزم هجوم حمراء تسقط وتنحبس في الفخ (موجة سماوية)
   - تتغير ألوانها تلقائيًا مع الوضع النهاري/الليلي
   - ميلان للبطاقة الرئيسية يتبع المؤشر (الدخول والرئيسية) */
(function () {
  "use strict";
  if (window.__cmLife) return;
  window.__cmLife = true;

  function start() {
    // اتركيها false لتشتغل الحركة دايمًا حتى لو ويندوز مطفّي "تأثيرات الحركة". غيّريها true لاحترام إعداد الجهاز
    var RESPECT_REDUCED_MOTION = false;
    var reduce = RESPECT_REDUCED_MOTION && !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var dashboard = !!document.getElementById("total");
    var PH = (1 + Math.sqrt(5)) / 2;

    var cv = document.createElement("canvas");
    cv.id = "cmLife";
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block";
    document.body.insertBefore(cv, document.body.firstChild);

    var fallback = false;
    try {
      var bg = getComputedStyle(document.body).backgroundColor;
      if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(bg)) {
        fallback = true;
        cv.style.zIndex = "0";
        cv.style.mixBlendMode = "screen";
        cv.style.opacity = ".55";
      }
    } catch (e) {}

    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, DPR = 1, U = 300, F = 1200, CX = 0, CY = 0;
    var vol = { hx: 2, ymin: -1, ymax: 1, hz: 1.5 };
    var stars = [], nodes = [], shapes = [], packets = [], ripples = [];
    var shoot = null, nextShoot = 2500, nextPacket = 1200;
    var mx = 0, my = 0, tmx = 0, tmy = 0, last = 0, running = false, light = false, gridT = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    /* ---------- المجسمات ---------- */
    function makeGeo(kind) {
      var v = [], i, j;
      if (kind === "cube") {
        for (i = 0; i < 8; i++) v.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1]);
      } else if (kind === "oct") {
        v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      } else {
        v = [[0, 1, PH], [0, -1, PH], [0, 1, -PH], [0, -1, -PH], [1, PH, 0], [-1, PH, 0],
             [1, -PH, 0], [-1, -PH, 0], [PH, 0, 1], [PH, 0, -1], [-PH, 0, 1], [-PH, 0, -1]];
      }
      var m = 0;
      for (i = 0; i < v.length; i++) m = Math.max(m, Math.sqrt(v[i][0] * v[i][0] + v[i][1] * v[i][1] + v[i][2] * v[i][2]));
      for (i = 0; i < v.length; i++) v[i] = [v[i][0] / m, v[i][1] / m, v[i][2] / m];
      function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
      var dmin = 1e9;
      for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++) dmin = Math.min(dmin, d2(v[i], v[j]));
      var e = [];
      for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++) if (d2(v[i], v[j]) < dmin * 1.05) e.push([i, j]);
      return { v: v, e: e };
    }
    var CLEAN = true;   // مظهر احترافي هادئ: بدون مجسمات سلكية. غيّريها إلى false لو تبين المجسمات
    var GEO = { cube: makeGeo("cube"), oct: makeGeo("oct"), ico: makeGeo("ico") };

    var ANCHORS = [
      { k: "ico", fx: 0.10, fy: 0.14, z: -0.3, size: 0.55, hot: false },
      { k: "cube", fx: 0.89, fy: 0.15, z: 0.2, size: 0.48, hot: false },
      { k: "oct", fx: 0.14, fy: 0.80, z: 0.4, size: 0.42, hot: false },
      { k: "ico", fx: 0.86, fy: 0.78, z: -0.2, size: 0.40, hot: true }
    ];

    /* ---------- الكرة الأرضية ---------- */
    var LAND = [
      [[-168,66],[-162,70],[-140,70],[-125,70],[-95,72],[-82,69],[-80,63],[-94,59],[-92,57],[-82,55],[-79,51],[-78,58],[-70,60],[-62,57],[-56,52],[-66,45],[-70,42],[-75,38],[-76,35],[-81,31],[-80,26],[-82,28],[-84,30],[-90,29],[-97,27],[-97,22],[-92,19],[-87,21],[-88,16],[-83,15],[-83,10],[-78,8],[-72,12],[-62,10],[-52,5],[-50,0],[-44,-2],[-35,-5],[-39,-14],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-62,-39],[-65,-45],[-68,-50],[-69,-54],[-73,-52],[-75,-46],[-73,-38],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,0],[-78,3],[-80,7],[-86,11],[-92,15],[-97,16],[-105,20],[-110,24],[-112,29],[-117,33],[-121,35],[-124,40],[-124,47],[-130,54],[-138,59],[-148,60],[-158,57],[-165,60],[-166,63]],
      [[-55,60],[-44,60],[-20,70],[-20,80],[-45,83],[-65,80],[-70,76],[-58,75],[-52,68]],
      [[-9,37],[-9,43],[-1,46],[-4,48],[2,51],[8,54],[10,57],[14,54],[21,55],[24,59],[30,60],[34,66],[41,67],[44,68],[60,69],[70,73],[80,73],[100,77],[112,74],[130,71],[142,72],[160,70],[170,70],[180,66],[178,62],[165,60],[160,54],[156,51],[155,58],[142,59],[136,54],[141,48],[135,43],[130,42],[129,35],[126,35],[126,38],[122,40],[121,37],[119,35],[122,30],[120,26],[116,22],[110,20],[108,22],[106,19],[109,12],[105,9],[100,13],[100,6],[103,1],[98,8],[98,16],[94,17],[92,22],[88,22],[80,15],[78,8],[73,17],[72,21],[67,24],[62,25],[57,26.5],[54,27],[51,28],[48,30],[50,26],[52,24],[56,24.5],[59,22],[52,16],[44,12.5],[39,21],[35,28],[35,33],[36,36.5],[30,36],[26,38],[26,41],[20,40],[16,38],[12,42],[8,44],[3,43],[0,39],[-2,37],[-6,36]],
      [[5,58],[5,62],[14,68],[25,71],[31,70],[28,66],[22,65],[17,61],[16,56],[11,58]],
      [[32,31],[25,32],[20,31],[10,34],[10,37],[0,36],[-6,36],[-10,30],[-17,21],[-17,14],[-12,8],[-8,4],[0,5],[8,4],[9,-1],[13,-10],[12,-17],[15,-27],[18,-34],[26,-34],[33,-27],[35,-20],[40,-15],[40,-5],[48,5],[51,12],[43,12],[38,18],[34,27],[32,30]],
      [[44,-25],[47,-25],[50,-15],[49,-12],[44,-17]],
      [[-5,50],[1,51],[2,53],[-2,57],[-5,58],[-6,56],[-3,54],[-5,52]],
      [[-10,52],[-6,52],[-6,55],[-9,54]],
      [[-24,64],[-14,64],[-14,66],[-22,66]],
      [[130,31],[135,33],[140,35],[142,40],[141,45],[139,41],[136,36],[131,34]],
      [[95,5],[98,4],[104,-2],[106,-6],[102,-4],[96,2]],
      [[109,1],[113,3],[117,7],[119,1],[116,-3],[110,-3]],
      [[105,-6],[114,-8],[114,-9],[106,-7]],
      [[131,-1],[141,-3],[150,-10],[142,-9],[138,-8],[132,-4]],
      [[114,-22],[122,-18],[130,-12],[136,-12],[137,-16],[142,-11],[146,-19],[153,-26],[151,-34],[147,-39],[141,-38],[135,-35],[131,-31],[124,-34],[116,-35],[115,-30]],
      [[172,-34],[178,-38],[175,-41],[172,-41]],
      [[172,-41],[174,-42],[170,-46],[167,-46]]
    ];
    var CITIES = [[51.5, -0.1], [40.7, -74], [55.7, 37.6], [39.9, 116.4], [-23.5, -46.6], [6.5, 3.4],
                  [19, 72.9], [-33.9, 151.2], [1.3, 103.8], [34, -118], [52.5, 13.4], [35.7, 139.7]];
    var TARGET = [24.7, 46.7];                      // الرياض = مكان الفخ
    var DEG = Math.PI / 180;
    var gLand = [], gSea = [], gArcs = [], gNextArc = 800, gPulse = [];

    function inLand(lon, lat) {
      if (lat < -68) return true;
      for (var p = 0; p < LAND.length; p++) {
        var poly = LAND[p], c = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
          if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c;
        }
        if (c) return true;
      }
      return false;
    }
    function ll2v(lat, lon) {
      var cl = Math.cos(lat * DEG);
      return [cl * Math.sin(lon * DEG), Math.sin(lat * DEG), cl * Math.cos(lon * DEG)];
    }
    (function buildGlobe() {
      var N = 24000, ga = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < N; i++) {
        var y = 1 - 2 * (i + 0.5) / N, rr = Math.sqrt(1 - y * y), th = ga * i;
        var x = Math.cos(th) * rr, z = Math.sin(th) * rr;
        var lat = Math.asin(y) / DEG, lon = Math.atan2(x, z) / DEG;
        if (inLand(lon, lat)) gLand.push(x, y, z);
        else if (i % 40 === 0) gSea.push(x, y, z);
      }
    })();

    function drawGlobe(t, still, dt, hyG, L, HOT, light) {
      var gr = Math.min(H * 0.8, W * 0.62);
      var gcx = W / 2 + mx * W * 0.015, gcy = hyG + gr * 0.36;
      var lon0 = (46.7 + 48 * Math.sin(t / 15000) + mx * 22) * DEG;
      var alpha = -0.22, ca = Math.cos(alpha), sa = Math.sin(alpha);
      var cY = Math.cos(-lon0), sY = Math.sin(-lon0);
      var tw = dashboard ? 0.7 : 1;
      var i, k, x, y, z, x1, z1, y2, z2, px, py;

      function proj(v, rad, out) {
        x = v[0] * rad; y = v[1] * rad; z = v[2] * rad;
        x1 = x * cY + z * sY; z1 = -x * sY + z * cY;
        y2 = y * ca - z1 * sa; z2 = y * sa + z1 * ca;
        out[0] = gcx + x1 * gr; out[1] = gcy - y2 * gr; out[2] = z2; out[3] = x1; out[4] = y2;
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, hyG + 1); ctx.clip();
      ctx.globalAlpha = tw;

      // هالة الغلاف الجوي
      var ag = ctx.createRadialGradient(gcx, gcy, gr * 0.9, gcx, gcy, gr * 1.28);
      ag.addColorStop(0, "rgba(" + L + "," + (light ? ".12" : ".13") + ")");
      ag.addColorStop(0.35, "rgba(" + L + "," + (light ? ".04" : ".05") + ")");
      ag.addColorStop(1, "rgba(" + L + ",0)");
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(gcx, gcy, gr * 1.28, 0, 6.2832); ctx.fill();

      // جسم الكرة
      var bg2 = ctx.createRadialGradient(gcx - gr * 0.25, gcy - gr * 0.55, gr * 0.1, gcx, gcy, gr);
      if (light) { bg2.addColorStop(0, "rgba(255,255,255,.55)"); bg2.addColorStop(1, "rgba(170,195,235,.30)"); }
      else { bg2.addColorStop(0, "rgba(40,56,80,.55)"); bg2.addColorStop(1, "rgba(20,28,42,.72)"); }
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(gcx, gcy, gr, 0, 6.2832); ctx.fill();

      // خطوط الطول والعرض
      var GP = [0, 0, 0, 0, 0], gv = [0, 0, 0], gl, gk, gseg;
      ctx.lineWidth = 0.8;
      for (gl = -60; gl <= 60; gl += 30) {
        gseg = false; ctx.strokeStyle = "rgba(" + L + ",.10)"; ctx.beginPath();
        for (gk = 0; gk <= 72; gk++) {
          var gv0 = ll2v(gl, gk * 5 - 180); proj(gv0, 1, GP);
          if (GP[2] <= 0) { gseg = false; continue; }
          if (!gseg) { ctx.moveTo(GP[0], GP[1]); gseg = true; } else ctx.lineTo(GP[0], GP[1]);
        }
        ctx.stroke();
      }
      for (gl = 0; gl < 360; gl += 30) {
        gseg = false; ctx.beginPath();
        for (gk = 0; gk <= 36; gk++) {
          var gv1 = ll2v(gk * 5 - 90, gl); proj(gv1, 1, GP);
          if (GP[2] <= 0) { gseg = false; continue; }
          if (!gseg) { ctx.moveTo(GP[0], GP[1]); gseg = true; } else ctx.lineTo(GP[0], GP[1]);
        }
        ctx.stroke();
      }

      // نقاط البحر ثم اليابسة
      var P = [0, 0, 0, 0, 0], v = [0, 0, 0];
      ctx.fillStyle = "rgba(" + L + ",.10)";
      for (i = 0; i < gSea.length; i += 3) {
        v[0] = gSea[i]; v[1] = gSea[i + 1]; v[2] = gSea[i + 2];
        proj(v, 1, P);
        if (P[2] > 0.05) ctx.fillRect(P[0] - 0.5, P[1] - 0.5, 1, 1);
      }
      for (i = 0; i < gLand.length; i += 3) {
        v[0] = gLand[i]; v[1] = gLand[i + 1]; v[2] = gLand[i + 2];
        proj(v, 1, P);
        if (P[2] > 0.02) {
          var la = 0.35 + 0.65 * P[2], sz = 0.9 + 1.2 * P[2];
          ctx.fillStyle = "rgba(" + L + "," + la.toFixed(2) + ")";
          ctx.fillRect(P[0] - sz / 2, P[1] - sz / 2, sz, sz);
        }
      }

      // حافة الكرة
      var rg = ctx.createLinearGradient(gcx, gcy - gr, gcx, gcy);
      rg.addColorStop(0, "rgba(" + L + ",.5)"); rg.addColorStop(1, "rgba(" + L + ",.15)");
      ctx.strokeStyle = rg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gcx, gcy, gr, 0, 6.2832); ctx.stroke();

      // علامة الفخ + نبضة
      var tv = ll2v(TARGET[0], TARGET[1]), TP = [0, 0, 0, 0, 0];
      proj(tv, 1, TP);
      var tvis = TP[2] > 0;

      // أقواس الهجوم
      if (!still) {
        if (t > gNextArc) {
          var c = CITIES[(Math.random() * CITIES.length) | 0];
          var a = ll2v(c[0], c[1]), b = tv;
          var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
          gArcs.push({ a: a, b: b, ang: Math.acos(dot), t0: t, dur: rnd(2000, 2800) });
          gNextArc = t + (dashboard ? rnd(1400, 2400) : rnd(900, 1700));
        }
      }
      var AP = [0, 0, 0, 0, 0], prev = null, pv = [0, 0, 0];
      for (i = gArcs.length - 1; i >= 0; i--) {
        var ar = gArcs[i], p = (t - ar.t0) / ar.dur;
        if (p >= 1.35) { gArcs.splice(i, 1); continue; }
        var head = Math.min(1, p), tail = Math.max(0, p - 1) / 0.35;
        var sn = Math.sin(ar.ang) || 1e-6, hh = 0.07 + 0.2 * ar.ang / Math.PI;
        prev = null;
        for (k = 0; k <= 36; k++) {
          var s = k / 36;
          if (s > head || s < tail) { prev = null; continue; }
          var w1 = Math.sin((1 - s) * ar.ang) / sn, w2 = Math.sin(s * ar.ang) / sn;
          pv[0] = w1 * ar.a[0] + w2 * ar.b[0]; pv[1] = w1 * ar.a[1] + w2 * ar.b[1]; pv[2] = w1 * ar.a[2] + w2 * ar.b[2];
          proj(pv, 1 + hh * Math.sin(Math.PI * s), AP);
          var seen = AP[2] > 0 || (AP[3] * AP[3] + AP[4] * AP[4] > 1);
          if (!seen) { prev = null; continue; }
          if (prev) {
            ctx.strokeStyle = "rgba(" + HOT + "," + (0.25 + 0.6 * (s - tail)).toFixed(2) + ")";
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(AP[0], AP[1]); ctx.stroke();
          }
          prev = [AP[0], AP[1]];
          if (k === 36 || (s + 1 / 36 > head && head < 1)) {
            ctx.fillStyle = "rgba(" + HOT + ",.95)";
            ctx.beginPath(); ctx.arc(AP[0], AP[1], 2.4, 0, 6.2832); ctx.fill();
          }
        }
        if (p >= 1 && !ar.hit) { ar.hit = true; gPulse.push(t); }
      }

      if (tvis) {
        var pr = 0.5 + 0.5 * Math.sin(t * 0.004);
        ctx.fillStyle = "rgba(" + L + ",.95)";
        ctx.beginPath(); ctx.arc(TP[0], TP[1], 3.2, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = "rgba(" + L + "," + (0.35 + 0.3 * pr).toFixed(2) + ")"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(TP[0], TP[1], 7 + 3 * pr, 0, 6.2832); ctx.stroke();
      }
      // موجة الاصطدام على سطح الكرة
      for (i = gPulse.length - 1; i >= 0; i--) {
        var q = (t - gPulse[i]) / 1500;
        if (q >= 1) { gPulse.splice(i, 1); continue; }
        var rho = (0.03 + 0.2 * q), cr = Math.cos(rho), sr = Math.sin(rho);
        // قاعدة متعامدة حول الهدف
        var up = Math.abs(tv[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        var e1 = [tv[1] * up[2] - tv[2] * up[1], tv[2] * up[0] - tv[0] * up[2], tv[0] * up[1] - tv[1] * up[0]];
        var el1 = Math.sqrt(e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2]);
        e1 = [e1[0] / el1, e1[1] / el1, e1[2] / el1];
        var e2 = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        ctx.strokeStyle = "rgba(" + HOT + "," + ((1 - q) * 0.8).toFixed(2) + ")"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        var started = false;
        for (k = 0; k <= 32; k++) {
          var th2 = k / 32 * 6.2832, ct = Math.cos(th2), st2 = Math.sin(th2);
          pv[0] = cr * tv[0] + sr * (ct * e1[0] + st2 * e2[0]);
          pv[1] = cr * tv[1] + sr * (ct * e1[1] + st2 * e2[1]);
          pv[2] = cr * tv[2] + sr * (ct * e1[2] + st2 * e2[2]);
          proj(pv, 1.002, AP);
          if (AP[2] <= 0) { started = false; continue; }
          if (!started) { ctx.moveTo(AP[0], AP[1]); started = true; } else ctx.lineTo(AP[0], AP[1]);
        }
        ctx.stroke();
      }

      // تلاشي ناعم عند الأفق
      var fg = ctx.createLinearGradient(0, hyG - 70, 0, hyG);
      fg.addColorStop(0, "rgba(" + L + ",0)"); fg.addColorStop(1, "rgba(" + L + "," + (light ? ".10" : ".12") + ")");
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg; ctx.fillRect(0, hyG - 70, W, 71);
      ctx.restore();
    }

    function seed() {
      var area = W * H, i;
      U = Math.min(H * 0.42, W * 0.34);
      F = U * 4; CX = W / 2; CY = H * 0.42;

      var ns = Math.min(150, Math.round(area / 11000));
      stars = [];
      for (i = 0; i < ns; i++) stars.push({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1), sp: rnd(0.6, 1.4) });

      vol.hx = W / (2 * U) * 1.1;
      vol.ymin = -0.45 * H / U; vol.ymax = 0.16 * H / U; vol.hz = 1.5;
      var nn = CLEAN ? (dashboard ? 0 : Math.min(18, Math.round(area / 60000))) : (dashboard ? Math.min(30, Math.round(area / 48000)) : Math.min(64, Math.round(area / 24000)));
      nodes = [];
      for (i = 0; i < nn; i++) {
        nodes.push({ x: rnd(-vol.hx, vol.hx), y: rnd(vol.ymin, vol.ymax), z: rnd(-vol.hz, vol.hz),
          vx: rnd(-0.05, 0.05), vy: rnd(-0.03, 0.03), vz: rnd(-0.05, 0.05), hot: i % 8 === 0, p: rnd(0, 6.28), px: 0, py: 0, ps: 1 });
      }

      shapes = [];
      (CLEAN ? [] : ANCHORS).forEach(function (a, idx) {
        var s = F / (a.z + 4);
        shapes.push({ g: GEO[a.k], size: a.size, hot: a.hot, wx: (a.fx * W - CX) / s, wy: (a.fy * H - CY) / s, wz: a.z,
          rx: rnd(0.00018, 0.00032) * (idx % 2 ? 1 : -1), ry: rnd(0.0003, 0.00048), p: rnd(0, 6.28) });
      });
    }

    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
      if (reduce) frame(performance.now(), true);
    }

    /* ---------- الرسم ---------- */
    function frame(t, still) {
      var dt = still ? 0 : Math.min(50, t - (last || t)) / 16.67;
      last = t;
      var i, j, a, b, d, k;

      var nowLight = document.body.classList.contains("light-mode");
      if (nowLight !== light) {
        light = nowLight;
        if (fallback) cv.style.mixBlendMode = light ? "multiply" : "screen";
      }
      var L = light ? "79,127,150" : "143,184,201";
      var HOT = light ? "196,106,106" : "217,154,154";
      var STAR = light ? "70,100,130" : "205,220,235";
      var VIO = light ? "110,120,170" : "120,135,185";

      var hyG = H * 0.62, Hd = H - hyG;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;

      ctx.clearRect(0, 0, W, H);

      // شفق
      var R = Math.max(W, H) * 0.5;
      var g1x = W * (0.25 + 0.08 * Math.sin(t / 9000));
      var g1 = ctx.createRadialGradient(g1x, H * 0.2, 0, g1x, H * 0.2, R);
      g1.addColorStop(0, "rgba(" + L + "," + (light ? ".05" : ".06") + ")"); g1.addColorStop(1, "rgba(" + L + ",0)");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      var g2x = W * (0.78 + 0.07 * Math.cos(t / 11000));
      var g2 = ctx.createRadialGradient(g2x, H * 0.34, 0, g2x, H * 0.34, R);
      g2.addColorStop(0, "rgba(" + VIO + "," + (light ? ".05" : ".07") + ")"); g2.addColorStop(1, "rgba(" + VIO + ",0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

      // أرضية شبكية بمنظور
      if (!still) gridT = (gridT + dt * 0.006) % 1;
      var vpx = CX + mx * W * 0.03;
      ctx.lineWidth = 1;
      for (i = 0; i < 16; i++) {
        var z = i + 1 - gridT;
        var gy = hyG + Hd / z;
        if (gy > H + 2) continue;
        var ga = Math.min(1, (gy - hyG) / (Hd * 0.55)) * (light ? 0.30 : 0.38);
        ctx.strokeStyle = "rgba(" + L + "," + ga.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      var bw = W / 7;
      for (i = -14; i <= 14; i++) {
        var gx = vpx + i * bw;
        var lg = ctx.createLinearGradient(vpx, hyG, gx, H);
        lg.addColorStop(0, "rgba(" + L + ",0)");
        lg.addColorStop(1, "rgba(" + L + "," + (light ? ".16" : ".18") + ")");
        ctx.strokeStyle = lg;
        ctx.beginPath(); ctx.moveTo(vpx, hyG); ctx.lineTo(gx, H); ctx.stroke();
      }

      // وهج الأفق
      ctx.save();
      ctx.translate(W / 2 + mx * 10, hyG);
      ctx.scale(1, 0.16);
      var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.55);
      hg.addColorStop(0, "rgba(" + L + "," + (light ? ".10" : ".14") + ")");
      hg.addColorStop(0.45, "rgba(" + L + ",.05)");
      hg.addColorStop(1, "rgba(" + L + ",0)");
      ctx.fillStyle = hg;
      ctx.fillRect(-W, -H, W * 2, H * 2);
      ctx.restore();

      // تموّج السراب فوق الأفق
      for (i = 0; i < 3; i++) {
        var yy = hyG - 4 - i * 6;
        ctx.strokeStyle = "rgba(" + L + "," + (0.16 - i * 0.04).toFixed(3) + ")";
        ctx.beginPath();
        for (var x = 0; x <= W; x += 12) {
          var y = yy + Math.sin(x * 0.02 + t * 0.0015 + i) * (1.5 + i * 0.8);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // نجوم بعمق
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!still) {
          s.z -= 0.0007 * dt * s.sp;
          if (s.z < 0.04) { s.x = rnd(-1, 1); s.y = rnd(-1, 1); s.z = 1; }
        }
        var sx = CX + (s.x / s.z) * W * 0.17 + mx * 22 * (1 - s.z);
        var sy = H * 0.3 + (s.y / s.z) * H * 0.17 + my * 12 * (1 - s.z);
        if (sx < 0 || sx > W || sy < 0 || sy > hyG) continue;
        var fr = 1 - s.z;
        ctx.fillStyle = "rgba(" + STAR + "," + Math.min(1, fr * 2.4 + 0.12).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(sx, sy, 0.35 + fr * 1.9, 0, 6.2832); ctx.fill();
      }

      // الكرة الأرضية
      drawGlobe(t, !!still, dt, hyG, L, HOT, light);

      // الكاميرا
      var yaw = 0.35 * Math.sin(t * 0.00012) + mx * 0.22, pitch = my * 0.12;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

      // شبكة عقد 3D
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        if (!still) {
          a.x += a.vx * dt * 0.1; a.y += a.vy * dt * 0.1; a.z += a.vz * dt * 0.1;
          if (a.x > vol.hx) a.x = -vol.hx; else if (a.x < -vol.hx) a.x = vol.hx;
          if (a.y > vol.ymax) a.y = vol.ymin; else if (a.y < vol.ymin) a.y = vol.ymax;
          if (a.z > vol.hz) a.z = -vol.hz; else if (a.z < -vol.hz) a.z = vol.hz;
        }
        var x1 = a.x * cyw + a.z * syw, z1 = -a.x * syw + a.z * cyw;
        var y2 = a.y * cp - z1 * sp, z2 = a.y * sp + z1 * cp;
        var sc = F / (z2 + 4);
        a.px = CX + x1 * sc; a.py = CY + y2 * sc; a.ps = sc / U;
      }
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          d = dx * dx + dy * dy + dz * dz;
          if (d < 0.7) {
            var df = Math.min(1.2, (a.ps + b.ps) / 2);
            var al = (1 - Math.sqrt(d) / 0.84) * 0.4 * df;
            ctx.strokeStyle = "rgba(" + ((a.hot || b.hot) ? HOT : L) + "," + al.toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
          }
        }
      }
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        var na = (0.35 + 0.45 * Math.min(1, a.ps * 0.8)).toFixed(3);
        if (a.hot) {
          var pr = 2 + 3 * (0.5 + 0.5 * Math.sin(t * 0.003 + a.p));
          ctx.strokeStyle = "rgba(" + HOT + ",.4)";
          ctx.beginPath(); ctx.arc(a.px, a.py, (pr + 2) * a.ps, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = "rgba(" + HOT + ",.9)";
          ctx.beginPath(); ctx.arc(a.px, a.py, 2.4 * a.ps, 0, 6.2832); ctx.fill();
        } else {
          ctx.fillStyle = "rgba(" + L + "," + na + ")";
          ctx.beginPath(); ctx.arc(a.px, a.py, 0.7 + 1.3 * a.ps, 0, 6.2832); ctx.fill();
        }
      }

      // مجسمات سلكية تدور
      for (i = 0; i < shapes.length; i++) {
        var sh = shapes[i], g = sh.g;
        var ax = t * sh.rx, ay = t * sh.ry;
        var cX = sh.wx, cY = sh.wy + Math.sin(t * 0.0009 + sh.p) * 0.07, cZ = sh.wz;
        var c1x = cX * cyw + cZ * syw, c1z = -cX * syw + cZ * cyw;
        var c2y = cY * cp - c1z * sp, c2z = cY * sp + c1z * cp;
        var cosx = Math.cos(ax), sinx = Math.sin(ax), cosy = Math.cos(ay), siny = Math.sin(ay);
        var P = [];
        for (k = 0; k < g.v.length; k++) {
          var v = g.v[k], vx = v[0] * sh.size, vy = v[1] * sh.size, vz = v[2] * sh.size;
          var yy1 = vy * cosx - vz * sinx, zz1 = vy * sinx + vz * cosx;
          var xx2 = vx * cosy + zz1 * siny, zz2 = -vx * siny + zz1 * cosy;
          var X = c1x + xx2, Y = c2y + yy1, Z = c2z + zz2;
          var zc = Z + 4;
          if (zc < 0.4) { P.push(null); continue; }
          var ss = F / zc;
          P.push([CX + X * ss, CY + Y * ss]);
        }
        var col = sh.hot ? HOT : L;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(" + col + ",.10)"; ctx.lineWidth = 5;
        ctx.beginPath();
        for (k = 0; k < g.e.length; k++) {
          var p1 = P[g.e[k][0]], p2 = P[g.e[k][1]];
          if (p1 && p2) { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(" + col + "," + (light ? ".45" : ".5") + ")"; ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (k = 0; k < g.e.length; k++) {
          var q1 = P[g.e[k][0]], q2 = P[g.e[k][1]];
          if (q1 && q2) { ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); }
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(" + col + ",.9)";
        for (k = 0; k < P.length; k++) {
          if (P[k]) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], 1.8, 0, 6.2832); ctx.fill(); }
        }
      }
      ctx.lineWidth = 1;

      if (!still) {
        // نجمة عابرة
        if (!shoot && t > nextShoot) {
          shoot = { x: rnd(W * 0.25, W * 0.95), y: rnd(0, H * 0.3), vx: -rnd(7, 10), vy: rnd(3, 4.5), life: 0 };
        }
        if (shoot) {
          shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life += dt;
          var la = Math.max(0, 1 - shoot.life / 55);
          var sg = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
          sg.addColorStop(0, "rgba(" + (light ? "70,100,130" : "230,238,246") + "," + la.toFixed(3) + ")");
          sg.addColorStop(1, "rgba(" + L + ",0)");
          ctx.strokeStyle = sg; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9); ctx.stroke();
          if (shoot.life > 55) { shoot = null; nextShoot = t + rnd(5000, 9000); }
        }

        // حزم هجوم حمراء تسقط في الفخ
        var ty0 = hyG + Hd * 0.18;
        if (t > nextPacket) {
          var side = Math.random(), px0, py0;
          if (side < 0.5) { px0 = rnd(0, W); py0 = -10; }
          else if (side < 0.75) { px0 = -10; py0 = rnd(0, H * 0.5); }
          else { px0 = W + 10; py0 = rnd(0, H * 0.5); }
          packets.push({ sx: px0, sy: py0, tx: W / 2 + rnd(-40, 40), ty: ty0, t0: t, dur: rnd(1800, 2600) });
          nextPacket = t + (dashboard ? rnd(3500, 6000) : rnd(2000, 3800));
        }
        for (i = packets.length - 1; i >= 0; i--) {
          var pk = packets[i];
          var p = (t - pk.t0) / pk.dur;
          if (p >= 1) { ripples.push({ x: pk.tx, y: pk.ty, t0: t }); packets.splice(i, 1); continue; }
          for (k = 0; k < 7; k++) {
            var q = Math.max(0, p - k * 0.012);
            var e = q * q * (3 - 2 * q);
            ctx.fillStyle = "rgba(" + HOT + "," + ((1 - k / 7) * 0.9).toFixed(3) + ")";
            ctx.beginPath();
            ctx.arc(pk.sx + (pk.tx - pk.sx) * e, pk.sy + (pk.ty - pk.sy) * e, 2.8 - k * 0.3, 0, 6.2832);
            ctx.fill();
          }
        }
        for (i = ripples.length - 1; i >= 0; i--) {
          var rp = ripples[i];
          var rt = (t - rp.t0) / 1400;
          if (rt >= 1) { ripples.splice(i, 1); continue; }
          ctx.save();
          ctx.translate(rp.x, rp.y);
          ctx.scale(1, 0.25);
          ctx.strokeStyle = "rgba(" + L + "," + ((1 - rt) * 0.8).toFixed(3) + ")";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 8 + rt * 90, 0, 6.2832); ctx.stroke();
          ctx.restore();
        }
      }
    }

    function loop(t) {
      if (!running) return;
      if (!document.hidden) frame(t, false);
      requestAnimationFrame(loop);
    }
    function begin() {
      if (reduce || running) return;
      running = true; last = 0;
      requestAnimationFrame(loop);
    }

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 150); });
    window.addEventListener("pointermove", function (e) {
      tmx = (e.clientX / (W || 1) - 0.5) * 2;
      tmy = (e.clientY / (H || 1) - 0.5) * 2;
    }, { passive: true });

    size();
    begin();

    /* ===== ميلان البطاقة (الدخول والرئيسية فقط) ===== */
    try {
      var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      var card = document.querySelector("body > .card, .card");
      if (!dashboard && !reduce && fine && card) {
        var st = document.createElement("style");
        st.textContent =
          ".cm-tilt{position:relative;will-change:transform}" +
          ".cm-tilt::before{content:'';position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;pointer-events:none;" +
          "background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),rgba(143,184,201,.08),transparent 62%);opacity:0;transition:opacity .3s ease}" +
          ".cm-tilt:hover::before{opacity:1}";
        document.head.appendChild(st);
        card.classList.add("cm-tilt");
        card.style.transition = "transform .18s ease-out";
        document.addEventListener("pointermove", function (e) {
          var r = card.getBoundingClientRect();
          var cx2 = r.left + r.width / 2, cy2 = r.top + r.height / 2;
          var dx2 = Math.max(-1, Math.min(1, (e.clientX - cx2) / (W / 2)));
          var dy2 = Math.max(-1, Math.min(1, (e.clientY - cy2) / (H / 2)));
          card.style.transform = "perspective(1000px) rotateX(" + (-dy2 * 5).toFixed(2) + "deg) rotateY(" + (dx2 * 7).toFixed(2) + "deg)";
          card.style.setProperty("--mx", (e.clientX - r.left) + "px");
          card.style.setProperty("--my", (e.clientY - r.top) + "px");
        }, { passive: true });
        document.documentElement.addEventListener("pointerleave", function () {
          card.style.transform = "";
        });
      }
    } catch (e) {}
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();