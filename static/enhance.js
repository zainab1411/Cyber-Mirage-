/* Cyber Mirage — enhance.js
   1) أنيميشن لوحة التحكم (ظهور تدريجي، عدّاد، كتابة تلقائية، صفوف الجدول)
   2) مساعد عائم: يجرّب /api/chat (الذكاء الاصطناعي) وإذا ما اشتغل يرد من قاعدة معرفة محلية
   ما يغيّر في script.js أبدًا، يشتغل فوقه. */
(function () {
  "use strict";

  var reduce = false;   // الحركة تشتغل دايمًا
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* =====================================================
     1) أنيميشن لوحة التحكم
     ===================================================== */
  function typeText(el, text, speed) {
    if (reduce) { el.textContent = text; return; }
    var i = 0;
    (function tick() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, speed);
    })();
  }

  function countUp(el) {
    if (!("MutationObserver" in window) || reduce) return;
    var last = null, raf = 0, shown = 0;
    var m = el.textContent.match(/\d+/);
    if (m) shown = parseInt(m[0].replace(/,/g, ""), 10) || 0;
    new MutationObserver(function () {
      var t = el.textContent.trim();
      if (t === last || !/\d/.test(t)) return;           // كتابتنا نحن أو نص بدون رقم ("--")
      var n = parseInt(t.replace(/[^\d]/g, ""), 10);
      if (isNaN(n)) return;
      var comma = t.indexOf(",") > -1, from = shown, start = performance.now(), dur = 900;
      cancelAnimationFrame(raf);
      (function step(now) {
        var p = Math.min(1, (now - start) / dur);
        var v = Math.round(from + (n - from) * (1 - Math.pow(1 - p, 3)));
        last = comma ? v.toLocaleString("en-US") : String(v);
        el.textContent = last;
        shown = v;
        if (p < 1) raf = requestAnimationFrame(step);
      })(start);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  function initDashboardFx() {
    var total = $("#total");
    if (!total || !$(".cards")) return;                  // مو صفحة الداشبورد

    // توهج اسم المشروع + نقطة "مباشر"
    var title = $(".header-title span");
    if (title) title.classList.add("cm-glow");
    var upd = $("#updated");
    if (upd && upd.parentNode) {
      var dot = document.createElement("span");
      dot.className = "cm-live";
      upd.parentNode.insertBefore(dot, upd);
    }

    // سطر الكتابة التلقائية تحت الهيدر
    var header = $(".header");
    if (header && header.parentNode) {
      var tag = document.createElement("div");
      tag.className = "cm-tagline";
      tag.dir = "ltr";
      tag.setAttribute("aria-hidden", "true");
      var txt = document.createElement("span");
      tag.appendChild(txt);
      tag.appendChild(document.createElement("i"));
      header.parentNode.insertBefore(tag, header.nextSibling);
      typeText(txt, "Smart Cyber Deception & Suspicious Behavior Analysis", 38);
    }

    // ظهور تدريجي عند التمرير
    if (!reduce && "IntersectionObserver" in window) {
      var targets = $$(".header, .cards .card, body > .card, body > table, body > .pagination, body > div[style]");
      var io = new IntersectionObserver(function (entries) {
        var i = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.style.setProperty("--cm-d", Math.min(i++, 6) * 80 + "ms");
          en.target.classList.add("cm-in");
          io.unobserve(en.target);
        });
      }, { threshold: 0.08 });
      targets.forEach(function (el) { el.classList.add("cm-reveal"); io.observe(el); });
      setTimeout(function () {                           // شبكة أمان: ما يبقى شي مخفي
        targets.forEach(function (el) { el.classList.add("cm-in"); });
      }, 3000);
    }

    // عدّاد متحرك للإجمالي
    countUp(total);

    // حركة دخول لصفوف الجدول (فقط لما يتغير المحتوى فعلًا)
    var rows = $("#rows");
    if (rows && "MutationObserver" in window && !reduce) {
      var sig = rows.textContent;
      new MutationObserver(function () {
        var s = rows.textContent;
        if (s === sig) return;
        sig = s;
        $$("tr", rows).slice(0, 14).forEach(function (tr, i) {
          tr.style.setProperty("--cm-d", i * 35 + "ms");
          tr.classList.add("cm-row");
        });
      }).observe(rows, { childList: true });
    }
  }

  /* =====================================================
     2) المساعد العائم
     ===================================================== */
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  }
  function has(q, list) {
    for (var i = 0; i < list.length; i++) if (q.indexOf(list[i]) > -1) return true;
    return false;
  }

  // الكلمات المفتاحية مكتوبة بصيغة "مطبّعة" (بدون همزات، ة=ه، ى=ي)
  var RULES = [
    { any: ["مرحبا", "السلام", "هلا", "اهلا", "hello", "hi "],
      a: "هلا والله! 👋 أنا مساعد Cyber Mirage. اسأليني عن المنصة، لوحة التحكم، أو الدعم." },

    { all: [["كم", "عدد", "اجمالي", "مجموع"], ["محاول", "هجم", "اختراق"]],
      a: function () {
        var t = $("#total");
        return t && /\d/.test(t.textContent)
          ? "إجمالي المحاولات المسجلة حاليًا: " + t.textContent.trim() + " محاولة."
          : "افتحي لوحة التحكم بعد تسجيل الدخول وأقرأ لك الأرقام الحية من هناك.";
      } },

    { any: ["اكثر ip", "اكثر ايبي", "اكثر عنوان", "اكثر مهاجم", "اشهر ip"],
      a: function () {
        var t = $("#topip");
        return t && /\d/.test(t.textContent)
          ? "أكثر عنوان IP تكرارًا في المحاولات: " + t.textContent.trim()
          : "رقم أكثر IP يظهر في لوحة التحكم بعد تسجيل الدخول.";
      } },

    { any: ["t-pot", "tpot", "تي بوت", "cowrie", "كاوري", "kibana", "كيبانا"],
      a: "T-Pot منصة تجمع أكثر من 20 نوع Honeypot، ومنها Cowrie اللي يحاكي SSH ويسجل محاولات الدخول. نشغّلها على AWS، وبيانات الهجمات تظهر في Kibana وفي لوحة التحكم هذي." },

    { any: ["honeypot", "هوني", "هنبوت", "هونيبوت", "فخ", "خداع"],
      a: "الـ Honeypot نظام وهمي نتركه مكشوف عمدًا عشان يجذب المهاجمين. أي محاولة دخول عليه مشبوهة بحد ذاتها، فنسجّل الـ IP واليوزر وتفاصيل المحاولة ونحللها بدون ما نعرّض أي نظام حقيقي للخطر." },

    { any: ["مباشر", "live", "حيه", "الحيه"],
      a: "شاشة المحاولات الحية تعرض آخر محاولات الدخول لحظة بلحظة مع تنبيه عند أي محاولة جديدة. تفتحينها من زر «فتح شاشة المحاولات الحية» في لوحة التحكم." },

    { any: ["portal", "بوابه", "باركود", "qr"],
      a: "صفحة /portal بوابة تسجيل دخول وهمية للتجربة. أي أحد يكتب فيها بيانات عشوائية تظهر محاولته مباشرة في لوحة التحكم. لا تكتبون بيانات حقيقية فيها." },

    { any: ["لوحه", "داشبورد", "dashboard", "فلتر", "ابحث", "بحث", "تصدير", "csv", "كيف استخدم", "كيف اتعامل"],
      a: "في لوحة التحكم:\n• البطاقات: إجمالي المحاولات وأكثر IP تكرارًا\n• الرسم: نسبة الهجمات حسب الدولة\n• البحث: بالـ IP أو بنطاق تاريخ\n• الجدول: اضغطي على العنوان للترتيب\n• زر «تصدير CSV» لحفظ النتائج" },

    { any: ["مشرفه", "اشراف", "زهراء"],
      a: "المشروع تحت إشراف: أ/ زهراء السيد." },

    { any: ["فريق", "اعضاء", "من سوا", "مين سوا", "الطالبات", "قائده"],
      a: "فريق Cyber Mirage: زينب المدحمي (قائدة الفريق)، سمية الفقيه، أحلام مجيد، فاطمة رفيع. تحت إشراف أ/ زهراء السيد." },

    { any: ["ما هي", "ما هو", "وش هي", "وش هو", "ايش", "عن المشروع", "عن المنصه", "تعريف", "cyber mirage", "ميراج"],
      a: "Cyber Mirage منصة ذكية للخداع السيبراني (Honeypot). تجذب الأنشطة المشبوهة، تسجّلها، وتعرض تحليلها في لوحة تحكم: أرقام، جدول، رسوم، وتنبيهات." },

    { any: ["كلمه مرور", "كلمات المرور", "باسورد", "password", "حمايه", "نصائح", "نصيحه"],
      a: "نصائح سريعة: كلمة مرور طويلة وفريدة لكل حساب، فعّلي التحقق بخطوتين، ولا تدخلين بياناتك في روابط ما تثقين فيها. وغيّري أي كلمة مرور شاركتيها مع أحد." },

    { any: ["دعم", "مشكله", "عطل", "خطا", "ما يشتغل", "تواصل", "مساعده", "support"],
      a: "إذا واجهتي مشكلة: اكتبي لي وصفها هنا بالتفصيل، أو تواصلي مع قائدة الفريق زينب المدحمي، أو افتحي Issue في مستودع المشروع على GitHub (zainab1411/Cyber-Mirage-)." }
  ];

  var FALLBACK = "ما فهمت سؤالك تمامًا 🤔 جرّبي أحد الأسئلة اللي تحت، أو اكتبي «دعم» وأوجهك للتواصل مع الفريق.";

  function localAnswer(q) {
    var n = norm(q);
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i], ok = false;
      if (r.any) ok = has(n, r.any);
      else if (r.all) ok = has(n, r.all[0]) && has(n, r.all[1]);
      if (ok) return typeof r.a === "function" ? r.a() : r.a;
    }
    return FALLBACK;
  }

  // يجرّب الذكاء الاصطناعي من السيرفر، وإذا فشل يرجع للرد المحلي
  function ask(q) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
    return fetch("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q }),
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) { if (!d || !d.reply) throw new Error("empty"); return String(d.reply); })
      .catch(function () { return localAnswer(q); })
      .then(function (txt) { clearTimeout(timer); return txt; });
  }

  var ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm-4 8h8v1.8H8V10zm0 3.2h5v1.8H8v-1.8z"/></svg>';

  function initAssistant() {
    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "cm-fab";
    fab.setAttribute("aria-label", "مساعد Cyber Mirage");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = ICON;                                // نص ثابت من عندنا فقط

    var box = document.createElement("div");
    box.className = "cm-chat";
    box.dir = "rtl";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "مساعد Cyber Mirage");

    var head = document.createElement("div");
    head.className = "cm-chat-head";
    var hd = document.createElement("span"); hd.className = "cm-chat-dot";
    var ht = document.createElement("b"); ht.textContent = "مساعد Cyber Mirage";
    var hx = document.createElement("button"); hx.type = "button"; hx.className = "cm-x"; hx.textContent = "×"; hx.setAttribute("aria-label", "إغلاق");
    head.appendChild(hd); head.appendChild(ht); head.appendChild(hx);

    var msgs = document.createElement("div"); msgs.className = "cm-msgs";
    var chips = document.createElement("div"); chips.className = "cm-chips";

    var form = document.createElement("form"); form.className = "cm-form";
    var input = document.createElement("input");
    input.type = "text"; input.placeholder = "اكتبي سؤالك..."; input.maxLength = 400; input.autocomplete = "off";
    var send = document.createElement("button"); send.type = "submit"; send.textContent = "إرسال";
    form.appendChild(input); form.appendChild(send);

    box.appendChild(head); box.appendChild(msgs); box.appendChild(chips); box.appendChild(form);
    document.body.appendChild(box);
    document.body.appendChild(fab);

    function addMsg(text, who) {
      var d = document.createElement("div");
      d.className = "cm-msg " + (who === "user" ? "cm-user" : "cm-bot");
      d.textContent = text;                              // textContent دائمًا: آمن من XSS
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      return d;
    }

    var busy = false;
    function submit(q) {
      q = (q || "").trim();
      if (!q || busy) return;
      busy = true;
      addMsg(q, "user");
      input.value = "";
      var wait = addMsg("", "bot");
      wait.classList.add("cm-dots");
      for (var i = 0; i < 3; i++) wait.appendChild(document.createElement("span"));
      ask(q).then(function (txt) {
        wait.classList.remove("cm-dots");
        wait.textContent = txt;
        msgs.scrollTop = msgs.scrollHeight;
        busy = false;
      });
    }

    ["وش هي Cyber Mirage؟", "كم عدد المحاولات؟", "كيف أستخدم لوحة التحكم؟", "دعم"].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = c;
      b.addEventListener("click", function () { submit(c); });
      chips.appendChild(b);
    });

    var greeted = false;
    function toggle(open) {
      var show = typeof open === "boolean" ? open : !box.classList.contains("cm-open");
      box.classList.toggle("cm-open", show);
      fab.setAttribute("aria-expanded", show ? "true" : "false");
      if (show) {
        if (!greeted) { greeted = true; addMsg("هلا! 👋 أنا مساعد Cyber Mirage. اسأليني عن المنصة، لوحة التحكم، أو الدعم.", "bot"); }
        setTimeout(function () { input.focus(); }, 250);
      }
    }
    fab.addEventListener("click", function () { toggle(); });
    hx.addEventListener("click", function () { toggle(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(input.value); });
  }

  ready(function () {
    try { initDashboardFx(); } catch (e) { /* الأنيميشن إضافة فقط، لا نكسر الصفحة */ }
    try { initAssistant(); } catch (e) { /* نفس الشي */ }
  });
})();