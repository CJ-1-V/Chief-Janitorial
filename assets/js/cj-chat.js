/* Chief Janitorial chat widget.
   Quote requests POST to the same FormSubmit endpoint as contact.html.
   BOOKING_URL: set to a full https URL to show "Pick a walkthrough time"
   after a quote is sent. Empty hides that button (no booking page yet). */
(function () {
  var ENDPOINT = "https://formsubmit.co/ajax/02945dfa7949be6395f1a22e0d5fca93";
  var BOOKING_URL = "";
  var PHONE = "+1 (902) 200-4888";
  var TEL = "tel:+19022004888";
  var MAIL = "admin@chiefjanitorial.com";
  var GAP = 12;
  var FAQ = [
    { q: "What services do you offer?", k: /servic|offer|do you do|clean what/i, a: "We offer janitorial maintenance (daily, weekly or bi-weekly), disinfection & sanitization, floor care & polishing (strip & wax, burnishing, carpet, tile & grout), food plant sanitation (CFIA, HACCP and GMP), specialized, deep & post-construction cleaning, move-in/move-out cleans, event & venue cleaning, and window & glass cleaning. See <a href='services.html'>Services</a>." },
    { q: "Which industries do you serve?", k: /industr|sector|clinic|food|retail|warehouse|school|office|event|construct/i, a: "Corporate offices, healthcare & clinics, food plants & CFIA facilities, retail & showrooms, industrial & warehouse, events & venues, construction & property, and education & community spaces. See <a href='industries.html'>Industries</a>." },
    { q: "Where do you work?", k: /where|area|locat|town|city|pei|island|charlottetown/i, a: "We're based in Charlottetown and serve businesses across Prince Edward Island. For a specific town, send a request and the team will confirm." },
    { q: "How much does it cost?", k: /cost|price|rate|how much|quote|estimate/i, a: "Every plan is custom, and quotes are free. Tap <b>Book a quote</b> and we'll get back to you." },
    { q: "How do I contact you?", k: /contact|phone|call|email|hours|open/i, a: "Call <a href='" + TEL + "'>" + PHONE + "</a> or email <a href='mailto:" + MAIL + "'>" + MAIL + "</a>. Office hours: Monday–Friday, 9 am–5 pm." },
    { q: "Are you hiring?", k: /job|hir|career|work for|apply|position|role/i, a: "Yes. Open roles include Commercial Cleaner, Floor Care Technician, Food Plant Sanitation Worker, Event & Day Porter Crew and Team Lead / Supervisor. The application takes about 5 minutes: <a href='apply.html'>Apply here</a> or see <a href='careers.html'>Careers</a>." },
    { q: "How often can you clean?", k: /often|frequen|daily|weekly|night|schedul/i, a: "Scheduled daily, weekly or bi-weekly janitorial, plus one-time cleans. Food plant work is planned around your production schedule, including overnight and shutdown crews." }
  ];
  var FALLBACK = "I'm not sure about that one. Send a request and the team will follow up, or call <a href='" + TEL + "'>" + PHONE + "</a>.";
  var STEPS = [
    { id: "site", q: "What type of site is it?", opts: ["Office", "Food plant / CFIA facility", "Retail", "Medical/clinic", "Industrial/warehouse", "Post-construction", "Event", "Other"] },
    { id: "service", q: "What service do you need?", opts: ["General office cleaning", "Food plant sanitation", "Floor care", "Disinfection", "Post-construction", "Event cleaning", "Windows", "Other"] },
    { id: "address", q: "What's the property address or town?", req: 1 },
    { id: "size", q: "Approximate size in sq ft? (a guess is fine, or type 'not sure')" },
    { id: "freq", q: "How often would you like cleaning?", opts: ["One-time", "Daily", "Weekly", "Bi-weekly", "Monthly", "Not sure"] },
    { id: "details", q: "Any details we should know? (or type 'none')" },
    { id: "name", q: "Your name?", req: 1 },
    { id: "business", q: "Business name? (or 'none')" },
    { id: "email", q: "Your email?", req: 1, v: function (s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s); }, err: "That email doesn't look right. Please try again." },
    { id: "phone", q: "Phone number? (optional, type 'skip')" }
  ];
  var css = ""
    + "#cjc-btn{position:fixed;left:12px;right:auto;bottom:18px;z-index:900;margin:0;appearance:none;-webkit-appearance:none;background:#5956e9;color:#fff;border:0;border-radius:999px;padding:14px 18px;font:600 15px/1.2 inherit;text-align:center;box-shadow:0 10px 30px rgba(89,86,233,.35);cursor:pointer;max-width:calc(100% - 104px);box-sizing:border-box}"
    + "#cjc-btn:hover{background:#3f3cc9}"
    + "#cjc{position:fixed;left:12px;right:auto;bottom:78px;z-index:900;width:min(360px,calc(100% - 24px));max-height:min(600px,calc(100% - 120px));display:none;flex-direction:column;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(11,11,26,.25);overflow:hidden;font-family:inherit;box-sizing:border-box}"
    + "#cjc.open{display:flex}"
    + "#cjc header{background:#5956e9;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none}"
    + "#cjc header b{font-size:16px}"
    + "#cjc header button{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;margin:0}"
    + "#cjc-log{flex:1;overflow-y:auto;padding:12px;background:#fafafb;overscroll-behavior:contain}"
    + ".cjm{max-width:85%;margin:6px 0;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.45;color:#0b0b1a;overflow-wrap:anywhere}"
    + ".cjm.b{background:#f4f4fe}.cjm.u{background:#5956e9;color:#fff;margin-left:auto}.cjm a{color:#3f3cc9}"
    + ".cjo{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}"
    + ".cjo button{border:1px solid #5956e9;background:#fff;color:#5956e9;border-radius:999px;padding:7px 11px;font:600 13px/1.3 inherit;cursor:pointer;margin:0;max-width:100%;box-sizing:border-box}"
    + ".cjo button.p{background:#ffb32c;border-color:#ffb32c;color:#0b0b1a;font-weight:600}"
    + "#cjc form{display:flex;border-top:1px solid #eee;flex:none}"
    + "#cjc input{flex:1;min-width:0;border:0;padding:12px;font-size:16px;line-height:1.3;outline:none;background:#fff;color:#0b0b1a;margin:0}"
    + "#cjc form button{border:0;background:#5956e9;color:#fff;padding:0 16px;cursor:pointer;margin:0;font:600 15px/1 inherit}"
    + "#cjc-safe{position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.id = "cjc-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.textContent = "💬 Questions? Chat";

  var p = document.createElement("div");
  p.id = "cjc";
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Chief Janitorial chat");
  p.setAttribute("aria-hidden", "true");
  p.innerHTML = "<header><b>Chief Janitorial</b><button type='button' aria-label='Close'>×</button></header><div id='cjc-log' aria-live='polite'></div><form><input aria-label='Type a message' placeholder='Type a question…' autocomplete='off'><button type='submit'>Send</button></form>";

  var safe = document.createElement("div");
  safe.id = "cjc-safe";
  safe.setAttribute("aria-hidden", "true");

  document.body.appendChild(safe);
  document.body.appendChild(btn);
  document.body.appendChild(p);

  var log = p.querySelector("#cjc-log");
  var inp = p.querySelector("input");
  var flow = null;
  var data = {};
  var greeted = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }
  function say(h, who) {
    var d = document.createElement("div");
    d.className = "cjm " + (who || "b");
    d.innerHTML = h;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function opts(list) {
    var w = document.createElement("div");
    w.className = "cjo";
    list.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o.t;
      if (o.p) b.className = "p";
      b.onclick = function () { w.remove(); o.f(); };
      w.appendChild(b);
    });
    log.appendChild(w);
    log.scrollTop = log.scrollHeight;
  }
  function menu() {
    opts([{ t: "Book a quote", p: 1, f: function () { say("Book a quote", "u"); start(); } }].concat(FAQ.map(function (f) {
      return { t: f.q, f: function () { say(esc(f.q), "u"); say(f.a); menu(); } };
    })));
  }
  function start() { flow = 0; data = {}; say("Great, a few quick questions so we can prepare your free quote."); ask(); }
  function ask() {
    var s = STEPS[flow];
    say(s.q);
    if (s.opts) opts(s.opts.map(function (o) { return { t: o, f: function () { answer(o); } }; }));
  }
  function answer(v) {
    var s = STEPS[flow];
    say(esc(v), "u");
    v = v.trim();
    if (s.req && !v) { say("This one is needed."); return ask(); }
    if (s.v && !s.v(v)) { say(s.err); return ask(); }
    data[s.id] = /^(skip|none|not sure)$/i.test(v) ? "" : v;
    log.querySelectorAll(".cjo").forEach(function (e) { e.remove(); });
    flow++;
    if (flow < STEPS.length) return ask();
    flow = null;
    review();
  }
  function review() {
    say("<b>Please check:</b><br>Site: " + esc(data.site) + "<br>Service: " + esc(data.service) + "<br>Address: " + esc(data.address) + "<br>Size: " + esc(data.size || "not given") + " sq ft<br>Frequency: " + esc(data.freq) + "<br>Details: " + esc(data.details || "-") + "<br>Name: " + esc(data.name) + "<br>Business: " + esc(data.business || "-") + "<br>Email: " + esc(data.email) + "<br>Phone: " + esc(data.phone || "-"));
    opts([{ t: "Send request", p: 1, f: send }, { t: "Start over", f: start }]);
  }
  function send() {
    say("Send request", "u");
    var body = {
      _cc: MAIL,
      _subject: "Website chat quote request",
      _template: "table",
      _captcha: "true",
      _honey: "",
      Name: data.name,
      "Company / Business name": data.business,
      email: data.email,
      Phone: data.phone,
      "Property address / city": data.address,
      "Type of facility": data.site,
      "Approx. size (sq ft)": data.size,
      "Service frequency": data.freq,
      "Services needed": data.service,
      "Message / details": data.details,
      Source: "Website chat"
    };
    var done = function () {
      say("Thanks, " + esc(data.name) + "! Your request was sent to our team at " + MAIL + ". We'll get back to you with your free quote. Office hours are Monday–Friday, 9 am–5 pm.");
      var actions = [];
      if (BOOKING_URL) {
        say("Want to pick a time for a walkthrough or quote call now?");
        actions.push({ t: "📅 Pick a walkthrough time", p: 1, f: function () { window.open(BOOKING_URL, "_blank", "noopener"); } });
      }
      actions.push({ t: "Ask another question", f: menu });
      opts(actions);
    };
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw 0;
      done();
    }).catch(function () {
      say("Sorry, that didn't go through. Please call <a href='" + TEL + "'>" + PHONE + "</a> or email <a href='mailto:" + MAIL + "'>" + MAIL + "</a>.");
    });
  }
  function free(t) {
    say(esc(t), "u");
    if (/book|quote|estimate|walkthrough|appoint/i.test(t) && !/cost|price|how much/i.test(t)) return start();
    var f = FAQ.find(function (x) { return x.k.test(t); });
    say(f ? f.a : FALLBACK);
    menu();
  }
  p.querySelector("form").onsubmit = function (e) {
    e.preventDefault();
    var v = inp.value;
    inp.value = "";
    if (flow !== null) answer(v);
    else if (v.trim()) free(v);
  };

  function shown(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return null;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return r;
  }
  function reservedBackToTop() {
    var el = document.querySelector("a.back-to-top");
    if (!el) return null;
    var live = shown(el);
    if (live) return live;
    var cs = getComputedStyle(el);
    var w = parseFloat(cs.width);
    var h = parseFloat(cs.height);
    var b = parseFloat(cs.bottom);
    var rt = parseFloat(cs.right);
    if (!w || w < 1) w = 50;
    if (!h || h < 1) h = 50;
    if (isNaN(b)) b = 30;
    if (isNaN(rt)) rt = 30;
    var left = window.innerWidth - rt - w;
    var top = window.innerHeight - b - h;
    return { left: left, top: top, right: left + w, bottom: top + h, width: w, height: h };
  }
  function headerBottom() {
    var n = 0;
    var header = document.querySelector("header");
    if (header) {
      var hr = header.getBoundingClientRect();
      if (hr.bottom > 0) n = hr.bottom;
    }
    var tog = shown(document.querySelector(".navbar-toggler"));
    if (tog) n = Math.max(n, tog.bottom);
    return n;
  }
  function overlaps(a, b) {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }
  function place() {
    var safePx = safe.getBoundingClientRect().height || 0;
    var bar = shown(document.querySelector(".cj-mbar"));
    var btt = reservedBackToTop();
    var btnBottom = 18 + safePx;
    if (bar) btnBottom = Math.ceil(window.innerHeight - bar.top) + GAP + safePx;
    var rightLimit = window.innerWidth - GAP;
    if (btt) rightLimit = Math.min(rightLimit, btt.left - GAP);
    btn.style.left = "12px";
    btn.style.right = "auto";
    btn.style.bottom = btnBottom + "px";
    btn.style.maxWidth = Math.max(120, Math.floor(rightLimit - 12)) + "px";

    var btnH = btn.offsetHeight || 48;
    var panelBottom = btnBottom + btnH + 10;
    var panelW = Math.min(360, window.innerWidth - 24);
    if (btt) {
      var bttTopFromBottom = Math.ceil(window.innerHeight - btt.top);
      var hitsX = (12 + panelW) > btt.left && 12 < btt.right;
      var clearsY = panelBottom >= bttTopFromBottom + GAP;
      if (hitsX && !clearsY) {
        var narrow = Math.floor(btt.left - GAP - 12);
        if (narrow >= 200) panelW = Math.min(panelW, narrow);
        else panelBottom = bttTopFromBottom + GAP;
      }
    }
    p.style.left = "12px";
    p.style.right = "auto";
    p.style.width = panelW + "px";
    p.style.bottom = panelBottom + "px";
    var maxH = window.innerHeight - panelBottom - headerBottom() - GAP;
    if (maxH < 180) maxH = Math.max(160, window.innerHeight - panelBottom - 8);
    p.style.maxHeight = Math.min(600, Math.floor(maxH)) + "px";

    var br = btn.getBoundingClientRect();
    if (bar && br.bottom > bar.top - GAP) {
      btnBottom += Math.ceil(br.bottom - (bar.top - GAP));
      btn.style.bottom = btnBottom + "px";
      panelBottom = btnBottom + (btn.offsetHeight || btnH) + 10;
      p.style.bottom = panelBottom + "px";
    }
    if (p.classList.contains("open") && btt) {
      var pr = p.getBoundingClientRect();
      if (overlaps(pr, btt)) {
        var shrink = Math.ceil(pr.right - (btt.left - GAP));
        if (shrink > 0) p.style.width = Math.max(200, Math.floor(pr.width - shrink)) + "px";
      }
      var hb = headerBottom();
      pr = p.getBoundingClientRect();
      if (pr.top < hb + GAP) {
        var cut = Math.ceil(hb + GAP - pr.top);
        var mh = parseFloat(p.style.maxHeight) || pr.height;
        p.style.maxHeight = Math.max(160, Math.floor(mh - cut)) + "px";
      }
    }
  }

  var scheduled = 0;
  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(function () {
      scheduled = 0;
      place();
    });
  }
  function toggle(o) {
    p.classList.toggle("open", o);
    p.setAttribute("aria-hidden", o ? "false" : "true");
    btn.setAttribute("aria-expanded", o ? "true" : "false");
    if (o && !greeted) {
      greeted = 1;
      say("Hi! I can answer questions about Chief Janitorial or help you book a free quote.");
      menu();
    }
    place();
    if (o) {
      try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
    }
  }
  btn.setAttribute("aria-expanded", "false");
  btn.onclick = function () { toggle(!p.classList.contains("open")); };
  p.querySelector("header button").onclick = function () { toggle(false); };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("scroll", schedule, { passive: true });
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", schedule);
    visualViewport.addEventListener("scroll", schedule);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  place();
})();
