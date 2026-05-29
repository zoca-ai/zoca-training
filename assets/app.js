/* ============================================================
   Zoca Sales Academy — client app (vanilla JS, no deps)
   Static site: auth against data/users.json (plaintext, internal
   only), curriculum from data/curriculum.json, progress + quiz
   scores in localStorage keyed by user email.
   ============================================================ */
"use strict";

const SESSION_KEY = "zoca_academy_session";
const progressKey = (email) => `zoca_academy_progress::${email.toLowerCase()}`;

const state = {
  users: [],
  curriculum: null,
  session: null, // { email, name }
};

/* ---------------- utils ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

/* ---------------- progress store ---------------- */
function getProgress() {
  if (!state.session) return { completed: {}, scores: {}, certs: {} };
  try {
    return (
      JSON.parse(localStorage.getItem(progressKey(state.session.email))) || {
        completed: {},
        scores: {},
        certs: {},
      }
    );
  } catch {
    return { completed: {}, scores: {}, certs: {} };
  }
}
function saveProgress(p) {
  if (!state.session) return;
  localStorage.setItem(progressKey(state.session.email), JSON.stringify(p));
}
const moduleGid = (tid, mid) => `${tid}/${mid}`;
function markLessonComplete(tid, mid) {
  const p = getProgress();
  p.completed[moduleGid(tid, mid)] = true;
  saveProgress(p);
}
function recordQuizScore(tid, mid, pct) {
  const p = getProgress();
  const gid = moduleGid(tid, mid);
  p.scores[gid] = Math.max(p.scores[gid] || 0, pct);
  p.completed[gid] = true; // taking the quiz completes the module
  saveProgress(p);
}
function recordCert(tid, pct) {
  const p = getProgress();
  p.certs[tid] = { pct, date: new Date().toISOString().slice(0, 10) };
  saveProgress(p);
}

/* track stats: % of modules whose lesson is complete */
function trackStats(track) {
  const p = getProgress();
  const total = track.modules.length;
  let done = 0;
  let scoreSum = 0;
  let scored = 0;
  track.modules.forEach((m) => {
    const gid = moduleGid(track.id, m.id);
    if (p.completed[gid]) done++;
    if (p.scores[gid] != null) {
      scoreSum += p.scores[gid];
      scored++;
    }
  });
  return {
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    avgScore: scored ? Math.round(scoreSum / scored) : null,
    cert: p.certs[track.id] || null,
  };
}

/* ---------------- auth ---------------- */
async function boot() {
  try {
    const [users, curriculum] = await Promise.all([
      fetch("data/users.json").then((r) => r.json()),
      fetch("data/curriculum.json").then((r) => r.json()),
    ]);
    state.users = users;
    state.curriculum = curriculum;
  } catch (e) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:sans-serif">Could not load course data. If you opened this file directly, run it through a local web server (e.g. <code>python3 -m http.server</code>).</div>';
    return;
  }

  const saved = sessionRead();
  if (saved) {
    state.session = saved;
    showApp();
  } else {
    showLogin();
  }
  window.addEventListener("hashchange", router);
}

function sessionRead() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function showLogin() {
  $("#app").hidden = true;
  $("#login-screen").hidden = false;
  const form = $("#login-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim().toLowerCase();
    const pw = $("#login-password").value;
    const user = state.users.find(
      (u) => u.email.toLowerCase() === email && u.password === pw
    );
    const errBox = $("#login-error");
    if (!user) {
      errBox.textContent = "Email or password not recognised.";
      errBox.hidden = false;
      return;
    }
    state.session = { email: user.email, name: user.name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    showApp();
  };
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  state.session = null;
  location.hash = "";
  showLogin();
}

/* ---------------- shell ---------------- */
function showApp() {
  $("#login-screen").hidden = true;
  $("#app").hidden = false;
  $("#user-name").textContent = state.session.name;
  $("#user-avatar").textContent = initials(state.session.name);
  $("#logout-btn").onclick = logout;
  $("#menu-toggle").onclick = () => $("#app").classList.toggle("nav-open");
  buildSidebar();
  if (!location.hash) location.hash = "#/dashboard";
  else router();
}

function buildSidebar() {
  const nav = $("#sidebar-nav");
  nav.innerHTML = "";
  const dash = el("a", { class: "nav-item", href: "#/dashboard" });
  dash.innerHTML = `<span class="nav-emoji">🏠</span> Dashboard`;
  nav.appendChild(dash);
  const badges = el("a", { class: "nav-item", href: "#/badges" });
  badges.innerHTML = `<span class="nav-emoji">🎖️</span> My certifications`;
  nav.appendChild(badges);

  const groups = {
    foundations: { label: "Foundations", items: [] },
    product: { label: "Product training", items: [] },
    selling: { label: "Selling Zoca", items: [] },
  };
  state.curriculum.tracks.forEach((t) => {
    (groups[t.type] || groups.product).items.push(t);
  });
  for (const key of ["foundations", "product", "selling"]) {
    const g = groups[key];
    if (!g.items.length) continue;
    nav.appendChild(el("div", { class: "nav-section-label" }, g.label));
    g.items.forEach((t) => {
      const a = el("a", { class: "nav-item", href: `#/track/${t.id}` });
      const st = trackStats(t);
      const right = st.cert
        ? `<span class="nav-badge">🎖️</span>`
        : `<span class="nav-pct">${st.pct}%</span>`;
      a.innerHTML = `<span class="nav-emoji">${t.emoji || "📘"}</span> ${esc(
        t.title
      )} ${right}`;
      nav.appendChild(a);
    });
  }
}

function setActiveNav(hash) {
  document
    .querySelectorAll(".nav-item")
    .forEach((n) =>
      n.classList.toggle("active", n.getAttribute("href") === hash)
    );
}

function setBreadcrumb(parts) {
  $("#breadcrumb").innerHTML = parts
    .map((p) =>
      p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : esc(p.label)
    )
    .join(' <span style="opacity:.5">›</span> ');
}

function setTopProgress(track) {
  const box = $("#topbar-progress");
  if (!track) {
    box.textContent = "";
    return;
  }
  const st = trackStats(track);
  box.textContent = `${st.done}/${st.total} modules`;
}

function findTrack(tid) {
  return state.curriculum.tracks.find((t) => t.id === tid);
}

/* ---------------- router ---------------- */
function router() {
  const hash = location.hash || "#/dashboard";
  $("#app").classList.remove("nav-open");
  const parts = hash.replace(/^#\//, "").split("/");
  const view = $("#view");
  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  setActiveNav(hash);

  if (parts[0] === "dashboard" || parts[0] === "") return renderDashboard();
  if (parts[0] === "badges") return renderBadges();
  if (parts[0] === "track") return renderTrack(parts[1]);
  if (parts[0] === "lesson") return renderLesson(parts[1], parts[2]);
  if (parts[0] === "quiz") return renderQuiz(parts[1], parts[2]);
  if (parts[0] === "final") return renderFinal(parts[1]);
  renderDashboard();
}

/* ---------------- views ---------------- */
function renderDashboard() {
  setActiveNav("#/dashboard");
  setBreadcrumb([{ label: "Dashboard" }]);
  setTopProgress(null);
  const view = $("#view");
  const tracks = state.curriculum.tracks;

  let modulesDone = 0,
    modulesTotal = 0,
    certs = 0,
    scoreSum = 0,
    scoreN = 0;
  tracks.forEach((t) => {
    const s = trackStats(t);
    modulesDone += s.done;
    modulesTotal += s.total;
    if (s.cert) certs++;
    if (s.avgScore != null) {
      scoreSum += s.avgScore;
      scoreN++;
    }
  });
  const overallPct = modulesTotal
    ? Math.round((modulesDone / modulesTotal) * 100)
    : 0;
  const avg = scoreN ? Math.round(scoreSum / scoreN) : "—";

  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Welcome back</div>
      <h1>Hi ${esc(state.session.name.split(" ")[0])} 👋</h1>
      <p class="lede">Your training across the Zoca suite. Finish a module, take its quiz, certify on each product.</p>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="stat-num">${overallPct}%</div><div class="stat-label">Overall progress</div></div>
      <div class="stat"><div class="stat-num">${modulesDone}/${modulesTotal}</div><div class="stat-label">Modules complete</div></div>
      <div class="stat"><div class="stat-num">${avg}${
    avg === "—" ? "" : "%"
  }</div><div class="stat-label">Avg quiz score</div></div>
      <div class="stat"><div class="stat-num">${certs}</div><div class="stat-label">Certifications</div></div>
    </div>`;

  const groups = [
    ["foundations", "Foundations — learn the concepts"],
    ["product", "Product training"],
    ["selling", "Selling Zoca"],
  ];
  groups.forEach(([type, label]) => {
    const items = tracks.filter((t) => (t.type || "product") === type);
    if (!items.length) return;
    view.appendChild(el("div", { class: "section-title" }, label));
    const grid = el("div", { class: "grid grid-2" });
    items.forEach((t) => grid.appendChild(trackCard(t)));
    view.appendChild(grid);
  });
}

function trackCard(t) {
  const s = trackStats(t);
  const a = el("a", { class: "card track-card", href: `#/track/${t.id}` });
  a.innerHTML = `
    <div class="track-card-top">
      <div class="track-emoji">${t.emoji || "📘"}</div>
      <div>
        <h3>${esc(t.title)} ${s.cert ? "🎖️" : ""}</h3>
        <div class="track-meta">${t.modules.length} modules${
    t.type === "foundations" ? " · concepts" : ""
  }</div>
      </div>
    </div>
    <p>${esc(t.blurb || "")}</p>
    <div class="progress-row">
      <div class="progress"><span style="width:${s.pct}%"></span></div>
      <span>${s.pct}%</span>
    </div>`;
  return a;
}

function renderTrack(tid) {
  const t = findTrack(tid);
  if (!t) return renderDashboard();
  setActiveNav(`#/track/${tid}`);
  setBreadcrumb([
    { label: "Dashboard", href: "#/dashboard" },
    { label: t.title },
  ]);
  setTopProgress(t);
  const p = getProgress();
  const s = trackStats(t);
  const view = $("#view");

  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">${
        t.type === "foundations"
          ? "Foundations"
          : t.type === "selling"
          ? "Selling Zoca"
          : "Product training"
      }</div>
      <h1>${t.emoji || "📘"} ${esc(t.title)}</h1>
      <p class="lede">${esc(t.blurb || "")}</p>
      <div class="progress-row" style="margin-top:16px;max-width:420px">
        <div class="progress"><span style="width:${s.pct}%"></span></div>
        <span>${s.done}/${s.total} done${
    s.avgScore != null ? " · avg " + s.avgScore + "%" : ""
  }</span>
      </div>
    </div>`;

  const list = el("div", { class: "module-list" });
  t.modules.forEach((m, i) => {
    const gid = moduleGid(t.id, m.id);
    const done = !!p.completed[gid];
    const score = p.scores[gid];
    const row = el("a", {
      class: "module-row" + (done ? " done" : ""),
      href: `#/lesson/${t.id}/${m.id}`,
    });
    let status = `<span class="pill">Start</span>`;
    if (score != null)
      status = `<span class="pill score">Quiz ${score}%</span>`;
    else if (done) status = `<span class="pill done">Read ✓</span>`;
    row.innerHTML = `
      <div class="module-idx">${done ? "✓" : i + 1}</div>
      <div class="module-info">
        <h4>${esc(m.title)}</h4>
        <div class="module-sub">${esc(m.sub || "")}${
      m.minutes ? " · " + m.minutes + " min" : ""
    }${m.quiz ? " · quiz" : ""}</div>
      </div>
      <div class="module-status">${status}</div>`;
    list.appendChild(row);
  });
  view.appendChild(list);

  // final cert block
  if (t.final) {
    const allDone = s.done === s.total;
    const cert = p.certs[t.id];
    const box = el("div", { class: "card", style: "margin-top:24px" });
    box.innerHTML = `
      <div class="track-card-top">
        <div class="track-emoji">${cert ? "🎖️" : "🏁"}</div>
        <div>
          <h3>${esc(t.title)} certification</h3>
          <div class="track-meta">${
            cert
              ? `Earned ${cert.date} · scored ${cert.pct}%`
              : `Pass the final (${t.final.passScore || 80}%+) to certify`
          }</div>
        </div>
      </div>
      <p>${
        cert
          ? "You're certified on this track. You can retake the assessment any time."
          : allDone
          ? "You've finished every module — time to certify."
          : "Finish all modules above to unlock the final assessment."
      }</p>
      <button class="btn ${allDone || cert ? "btn-primary" : "btn-ghost"}" ${
      allDone || cert ? "" : "disabled"
    } onclick="location.hash='#/final/${t.id}'">
        ${cert ? "Retake final" : "Take final assessment"}
      </button>`;
    view.appendChild(box);
  }
}

async function renderLesson(tid, mid) {
  const t = findTrack(tid);
  const m = t && t.modules.find((x) => x.id === mid);
  if (!t || !m) return renderDashboard();
  const idx = t.modules.findIndex((x) => x.id === mid);
  setActiveNav(`#/track/${tid}`);
  setBreadcrumb([
    { label: "Dashboard", href: "#/dashboard" },
    { label: t.title, href: `#/track/${tid}` },
    { label: m.title },
  ]);
  setTopProgress(t);
  const view = $("#view");
  view.innerHTML = `<div class="lesson"><p class="empty">Loading lesson…</p></div>`;

  let body = "<p>(No content)</p>";
  if (m.file) {
    try {
      body = await fetch(m.file).then((r) => r.text());
    } catch {
      body = "<p>Could not load this lesson.</p>";
    }
  }
  markLessonComplete(tid, mid);

  const next = t.modules[idx + 1];
  view.innerHTML = "";
  const card = el("div", { class: "lesson" });
  card.innerHTML = body;
  view.appendChild(card);

  const foot = el("div", { class: "lesson-foot" });
  if (idx > 0)
    foot.appendChild(
      btn("← Previous", "btn-ghost", `#/lesson/${tid}/${t.modules[idx - 1].id}`)
    );
  foot.appendChild(el("div", { class: "spacer" }));
  if (m.quiz)
    foot.appendChild(
      btn("Take the quiz →", "btn-primary", `#/quiz/${tid}/${mid}`)
    );
  else if (next)
    foot.appendChild(
      btn("Next lesson →", "btn-primary", `#/lesson/${tid}/${next.id}`)
    );
  else
    foot.appendChild(btn("Back to track →", "btn-primary", `#/track/${tid}`));
  view.appendChild(foot);
  buildSidebar();
}

function btn(label, cls, href) {
  const b = el("button", { class: "btn " + cls }, label);
  b.onclick = () => (location.hash = href);
  return b;
}

/* ---------------- quizzes ---------------- */
function renderQuiz(tid, mid) {
  const t = findTrack(tid);
  const m = t && t.modules.find((x) => x.id === mid);
  if (!t || !m || !m.quiz) return renderTrack(tid);
  runQuiz({
    questions: m.quiz.questions,
    passScore: m.quiz.passScore || 70,
    title: `${m.title} — quiz`,
    crumbs: [
      { label: "Dashboard", href: "#/dashboard" },
      { label: t.title, href: `#/track/${tid}` },
      { label: m.title, href: `#/lesson/${tid}/${mid}` },
      { label: "Quiz" },
    ],
    onDone: (pct) => recordQuizScore(tid, mid, pct),
    backHref: `#/track/${tid}`,
    nextHref: (() => {
      const idx = t.modules.findIndex((x) => x.id === mid);
      const n = t.modules[idx + 1];
      return n ? `#/lesson/${tid}/${n.id}` : `#/track/${tid}`;
    })(),
    track: t,
  });
}

function renderFinal(tid) {
  const t = findTrack(tid);
  if (!t || !t.final) return renderTrack(tid);
  // gate: must finish all modules first (unless already certified)
  const st = trackStats(t);
  if (!st.cert && st.done < st.total) {
    location.hash = `#/track/${tid}`;
    return;
  }
  runQuiz({
    questions: t.final.questions,
    passScore: t.final.passScore || 80,
    title: `${t.title} — final assessment`,
    crumbs: [
      { label: "Dashboard", href: "#/dashboard" },
      { label: t.title, href: `#/track/${tid}` },
      { label: "Final assessment" },
    ],
    isFinal: true,
    onDone: (pct) => {
      if (pct >= (t.final.passScore || 80)) recordCert(tid, pct);
    },
    backHref: `#/track/${tid}`,
    track: t,
  });
}

function runQuiz(cfg) {
  setBreadcrumb(cfg.crumbs);
  setTopProgress(cfg.track);
  const view = $("#view");
  const answers = new Array(cfg.questions.length).fill(null);

  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">${
        cfg.isFinal ? "Final assessment" : "Knowledge check"
      }</div>
      <h1>${esc(cfg.title)}</h1>
      <p class="lede">${cfg.questions.length} questions · pass at ${
    cfg.passScore
  }%${cfg.isFinal ? " to earn your certification" : ""}.</p>
    </div>`;

  const form = el("div", {});
  cfg.questions.forEach((q, qi) => {
    const card = el("div", { class: "quiz-q", "data-qi": qi });
    let opts = "";
    q.options.forEach((opt, oi) => {
      opts += `<label class="q-option" data-oi="${oi}">
        <input type="radio" name="q${qi}" value="${oi}" />
        <span>${esc(opt)}</span></label>`;
    });
    card.innerHTML = `<div class="q-num">Question ${qi + 1}</div>
      <div class="q-text">${esc(q.q)}</div>${opts}`;
    card.querySelectorAll("input").forEach((inp) => {
      inp.onchange = () => {
        answers[qi] = Number(inp.value);
      };
    });
    form.appendChild(card);
  });
  view.appendChild(form);

  const foot = el("div", { class: "lesson-foot" });
  foot.appendChild(btn("← Back", "btn-ghost", cfg.backHref));
  foot.appendChild(el("div", { class: "spacer" }));
  const submit = el("button", { class: "btn btn-primary" }, "Submit answers");
  foot.appendChild(submit);
  view.appendChild(foot);

  submit.onclick = () => {
    if (answers.includes(null)) {
      alert("Please answer every question first.");
      return;
    }
    let correct = 0;
    cfg.questions.forEach((q, qi) => {
      const card = form.querySelector(`[data-qi="${qi}"]`);
      card.querySelectorAll(".q-option").forEach((lab) => {
        lab.querySelector("input").disabled = true;
        const oi = Number(lab.dataset.oi);
        if (oi === q.answer) lab.classList.add("correct");
        else if (oi === answers[qi]) lab.classList.add("incorrect");
      });
      if (answers[qi] === q.answer) correct++;
      if (q.explain) {
        const ex = el(
          "div",
          { class: "q-explain" },
          `<b>${answers[qi] === q.answer ? "Correct." : "Answer:"}</b> ${esc(
            q.explain
          )}`
        );
        card.appendChild(ex);
      }
    });
    const pct = Math.round((correct / cfg.questions.length) * 100);
    cfg.onDone?.(pct);
    buildSidebar();

    const pass = pct >= cfg.passScore;
    const result = el("div", {
      class: "result-card",
      style: "margin-top:24px",
    });
    result.innerHTML = `
      <div class="result-score ${pass ? "pass" : "fail"}">${pct}%</div>
      <div class="result-msg">${correct} of ${cfg.questions.length} correct — ${
      pass
        ? cfg.isFinal
          ? "you're certified! 🎖️"
          : "passed ✓"
        : `you need ${cfg.passScore}% to ${
            cfg.isFinal ? "certify" : "pass"
          }. Review and retake.`
    }</div>`;
    const rf = el("div", { class: "lesson-foot" });
    rf.appendChild(el("div", { class: "spacer" }));
    const retake = el("button", { class: "btn btn-ghost" }, "Retake");
    retake.onclick = () => router();
    rf.appendChild(retake);
    if (pass && cfg.nextHref)
      rf.appendChild(btn("Continue →", "btn-primary", cfg.nextHref));
    else if (pass)
      rf.appendChild(btn("Back to track →", "btn-primary", cfg.backHref));
    result.appendChild(rf);
    submit.parentElement.replaceWith(result);
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

/* ---------------- badges ---------------- */
function renderBadges() {
  setActiveNav("#/badges");
  setBreadcrumb([
    { label: "Dashboard", href: "#/dashboard" },
    { label: "My certifications" },
  ]);
  setTopProgress(null);
  const view = $("#view");
  const p = getProgress();
  const certable = state.curriculum.tracks.filter((t) => t.final);
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Certifications</div>
      <h1>🎖️ My certifications</h1>
      <p class="lede">Pass each track's final assessment to earn its badge.</p>
    </div>`;
  const grid = el("div", { class: "badge-grid" });
  certable.forEach((t) => {
    const cert = p.certs[t.id];
    const b = el("div", { class: "badge" + (cert ? " earned" : "") });
    b.innerHTML = `
      <div class="seal">${cert ? "🎖️" : t.emoji || "📘"}</div>
      <div class="badge-name">${esc(t.title)}</div>
      <div class="badge-state">${
        cert ? `Certified · ${cert.pct}%` : "Not yet earned"
      }</div>`;
    grid.appendChild(b);
  });
  view.appendChild(grid);
}

/* ---------------- go ---------------- */
boot();
