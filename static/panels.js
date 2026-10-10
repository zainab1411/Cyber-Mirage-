/* Cyber Mirage — panels.js
   لوحتين جانبيتين للشاشات الكبيرة (من 1240px وفوق):
   يسار: رادار متحرك + أرقام سريعة
   يمين: الهجمات حسب الساعة + أكثر العناوين نشاطًا
   يقرأ من /api/data نفس بيانات الداشبورد. ما يغيّر أي ملف ثاني.
   الألوان تتبع الوضع الليلي/النهاري (تنسخ ألوان بطاقات الداشبورد نفسها). */
(function () {
  "use strict";
  if (!document.getElementById("total") || !document.querySelector(".cards")) return;

  var NS = "http://www.w3.org/2000/svg";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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

  /* ---------- الستايل ---------- */
  var css = [
    '.cm-side{--pbg:#1c2636;--pfg:#e9eef4;--pacc:#8fb8c9;--pred:#d99a9a;--psh:8px 8px 18px #121a26,-6px -6px 14px #283549;--pglow:rgba(0,0,0,0);--prad1:#26364d;--prad2:#161f2d}',
    'body.light-mode .cm-side{--pbg:#e9edf3;--pfg:#2b3a4f;--pacc:#4f7f96;--pred:#c46a6a;--psh:8px 8px 18px #c5ccd8,-6px -6px 14px #ffffff;--pglow:rgba(0,0,0,0);--prad1:#ffffff;--prad2:#d3dce8}',
    '.cm-side{--pmut:color-mix(in srgb,var(--pfg) 66%,var(--pbg));--ptile:color-mix(in srgb,var(--pfg) 7%,var(--pbg));--ptrack:color-mix(in srgb,var(--pfg) 13%,transparent);--pred2:color-mix(in srgb,var(--pred) 55%,var(--pbg))}',
    '.cm-side{position:fixed;top:88px;bottom:16px;width:min(300px,calc((100vw - 640px)/2 - 28px));display:none;flex-direction:column;gap:16px;overflow-y:auto;z-index:1;scrollbar-width:none;font-family:"Cairo",Tahoma,Arial,sans-serif}',
    '.cm-side::-webkit-scrollbar{display:none}',
    '@media(min-width:1240px){.cm-side{display:flex}}',
    '.cm-side.cm-l{left:14px}.cm-side.cm-r{right:14px}.cm-side .cm-pc:first-child{margin-top:auto}.cm-side .cm-pc:last-child{margin-bottom:auto}',
    '.cm-pc{padding:16px;border-radius:22px;background:var(--pbg);color:var(--pfg);box-shadow:var(--psh);animation:cm-prise .7s ease both}',
    '.cm-side .cm-pc:nth-child(2){animation-delay:.12s}.cm-side .cm-pc:nth-child(3){animation-delay:.24s}',
    '@keyframes cm-prise{from{opacity:0;transform:translateY(22px)}}',
    '.cm-side{padding:14px;margin:-14px}',
    '.cm-pc{transition:transform .25s ease,box-shadow .25s ease,background .35s ease,color .35s ease;box-shadow:var(--psh),0 0 0 transparent}',
    '.cm-pc:hover{transform:translateY(-5px);box-shadow:var(--psh),0 0 18px var(--pglow)}',
    '.cm-tile:hover{transform:translateY(-3px)}',
    '.cm-pc h3{margin:0 0 12px;font-size:15px;font-weight:800;color:var(--pacc)}',
    '.cm-pc small{display:block;margin-top:8px;font-size:12px;font-weight:600;color:var(--pmut);text-align:center}',
    '.cm-radar{display:block;width:100%;height:auto}',
    '.cm-sweep{transform-box:view-box;transform-origin:50% 50%;animation:cm-spin 5s linear infinite}',
    '@keyframes cm-spin{to{transform:rotate(360deg)}}',
    '.cm-blip{opacity:.15;animation:cm-blink 5s linear infinite}',
    '@keyframes cm-blink{0%{opacity:1}35%{opacity:.15}100%{opacity:.15}}',
    '.cm-bars{display:flex;align-items:flex-end;gap:2px;height:96px;direction:ltr}',
    '.cm-bars div{flex:1;min-height:2px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,var(--pacc),color-mix(in srgb,var(--pacc) 55%,#7d9bc4));transform-origin:bottom;animation:cm-grow .8s ease both}',
    '.cm-bars div.cm-peak{background:linear-gradient(180deg,color-mix(in srgb,var(--pred) 65%,#fff),var(--pred))}',
    '.cm-bars div.cm-zero{background:var(--ptrack)}',
    '@keyframes cm-grow{from{transform:scaleY(0)}}',
    '.cm-hours{display:flex;justify-content:space-between;direction:ltr;margin-top:6px;font-size:11px;font-weight:600;color:var(--pmut)}',
    '.cm-ip{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin-bottom:10px;font-size:13px;font-weight:700}',
    '.cm-ip span:first-child{direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis}',
    '.cm-ip span:last-child{color:var(--pred)}',
    '.cm-ip .cm-track{grid-column:1/-1;height:6px;border-radius:4px;background:var(--ptrack);overflow:hidden}',
    '.cm-ip .cm-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--pred),var(--pred2));animation:cm-fillin .9s ease both}',
    '@keyframes cm-fillin{from{width:0!important}}',
    '.cm-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.cm-tile{padding:12px 8px;border-radius:16px;text-align:center;background:var(--ptile);transition:transform .2s ease,background .35s ease}',
    '.cm-tile b{display:block;font-size:24px;font-weight:800;color:var(--pacc);direction:ltr}',
    '.cm-tile span{font-size:12px;font-weight:600;color:var(--pmut)}',
    '.cm-empty{padding:18px 6px;text-align:center;font-size:13px;font-weight:600;color:var(--pmut)}',
    '.cm-rs{stroke:var(--pacc)}.cm-rf{fill:var(--pacc)}.cm-blip{fill:var(--pred)}',
    '@media(prefers-reduced-motion:reduce){.cm-sweep,.cm-blip,.cm-pc,.cm-bars div,.cm-ip .cm-fill{animation:none!important}.cm-blip{opacity:.9}}'
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- اللوحة اليسار ---------- */
  var left = el("aside", "cm-side cm-l");
  left.setAttribute("aria-hidden", "true");

  var radarCard = el("div", "cm-pc");
  radarCard.appendChild(el("h3", null, "رادار الرصد"));
  var radar = sv("svg", { "class": "cm-radar", viewBox: "0 0 200 200" });
  var defs = sv("defs", {});
  var grad = sv("radialGradient", { id: "cmRg", cx: "50%", cy: "50%", r: "50%" });
  grad.appendChild(sv("stop", { offset: "0%", style: "stop-color:var(--prad1)" }));
  grad.appendChild(sv("stop", { offset: "100%", style: "stop-color:var(--prad2)" }));
  defs.appendChild(grad);
  radar.appendChild(defs);
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 96, fill: "url(#cmRg)", "class": "cm-rs", "stroke-opacity": ".45", "stroke-width": "1.5" }));
  [32, 64].forEach(function (r) {
    radar.appendChild(sv("circle", { cx: 100, cy: 100, r: r, fill: "none", "class": "cm-rs", "stroke-opacity": ".25", "stroke-dasharray": "3 4" }));
  });
  radar.appendChild(sv("line", { x1: 100, y1: 4, x2: 100, y2: 196, "class": "cm-rs", "stroke-opacity": ".18" }));
  radar.appendChild(sv("line", { x1: 4, y1: 100, x2: 196, y2: 100, "class": "cm-rs", "stroke-opacity": ".18" }));
  var sweep = sv("g", { "class": "cm-sweep" });
  sweep.appendChild(sv("path", { d: "M100 100 L42.15 31.06 A90 90 0 0 1 100 10 Z", "class": "cm-rf", "fill-opacity": ".24" }));
  sweep.appendChild(sv("line", { x1: 100, y1: 100, x2: 100, y2: 10, "class": "cm-rs", "stroke-width": "1.5", "stroke-opacity": ".9" }));
  radar.appendChild(sweep);
  var blips = sv("g", {});
  radar.appendChild(blips);
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 5, "class": "cm-rf" }));          // الهدف (Honeypot)
  radar.appendChild(sv("circle", { cx: 100, cy: 100, r: 9, fill: "none", "class": "cm-rs", "stroke-opacity": ".6" }));
  radarCard.appendChild(radar);
  var radarCap = el("small", null, "المركز: الـ Honeypot  •  النقاط الحمراء: عناوين مهاجمة");
  radarCard.appendChild(radarCap);
  left.appendChild(radarCard);

  /* ---------- اللوحة اليمين ---------- */
  var right = el("aside", "cm-side cm-r");
  right.setAttribute("aria-hidden", "true");

  var hoursCard = el("div", "cm-pc");
  hoursCard.appendChild(el("h3", null, "الهجمات حسب الساعة"));
  var bars = el("div", "cm-bars");
  hoursCard.appendChild(bars);
  var hl = el("div", "cm-hours");
  ["00", "06", "12", "18", "23"].forEach(function (h) { hl.appendChild(el("span", null, h)); });
  hoursCard.appendChild(hl);
  right.appendChild(hoursCard);

  var ipsCard = el("div", "cm-pc");
  ipsCard.appendChild(el("h3", null, "أكثر العناوين نشاطًا"));
  var ipsBox = document.createElement("div");
  ipsCard.appendChild(ipsBox);
  right.appendChild(ipsCard);

  var tilesCard = el("div", "cm-pc");
  tilesCard.appendChild(el("h3", null, "أرقام سريعة"));
  var tiles = el("div", "cm-tiles");
  var t1 = el("div", "cm-tile"), t1v = el("b", null, "--"); t1.appendChild(t1v); t1.appendChild(el("span", null, "عناوين فريدة"));
  var t2 = el("div", "cm-tile"), t2v = el("b", null, "--"); t2.appendChild(t2v); t2.appendChild(el("span", null, "ذروة النشاط"));
  tiles.appendChild(t1); tiles.appendChild(t2);
  tilesCard.appendChild(tiles);
  left.appendChild(tilesCard);

  document.body.appendChild(left);
  document.body.appendChild(right);

  /* ---------- مزامنة الوضع الليلي/النهاري ---------- */
  // ننسخ ألوان بطاقات الداشبورد الحقيقية؛ وإن ما قدرنا نقراها نبقى على ألوان الوضع الجاهزة بالـCSS
  function solid(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return false;
    var p = m[1].split(",");
    return p.length < 4 || parseFloat(p[3]) > 0.5;
  }
  function syncTheme() {
    var ref = document.querySelector(".cards .card");
    var lab = ref && ref.querySelector(".card-label");
    var val = ref && ref.querySelector(".card-value");
    var props = { "--pbg": "", "--pfg": "", "--pacc": "", "--psh": "" };
    try {
      if (ref) {
        var cs = getComputedStyle(ref);
        if (solid(cs.backgroundColor)) props["--pbg"] = cs.backgroundColor;
        if (cs.boxShadow && cs.boxShadow !== "none") props["--psh"] = cs.boxShadow;
        if (lab) { var lc = getComputedStyle(lab).color; if (solid(lc)) props["--pfg"] = lc; }
        if (val) { var vc = getComputedStyle(val).color; if (solid(vc)) props["--pacc"] = vc; }
      }
    } catch (e) {}
    [left, right].forEach(function (a) {
      for (var k in props) {
        if (props[k]) a.style.setProperty(k, props[k]); else a.style.removeProperty(k);
      }
    });
  }
  syncTheme();
  try {
    new MutationObserver(function () { setTimeout(syncTheme, 60); setTimeout(syncTheme, 480); })
      .observe(document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(function () { setTimeout(syncTheme, 60); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  } catch (e) {}
  window.addEventListener("load", syncTheme);

  /* ---------- تعبئة البيانات ---------- */
  function hourOf(t) {
    var m = /(\d{1,2}):(\d{2})/.exec(String(t || ""));
    if (!m) return -1;
    var h = parseInt(m[1], 10);
    return h >= 0 && h < 24 ? h : -1;
  }

  function render(data) {
    if (!data || !Array.isArray(data.attempts)) return;
    var attempts = data.attempts;
    var ipCount = {}, hours = [], i;
    for (i = 0; i < 24; i++) hours.push(0);
    attempts.forEach(function (a) {
      var ip = String(a && a.ip || "");
      if (ip) ipCount[ip] = (ipCount[ip] || 0) + 1;
      var h = hourOf(a && a.time);
      if (h > -1) hours[h]++;
    });
    var ips = Object.keys(ipCount).sort(function (a, b) { return ipCount[b] - ipCount[a]; });
    var maxIp = ips.length ? ipCount[ips[0]] : 1;

    // الرادار
    while (blips.firstChild) blips.removeChild(blips.firstChild);
    ips.slice(0, 14).forEach(function (ip) {
      var h1 = hash(ip), h2 = hash(ip + "r");
      var ang = h1 % 360, rad = 22 + (h2 % 68);
      var x = 100 + rad * Math.sin(ang * Math.PI / 180);
      var y = 100 - rad * Math.cos(ang * Math.PI / 180);
      var r = 2.4 + 2.6 * (ipCount[ip] / maxIp);
      var c = sv("circle", { "class": "cm-blip", cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1) });
      c.style.animationDelay = (ang / 360 * 5).toFixed(2) + "s";
      var tt = sv("title", {});
      tt.textContent = ip + " — " + ipCount[ip] + " محاولة";
      c.appendChild(tt);
      blips.appendChild(c);
    });
    radarCap.textContent = ips.length
      ? "المركز: الـ Honeypot  •  " + ips.length + " عنوان مهاجم على الرادار" + (ips.length > 14 ? " (أبرز 14)" : "")
      : "بانتظار أول محاولة...";

    // الساعات
    var maxH = Math.max.apply(null, hours), peak = hours.indexOf(maxH);
    while (bars.firstChild) bars.removeChild(bars.firstChild);
    hours.forEach(function (c, h) {
      var b = document.createElement("div");
      b.style.height = (maxH ? Math.max(c ? 6 : 0, c / maxH * 100) : 0) + "%";
      b.style.animationDelay = (h * 25) + "ms";
      b.title = pad(h) + ":00 — " + c + " محاولة";
      if (!c) b.className = "cm-zero";
      else if (h === peak) b.className = "cm-peak";
      bars.appendChild(b);
    });

    // أكثر العناوين
    while (ipsBox.firstChild) ipsBox.removeChild(ipsBox.firstChild);
    if (!ips.length) {
      ipsBox.appendChild(el("div", "cm-empty", "لا توجد بيانات بعد"));
    } else {
      ips.slice(0, 5).forEach(function (ip) {
        var row = el("div", "cm-ip");
        row.appendChild(el("span", null, ip));
        row.appendChild(el("span", null, String(ipCount[ip])));
        var tr = el("div", "cm-track"), fl = el("div", "cm-fill");
        fl.style.width = (ipCount[ip] / maxIp * 100) + "%";
        tr.appendChild(fl); row.appendChild(tr);
        ipsBox.appendChild(row);
      });
    }

    // الأرقام
    t1v.textContent = String(ips.length);
    t2v.textContent = maxH ? pad(peak) + ":00" : "--";
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