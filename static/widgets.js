/* Cyber Mirage — widgets.js
   يعبّي بطاقات الداشبورد الزجاجي: خط الاتجاه، الرادار، الهجمات حسب الساعة،
   أكثر العناوين نشاطًا، والأرقام السريعة. يقرأ من /api/data. ما يغيّر أي ملف ثاني. */
(function () {
  "use strict";
  var spark = document.getElementById("cmSpark");
  if (!spark) return;

  var NS = "http://www.w3.org/2000/svg";
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function sv(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function hourOf(t) {
    var m = /(\d{1,2}):(\d{2})/.exec(String(t || ""));
    if (!m) return -1;
    var h = parseInt(m[1], 10);
    return h >= 0 && h < 24 ? h : -1;
  }

  /* ---------- الرادار (هيكل ثابت) ---------- */
  var radar = sv("svg", { "class": "radar", viewBox: "0 0 200 200", "aria-hidden": "true" });
  var defs = sv("defs", {});
  var rg = sv("radialGradient", { id: "wRg", cx: "50%", cy: "50%", r: "50%" });
  rg.appendChild(sv("stop", { offset: "0%", style: "stop-color:var(--acc);stop-opacity:.16" }));
  rg.appendChild(sv("stop", { offset: "100%", style: "stop-color:var(--acc);stop-opacity:.02" }));
  defs.appendChild(rg);
  radar.appendChild(defs);
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 96, fill: "url(#wRg)", "class": "rs", "stroke-opacity": ".4", "stroke-width": "1.2" }));
  [32, 64].forEach(function (r) {
    radar.appendChild(sv("circle", { cx: 100, cy: 100, r: r, fill: "none", "class": "rs", "stroke-opacity": ".22", "stroke-dasharray": "3 4" }));
  });
  radar.appendChild(sv("line", { x1: 100, y1: 4, x2: 100, y2: 196, "class": "rs", "stroke-opacity": ".15" }));
  radar.appendChild(sv("line", { x1: 4, y1: 100, x2: 196, y2: 100, "class": "rs", "stroke-opacity": ".15" }));
  var sweep = sv("g", { "class": "sweep" });
  sweep.appendChild(sv("path", { d: "M100 100 L42.15 31.06 A90 90 0 0 1 100 10 Z", "class": "rf", "fill-opacity": ".18" }));
  sweep.appendChild(sv("line", { x1: 100, y1: 100, x2: 100, y2: 10, "class": "rs", "stroke-width": "1.4", "stroke-opacity": ".7" }));
  radar.appendChild(sweep);
  var blips = sv("g", {});
  radar.appendChild(blips);
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 4.5, "class": "rf" }));
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 9, fill: "none", "class": "rs", "stroke-opacity": ".5" }));
  $("cmRadarBox").appendChild(radar);

  /* ---------- خط الاتجاه ---------- */
  function drawSpark(hours) {
    clear(spark);
    var defs2 = sv("defs", {});
    var lg = sv("linearGradient", { id: "sparkFill", x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(sv("stop", { offset: "0%", style: "stop-color:var(--acc);stop-opacity:.35" }));
    lg.appendChild(sv("stop", { offset: "100%", style: "stop-color:var(--acc);stop-opacity:0" }));
    defs2.appendChild(lg);
    spark.appendChild(defs2);
    var max = Math.max.apply(null, hours) || 1, W = 240, H = 74, pts = [];
    hours.forEach(function (v, i) { pts.push([i / 23 * W, H - 6 - (v / max) * (H - 16)]); });
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var cx = (pts[i - 1][0] + pts[i][0]) / 2;
      d += " C" + cx.toFixed(1) + " " + pts[i - 1][1].toFixed(1) + "," + cx.toFixed(1) + " " + pts[i][1].toFixed(1) + "," + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
    }
    spark.appendChild(sv("path", { "class": "area", d: d + " L" + W + " " + H + " L0 " + H + " Z" }));
    spark.appendChild(sv("path", { "class": "line", d: d, pathLength: 1 }));
  }

  /* ---------- التعبئة ---------- */
  function render(data) {
    if (!data || !Array.isArray(data.attempts)) return;
    var attempts = data.attempts, ipCount = {}, hours = [], i;
    for (i = 0; i < 24; i++) hours.push(0);
    attempts.forEach(function (a) {
      var ip = String(a && a.ip || "");
      if (ip) ipCount[ip] = (ipCount[ip] || 0) + 1;
      var h = hourOf(a && a.time);
      if (h > -1) hours[h]++;
    });
    var ips = Object.keys(ipCount).sort(function (a, b) { return ipCount[b] - ipCount[a]; });
    var maxIp = ips.length ? ipCount[ips[0]] : 1;
    var maxH = Math.max.apply(null, hours), peak = hours.indexOf(maxH);

    drawSpark(hours);

    // الرادار
    clear(blips);
    ips.slice(0, 14).forEach(function (ip) {
      var h1 = hash(ip), h2 = hash(ip + "r");
      var ang = h1 % 360, rad = 22 + (h2 % 68);
      var x = 100 + rad * Math.sin(ang * Math.PI / 180);
      var y = 100 - rad * Math.cos(ang * Math.PI / 180);
      var r = 2.4 + 2.6 * (ipCount[ip] / maxIp);
      var c = sv("circle", { "class": "blip", cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1) });
      c.style.animationDelay = (ang / 360 * 6).toFixed(2) + "s";
      var tt = sv("title", {});
      tt.textContent = ip + " — " + ipCount[ip] + " محاولة";
      c.appendChild(tt);
      blips.appendChild(c);
    });
    $("cmRadarCap").textContent = ips.length
      ? "المركز: الـ Honeypot  •  " + ips.length + " عنوان مهاجم" + (ips.length > 14 ? " (أبرز 14)" : "")
      : "بانتظار أول محاولة...";

    // الساعات
    var bars = $("cmBars");
    clear(bars);
    hours.forEach(function (c, h) {
      var b = document.createElement("div");
      b.style.height = (maxH ? Math.max(c ? 6 : 0, c / maxH * 100) : 0) + "%";
      b.style.animationDelay = (h * 25) + "ms";
      b.title = pad(h) + ":00 — " + c + " محاولة";
      if (!c) b.className = "zero"; else if (h === peak) b.className = "peak";
      bars.appendChild(b);
    });

    // أكثر العناوين
    var box = $("cmIps");
    clear(box);
    if (!ips.length) {
      box.appendChild(el("div", "empty", "لا توجد بيانات بعد"));
    } else {
      ips.slice(0, 6).forEach(function (ip) {
        var row = el("div", "ipr");
        row.appendChild(el("span", null, ip));
        row.appendChild(el("span", null, String(ipCount[ip])));
        var tr = el("div", "tr"), fl = el("div", "fl");
        fl.style.width = (ipCount[ip] / maxIp * 100) + "%";
        tr.appendChild(fl); row.appendChild(tr);
        box.appendChild(row);
      });
    }

    // أرقام سريعة
    $("cmUnique").textContent = String(ips.length);
    $("cmPeak").textContent = maxH ? pad(peak) + ":00" : "--";
    $("cmPeakCount").textContent = maxH ? String(maxH) : "--";
    var withData = hours.filter(function (v) { return v > 0; }).length;
    $("cmAvg").textContent = withData ? String(Math.round(attempts.length / withData)) : "--";
    var top = null;
    (data.attacks_by_country || []).forEach(function (c) { if (!top || c.percentage > top.percentage) top = c; });
    $("cmTopCountry").textContent = top ? top.country : "--";
  }

  function load() {
    fetch("/api/data", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(render)
      .catch(function () {});
  }
  load();
  setInterval(load, 300000);
})();