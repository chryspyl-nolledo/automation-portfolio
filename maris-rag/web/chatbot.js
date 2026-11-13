/* Portfolio chat widget: About Me bot + SunPinoy Solar demo bot
   Backend: Lambda Function URL -> Amazon Lex V2 (+ Translate for solar). Audio: pre-made Amazon Polly MP3s. */
(function () {
  // ===== SETTINGS =====
  var API_URL = "YOUR_LEX_BOT_URL";   // your Lambda Function URL (ends with .on.aws/)
  var MARIS_URL = "YOUR_FUNCTION_URL";   // Project 14 RAG (mode: about)
  var script = document.currentScript;
  var SITE = (script && script.getAttribute("data-site")) || "cv";
  var PAGE = (script && script.getAttribute("data-page")) || "home";
  var PAGES = {
    ai: { name: "AI Projects", hello: "Hi, I'm Maris. You're on the AI Projects page. Ask me about any project here, like 13A, 13C or Project 14, the safety manual assistant.",
      chips: ["What is Project 14?", "How does 13C work on AWS?", "Ano ang 13B?", "Is the AI output final?"] },
    automation: { name: "Workflow Automation", hello: "Hi, I'm Maris. You're on the Workflow Automation page. Ask me about any n8n workflow here.",
      chips: ["What does the Fleet PMS Reminder do?", "How are PMS jobs sent to ClickUp?", "Ano ang Error Alert?", "What tools are used?"] },
    business: { name: "Business Apps", hello: "Hi, I'm Maris. You're on the Business Apps page. Ask me about the Shopify, Odoo and AI sales agent projects.",
      chips: ["What is the SunGuard AI Sales Agent?", "How does Shopify sync to Odoo?", "Ano ang SeaLink Ship Spares?", "Is this a real store?"] },
    aws: { name: "AWS Projects", hello: "Hi, I'm Maris. You're on the AWS Projects page. Ask me about any of the AWS builds here.",
      chips: ["What is the PMS Document Reader?", "How does the Cost & Security Monitor work?", "Ano ang Cargo Release Check?", "Which AWS services did he use?"] },
    data: { name: "Data & Dashboards", hello: "Hi, I'm Maris. You're on the Data & Dashboards page. Ask me about the Power BI and live dashboards.",
      chips: ["What does the Fleet PMS Dashboard show?", "Is the live dashboard real data?", "Ano ang Fish Trading dashboard?", "What tools were used?"] }
  };   // "cv" or "upwork"

  var BOTS = {
    aboutme: {
      label: "About Me", name: "Chryspyl (bot)", audioDir: "aboutme-audio/",
      hello: "Hi! I'm a bot version of Chryspyl. Ask me about his experience, ships, skills or the job he's looking for.",
      chips: ["Who are you?", "What ships have you worked on?", "What are your skills?", "Can I call you?"]
    },
    maris: {
      label: "Maris (AI)", name: "Maris · AI assistant", sub: "Gemini RAG · Polly · Lambda",
      note: "AI answers from portfolio notes · can make mistakes",
      hello: "Hi, I'm Maris, Chryspyl's AI assistant. Ask me about his experience, skills or projects, in English or Taglish.",
      chips: ["Who is Chryspyl?", "What AWS projects did he build?", "What work is he looking for?", "Ano ang mga AI projects niya?"]
    },
    solar: {
      label: "Solar Shop", name: "Sunny · SunPinoy Solar (demo)", audioDir: "solar-audio/",
      hello: "Hi, I'm Sunny! Ask about panels, batteries, inverters or packages. You can type in English, Tagalog, Bisaya, Chinese and more.",
      chips: ["Magkano ang solar panel?", "Do you have a starter package?", "What is the warranty?", "Do you deliver?"]
    }
  };
  var UPWORK_OVERRIDE = {
    Contact: "Please contact me through Upwork. I reply fastest in writing.",
    Communication: "I prefer written communication. Please message me through Upwork."
  };

  // ===== AVATARS (original drawings) =====
  var AVATAR = {
    maris: '<img src="maris/poster.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">',
    aboutme:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" fill="#cfe3f5"/>' +
      '<path d="M22 118c4-24 20-34 38-34s34 10 38 34z" fill="#0f2f52"/><path d="M50 86l10 14 10-14z" fill="#fff"/>' +
      '<rect x="31" y="96" width="12" height="4" rx="1" fill="#e2b33c"/><rect x="77" y="96" width="12" height="4" rx="1" fill="#e2b33c"/>' +
      '<g class="cb-headg"><ellipse cx="60" cy="62" rx="24" ry="27" fill="#c98e62"/>' +
      '<path d="M34 42c2-14 13-22 26-22s24 8 26 22z" fill="#0f2f52"/><rect x="31" y="40" width="58" height="8" rx="3" fill="#0b2340"/>' +
      '<rect x="31" y="40" width="58" height="3" fill="#e2b33c"/><circle cx="60" cy="31" r="5" fill="#e2b33c"/>' +
      '<g class="cb-eyes"><circle cx="51" cy="60" r="3" fill="#1b1b1b"/><circle cx="69" cy="60" r="3" fill="#1b1b1b"/></g>' +
      '<path class="cb-brows" d="M46 53q5-3 10 0M64 53q5-3 10 0" stroke="#3b2516" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<g class="cb-mouth"><path d="M51 75q9 7 18 0" stroke="#5a2a1a" stroke-width="3" fill="#7a2e22" stroke-linecap="round"/></g></g>' +
      '<g class="cb-hand"><path d="M92 112l8-26" stroke="#0f2f52" stroke-width="9" stroke-linecap="round"/><circle cx="101" cy="82" r="6" fill="#c98e62"/></g></svg>',
    solar:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" fill="#fff4d6"/>' +
      '<g class="cb-rays" stroke="#f2a20c" stroke-width="5" stroke-linecap="round"><path d="M60 8v12M60 100v12M8 60h12M100 60h12M23 23l9 9M88 88l9 9M97 23l-9 9M32 88l-9 9"/></g>' +
      '<g class="cb-headg"><circle cx="60" cy="60" r="32" fill="#ffc531"/>' +
      '<g transform="translate(36 18) rotate(-8)"><rect width="48" height="18" rx="2" fill="#1f4f8f"/>' +
      '<path d="M12 0v18M24 0v18M36 0v18M0 9h48" stroke="#9cc3ee" stroke-width="1.5"/></g>' +
      '<g class="cb-eyes"><circle cx="49" cy="58" r="4" fill="#3a2a05"/><circle cx="71" cy="58" r="4" fill="#3a2a05"/></g>' +
      '<circle cx="42" cy="70" r="5" fill="#ff9a6b" opacity=".6"/><circle cx="78" cy="70" r="5" fill="#ff9a6b" opacity=".6"/>' +
      '<g class="cb-mouth"><path d="M48 72q12 10 24 0" stroke="#7a3d05" stroke-width="3" fill="#b5520e" stroke-linecap="round"/></g></g></svg>'
  };

  // ===== STYLES =====
  var css =
    ".cb-btn{position:fixed;right:16px;bottom:16px;z-index:9999;width:64px;height:64px;border-radius:50%;border:0;padding:0;cursor:pointer;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25)}" +
    ".cb-btn svg{width:100%;height:100%;display:block}" +
    ".cb-btn::after{content:'Ask Maris';position:absolute;right:70px;top:18px;background:#0b2a4a;color:#fff;font:600 13px 'Libre Franklin',Arial,sans-serif;padding:4px 10px;border-radius:999px;white-space:nowrap}" +
    ".cb-open .cb-btn::after{display:none}" +
    ".cb-panel{position:fixed;right:16px;bottom:92px;z-index:9999;width:min(370px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;background:#fbfdff;color:#12273b;border:1px solid rgba(12,44,74,.15);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden;font:15px/1.5 'Libre Franklin','Segoe UI',Arial,sans-serif}" +
    ".cb-open .cb-panel{display:flex}" +
    ".cb-tabs{display:flex;background:#0b2a4a}" +
    ".cb-tabs button{flex:1;border:0;background:none;color:#a9c4de;font-weight:600;font-size:14px;font-family:inherit;padding:12px 8px;cursor:pointer;border-bottom:3px solid transparent}" +
    ".cb-tabs button[aria-selected=true]{color:#fff;border-bottom-color:#e2b33c}" +
    ".cb-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(12,44,74,.1)}" +
    ".cb-face{width:58px;height:58px;flex:none}.cb-face svg{width:100%;height:100%}" +
    ".cb-title{font:600 16px 'Zilla Slab',Georgia,serif;margin:0}.cb-sub{font-size:12px;color:#46596b;margin:0}" +
    ".cb-mute{margin-left:auto;border:1px solid rgba(12,44,74,.2);background:#fff;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer;color:#12273b;white-space:nowrap}" +
    ".cb-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}" +
    ".cb-msg{max-width:85%;padding:8px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}" +
    ".cb-bot{background:#e8f0f8;align-self:flex-start;border-bottom-left-radius:4px}" +
    ".cb-me{background:#1d5f99;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}" +
    ".cb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}" +
    ".cb-chips button{border:1px solid #1d5f99;color:#1d5f99;background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-family:inherit;cursor:pointer}" +
    ".cb-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(12,44,74,.1)}" +
    ".cb-form input{flex:1;min-width:0;border:1px solid rgba(12,44,74,.25);border-radius:999px;padding:9px 14px;font-size:15px;font-family:inherit;color:#12273b;background:#fff}" +
    ".cb-form button{border:0;background:#1d5f99;color:#fff;border-radius:999px;padding:0 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer}" +
    ".cb-note{font-size:11px;color:#6b7c8c;text-align:center;padding:0 10px 8px}" +
    ".cb-talk .cb-mouth{animation:cbtalk .22s infinite alternate;transform-origin:60px 74px;transform-box:view-box}" +
    "@keyframes cbtalk{from{transform:scaleY(1)}to{transform:scaleY(.35)}}" +
    ".cb-face svg *,.cb-btn svg *{transform-box:view-box}" +
    ".cb-eyes{transform-origin:60px 59px;animation:cbblink 4s infinite}" +
    "@keyframes cbblink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}" +
    ".cb-headg{transform-origin:60px 90px}.cb-hand{transform-origin:92px 112px;opacity:0;transition:opacity .2s}" +
    ".cb-talk .cb-headg{animation:cbbob .9s ease-in-out infinite}" +
    "@keyframes cbbob{0%,100%{transform:rotate(0) translateY(0)}25%{transform:rotate(-4deg) translateY(-1px)}75%{transform:rotate(4deg) translateY(-1px)}}" +
    ".cb-talk .cb-brows{animation:cbbrow 1.4s ease-in-out infinite}" +
    "@keyframes cbbrow{0%,60%,100%{transform:translateY(0)}70%,85%{transform:translateY(-2px)}}" +
    ".cb-talk .cb-hand{opacity:1;animation:cbwave .6s ease-in-out infinite alternate}" +
    "@keyframes cbwave{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}" +
    ".cb-rays{transform-origin:60px 60px}.cb-talk .cb-rays{animation:cbspin 6s linear infinite}" +
    "@keyframes cbspin{to{transform:rotate(360deg)}}" +
    ".cb-btn svg{animation:cbfloat 3s ease-in-out infinite}@keyframes cbfloat{50%{transform:translateY(-3px)}}" +
    "@media (prefers-reduced-motion:reduce){.cb-face *,.cb-btn *{animation:none!important}}" +
    ".cb-stage{display:none;background:#0b1424}.cb-maris .cb-stage{display:block}" +
    ".cb-stage video{width:100%;height:150px;object-fit:cover;object-position:center 30%;display:block}" +
    "@media (max-height:760px){.cb-stage video{height:110px}}" +
    ".cb-greet{position:fixed;right:16px;bottom:92px;z-index:9999;max-width:min(280px,calc(100vw - 32px));background:#fff;color:#12273b;border:1px solid rgba(12,44,74,.15);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:10px 34px 10px 10px;display:none;gap:10px;align-items:center;font:14px/1.4 'Libre Franklin','Segoe UI',Arial,sans-serif;cursor:pointer}" +
    ".cb-greet.show{display:flex}.cb-open .cb-greet{display:none}" +
    ".cb-greet img{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none}" +
    ".cb-greet .x{position:absolute;right:6px;top:4px;border:0;background:none;font-size:18px;line-height:1;color:#46596b;cursor:pointer;padding:4px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ===== BUILD UI =====
  var root = document.createElement("div");
  root.innerHTML =
    '<button class="cb-btn" aria-label="Open chat with Maris">' + AVATAR.maris + '</button>' +
    '<div class="cb-panel" role="dialog" aria-label="Chat">' +
      '<div class="cb-tabs" role="tablist"><button role="tab" data-bot="maris">Maris (AI)</button><button role="tab" data-bot="aboutme">About Me</button><button role="tab" data-bot="solar">Solar Shop</button></div>' +
      '<div class="cb-head"><div class="cb-face"></div><div><p class="cb-title"></p><p class="cb-sub">Amazon Lex · Polly · Lambda</p></div><button class="cb-mute" type="button">🔊 Voice on</button></div>' +
      '<div class="cb-stage"><video muted playsinline loop preload="none" aria-label="Maris, the AI assistant"></video></div>' +
      '<div class="cb-log" aria-live="polite"></div><div class="cb-chips"></div>' +
      '<form class="cb-form"><input type="text" maxlength="200" placeholder="Type a question…" aria-label="Message"><button type="submit">Send</button></form>' +
      '<div class="cb-note">Portfolio demo bot · answers are pre-written</div>' +
    '</div>' +
    '<div class="cb-greet" role="button" tabindex="0" aria-label="Chat with Maris"><img src="maris/poster.jpg" alt=""><span>Hi, I\'m <b>Maris</b>, Chryspyl\'s AI assistant. ' + (PAGES[PAGE] ? "Questions about this page? Ask me." : "Ask me about his work.") + '</span><button class="x" type="button" aria-label="Close">×</button></div>';
  document.body.appendChild(root);

  var $ = function (s) { return root.querySelector(s); };
  var btn = $(".cb-btn"), log = $(".cb-log"), chips = $(".cb-chips"), face = $(".cb-face"),
      title = $(".cb-title"), input = $(".cb-form input"), muteBtn = $(".cb-mute"),
      sub = $(".cb-sub"), note = $(".cb-note"), vid = $(".cb-stage video"), greet = $(".cb-greet");
  var mAudio = null;
  function clip(name, loop) {
    vid.loop = !!loop; vid.src = "maris/" + name + ".mp4";
    var p = vid.play(); if (p) p.catch(function () {});
  }
  vid.addEventListener("ended", function () { if (!mAudio) clip("neutral-idle", true); });
  function stopMaris() { if (mAudio) { mAudio.pause(); mAudio = null; } }
  function sayMaris(b64, name) {
    stopMaris();
    if (!b64 || !voice) { clip(name, false); return; }
    clip(name, true); mAudio = new Audio("data:audio/mpeg;base64," + b64);
    mAudio.onended = function () { mAudio = null; clip("neutral-idle", true); };
    mAudio.play().catch(function () { mAudio = null; clip(name, false); });
  }
  var current = "aboutme", voice = true, audio = new Audio(), state = {};
  Object.keys(BOTS).forEach(function (k) { state[k] = { history: [], sessionId: null }; });

  function talk(on) { face.classList.toggle("cb-talk", on); }
  audio.onplay = function () { talk(true); };
  audio.onended = audio.onpause = audio.onerror = function () { talk(false); };

  function play(file) {
    if (!voice || !file) return;
    audio.pause(); audio.src = file; audio.play().catch(function () { talk(false); });
  }
  function add(text, who, save) {
    var d = document.createElement("div");
    d.className = "cb-msg " + (who === "me" ? "cb-me" : "cb-bot"); d.textContent = text;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    if (save !== false) state[current].history.push([text, who]);
    return d;
  }
  function renderChips() {
    chips.innerHTML = "";
    BOTS[current].chips.forEach(function (c) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = c;
      b.onclick = function () { send(c); }; chips.appendChild(b);
    });
  }
  function switchBot(k) {
    current = k; audio.pause(); stopMaris();
    root.classList.toggle("cb-maris", k === "maris");
    sub.textContent = BOTS[k].sub || "Amazon Lex · Polly · Lambda";
    note.textContent = BOTS[k].note || "Portfolio demo bot · answers are pre-written";
    if (k === "maris") clip("neutral-idle", true); else vid.pause();
    root.querySelectorAll(".cb-tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.bot === k); });
    face.innerHTML = AVATAR[k]; title.textContent = BOTS[k].name; log.innerHTML = "";
    if (!state[k].history.length) add(BOTS[k].hello, "bot");
    else state[k].history.forEach(function (h) { add(h[0], h[1], false); });
    renderChips();
  }

  function send(text) {
    text = (text || "").trim(); if (!text) return;
    add(text, "me"); input.value = "";
    var bot = current, wait = add("…", "bot", false);
    if (bot === "maris") {
      clip("thinking", true);
      fetch(MARIS_URL, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, mode: "about", page: PAGE }) })
      .then(function (r) { return r.json(); }).then(function (d) {
        wait.remove();
        var reply = (d.answer || d.error || "Sorry, something went wrong.").replace(/[*_#`]+/g, "");
        if (bot === current) {
          add(reply, "bot");
          sayMaris(d.error ? null : d.audio, d.error || !d.found ? "apologetic" : (Math.random() < .5 ? "smile" : "confident"));
        } else state[bot].history.push([reply, "bot"]);
      }).catch(function () {
        wait.remove(); add("Sorry, Maris is not reachable right now. Please try again later.", "bot");
        if (bot === current) clip("apologetic", false);
      });
      return;
    }
    fetch(API_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bot: bot, text: text, sessionId: state[bot].sessionId })
    }).then(function (r) { return r.json(); }).then(function (d) {
      wait.remove(); state[bot].sessionId = d.sessionId;
      var intent = d.intent || "FallbackIntent", reply = d.reply || "Sorry, something went wrong.";
      var overridden = bot === "aboutme" && SITE === "upwork" && UPWORK_OVERRIDE[intent];
      if (overridden) reply = UPWORK_OVERRIDE[intent];
      if (bot === current) add(reply, "bot"); else state[bot].history.push([reply, "bot"]);
      // Pre-made Polly audio exists only for English answers
      if (bot === current && !overridden && (d.lang || "en") === "en") {
        var name = intent === "FallbackIntent" ? "Fallback" : intent;
        play(BOTS[bot].audioDir + name + ".mp3");
      }
    }).catch(function () {
      wait.remove(); add("Sorry, the bot is not reachable right now. Please try again later.", "bot");
    });
  }

  btn.onclick = function () {
    var open = root.classList.toggle("cb-open");
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) { input.focus(); greet.classList.remove("show"); if (current === "maris") clip("neutral-idle", true); }
    else { audio.pause(); stopMaris(); vid.pause(); }
  };
  function openMaris() {
    greet.classList.remove("show");
    if (!root.classList.contains("cb-open")) btn.onclick();
    switchBot("maris");
  }
  greet.onclick = function (e) { if (e.target.classList.contains("x")) { e.stopPropagation(); greet.classList.remove("show"); return; } openMaris(); };
  greet.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMaris(); } };
  var seen = false;
  try { seen = sessionStorage.getItem("marisGreet-" + PAGE) === "1"; } catch (e) {}
  if (!seen) setTimeout(function () {
    if (root.classList.contains("cb-open")) return;
    greet.classList.add("show");
    try { sessionStorage.setItem("marisGreet-" + PAGE, "1"); } catch (e) {}
    setTimeout(function () { greet.classList.remove("show"); }, 12000);
  }, 2500);
  root.querySelectorAll(".cb-tabs button").forEach(function (b) { b.onclick = function () { switchBot(b.dataset.bot); }; });
  muteBtn.onclick = function () { voice = !voice; muteBtn.textContent = voice ? "🔊 Voice on" : "🔇 Voice off"; if (!voice) { audio.pause(); if (mAudio) { stopMaris(); clip("neutral-idle", true); } } };
  $(".cb-form").onsubmit = function (e) { e.preventDefault(); send(input.value); };
  if (PAGES[PAGE]) { BOTS.maris.hello = PAGES[PAGE].hello; BOTS.maris.chips = PAGES[PAGE].chips; }
  switchBot("maris");
})();
