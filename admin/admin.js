/* ============================================================
   Zoca Sales Academy — Progress Overview (public, no auth)
   Reads roster (../data/users.json) + tracks (../data/curriculum.json)
   from the same Pages site, and learner progress from the Apps Script
   web app via JSONP. Joins them into one roster table.
   ============================================================ */
"use strict";

/* Apps Script /exec URL. Empty = backend not wired yet (roster still
   shows from users.json as "no data yet"). */
var SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzdVclgs5BkMMUk1BBoTqYYlJTAyxcAVfuOzzJT4XgUelYJMkUaDfAuWph2L5bW1rFG3Q/exec";

var TRACKS = [];
var ROSTER = []; // [{email,name,seed,updatedAt,completed,scores,certs}]
var sortKey = "overall";
var sortDir = -1; // -1 desc, 1 asc

var $ = function (s) {
  return document.querySelector(s);
};
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function banner(html, kind) {
  $("#banner").innerHTML = html
    ? '<div class="banner ' + (kind || "") + '">' + html + "</div>"
    : "";
}

/* ---- data loading ---- */
function jsonp(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var cbName = "__zoca_cb_" + Math.random().toString(36).slice(2);
    var s = document.createElement("script");
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("timeout"));
    }, timeoutMs || 12000);
    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    window[cbName] = function (data) {
      if (done) return;
      done = true;
      cleanup();
      resolve(data);
    };
    s.onerror = function () {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("network"));
    };
    s.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "callback=" + cbName;
    document.head.appendChild(s);
  });
}

function load() {
  banner("Loading…");
  Promise.all([
    fetch("../data/curriculum.json").then(function (r) {
      return r.json();
    }),
    fetch("../data/users.json").then(function (r) {
      return r.json();
    }),
  ])
    .then(function (res) {
      var curriculum = res[0];
      var seeds = res[1];
      TRACKS = (curriculum.tracks || []).map(function (t) {
        return {
          id: t.id,
          title: t.title,
          emoji: t.emoji || "📘",
          moduleIds: (t.modules || []).map(function (m) {
            return m.id;
          }),
          total: (t.modules || []).length,
        };
      });
      return fetchLearners().then(function (learners) {
        buildRoster(seeds, learners);
        render();
      });
    })
    .catch(function (err) {
      banner("Could not load course data: " + esc(err.message), "err");
    });
}

/* Apps Script intermittently returns transient 500s; retry before
   falling back to the seed roster. */
function jsonpRetry(url, attempts, delayMs) {
  return jsonp(url).catch(function (err) {
    if (attempts <= 1) throw err;
    banner("Progress backend hiccup (" + esc(err.message) + ") — retrying…");
    return new Promise(function (resolve) {
      setTimeout(resolve, delayMs);
    }).then(function () {
      return jsonpRetry(url, attempts - 1, delayMs * 2);
    });
  });
}

function fetchLearners() {
  if (!SCRIPT_URL) {
    banner(
      "Backend URL not configured yet — showing the seed roster only. " +
        "Set <code>SCRIPT_URL</code> in admin/admin.js once the Apps Script is deployed.",
      "warn"
    );
    return Promise.resolve([]);
  }
  return jsonpRetry(SCRIPT_URL, 3, 800)
    .then(function (data) {
      banner("");
      return (data && data.learners) || [];
    })
    .catch(function (err) {
      banner(
        "Couldn't reach the progress backend (" +
          esc(err.message) +
          "). Showing the seed roster only.",
        "warn"
      );
      return [];
    });
}

function buildRoster(seeds, learners) {
  var map = {};
  (seeds || []).forEach(function (u) {
    var e = String(u.email || "").toLowerCase();
    if (!e) return;
    map[e] = {
      email: e,
      name: u.name || u.email,
      seed: true,
      updatedAt: null,
      completed: {},
      scores: {},
      certs: {},
    };
  });
  (learners || []).forEach(function (l) {
    var e = String(l.email || "").toLowerCase();
    if (!e) return;
    var row = map[e] || { email: e, seed: false };
    row.email = e;
    row.name = l.name || (map[e] && map[e].name) || e;
    if (!(e in map)) row.seed = false;
    row.updatedAt = l.updatedAt || null;
    row.completed = l.completed || {};
    row.scores = l.scores || {};
    row.certs = l.certs || {};
    map[e] = row;
  });
  ROSTER = Object.keys(map).map(function (e) {
    return map[e];
  });
}

/* ---- per-learner computation ---- */
function trackDone(row, track) {
  var done = 0;
  track.moduleIds.forEach(function (mid) {
    if (row.completed && row.completed[track.id + "/" + mid]) done++;
  });
  return done;
}
function overallOf(row) {
  var done = 0,
    total = 0;
  TRACKS.forEach(function (t) {
    done += trackDone(row, t);
    total += t.total;
  });
  return {
    done: done,
    total: total,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
function certCountOf(row) {
  var n = 0;
  TRACKS.forEach(function (t) {
    if (row.certs && row.certs[t.id]) n++;
  });
  return n;
}
function hasAnyProgress(row) {
  return (
    (row.completed && Object.keys(row.completed).length > 0) || !!row.updatedAt
  );
}

/* ---- rendering ---- */
function fmtDate(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d)) return "—";
  var now = Date.now();
  var diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + "d ago";
  return d.toISOString().slice(0, 10);
}

function renderStats() {
  var total = ROSTER.length;
  var started = ROSTER.filter(hasAnyProgress).length;
  var certified = ROSTER.filter(function (r) {
    return certCountOf(r) > 0;
  }).length;
  var sumPct = 0;
  ROSTER.forEach(function (r) {
    sumPct += overallOf(r).pct;
  });
  var avg = total ? Math.round(sumPct / total) : 0;
  $("#stats").innerHTML = [
    ["" + total, "Onboarded learners"],
    [started + " / " + total, "Have started"],
    ["" + certified, "Earned ≥1 cert"],
    [avg + "%", "Avg overall progress"],
  ]
    .map(function (s) {
      return (
        '<div class="stat"><div class="stat-num">' +
        s[0] +
        '</div><div class="stat-label">' +
        s[1] +
        "</div></div>"
      );
    })
    .join("");
}

function renderHead() {
  var arrow = function (key) {
    return sortKey === key
      ? '<span class="arrow">' + (sortDir === 1 ? "▲" : "▼") + "</span>"
      : "";
  };
  var th =
    '<th data-sort="name" class="learner">Learner ' + arrow("name") + "</th>";
  TRACKS.forEach(function (t) {
    th +=
      '<th class="track-col" data-sort="track:' +
      t.id +
      '" title="' +
      esc(t.title) +
      '">' +
      t.emoji +
      "</th>";
  });
  th += '<th data-sort="overall">Overall ' + arrow("overall") + "</th>";
  th += '<th data-sort="certs">Certs ' + arrow("certs") + "</th>";
  th += '<th data-sort="updated">Last active ' + arrow("updated") + "</th>";
  $("#grid thead").innerHTML = "<tr>" + th + "</tr>";
  $("#grid thead")
    .querySelectorAll("th")
    .forEach(function (el) {
      el.onclick = function () {
        var k = el.getAttribute("data-sort");
        if (sortKey === k) sortDir = -sortDir;
        else {
          sortKey = k;
          sortDir = k === "name" ? 1 : -1;
        }
        render();
      };
    });
}

function sortValue(row, key) {
  if (key === "name") return (row.name || row.email).toLowerCase();
  if (key === "overall") return overallOf(row).pct;
  if (key === "certs") return certCountOf(row);
  if (key === "updated")
    return row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  if (key.indexOf("track:") === 0) {
    var t = TRACKS.filter(function (x) {
      return x.id === key.slice(6);
    })[0];
    return t ? trackDone(row, t) : 0;
  }
  return 0;
}

function render() {
  renderStats();
  renderHead();
  var q = ($("#search").value || "").trim().toLowerCase();
  var rows = ROSTER.filter(function (r) {
    if (!q) return true;
    return (
      r.email.indexOf(q) !== -1 ||
      (r.name || "").toLowerCase().indexOf(q) !== -1
    );
  });
  rows.sort(function (a, b) {
    var va = sortValue(a, sortKey),
      vb = sortValue(b, sortKey);
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return a.email < b.email ? -1 : 1;
  });

  var html = rows
    .map(function (r) {
      var started = hasAnyProgress(r);
      var nameCell =
        '<td class="learner"><div class="nm">' +
        esc(r.name || r.email) +
        (r.seed ? '<span class="seed-tag">seed</span>' : "") +
        '</div><div class="em">' +
        esc(r.email) +
        "</div></td>";
      var trackCells = TRACKS.map(function (t) {
        var done = trackDone(r, t);
        var pct = t.total ? Math.round((done / t.total) * 100) : 0;
        var cert = r.certs && r.certs[t.id];
        return (
          '<td class="track-cell">' +
          '<span class="cellbar"><span style="width:' +
          pct +
          '%"></span></span>' +
          '<span class="cellnum' +
          (cert ? " cert" : "") +
          '">' +
          (cert ? "🎖️ " : "") +
          done +
          "/" +
          t.total +
          "</span></td>"
        );
      }).join("");
      var ov = overallOf(r);
      var overallCell =
        '<td class="overall"><span class="pillbar"><span style="width:' +
        ov.pct +
        '%"></span></span>' +
        ov.pct +
        "%</td>";
      var nc = certCountOf(r);
      var certsCell =
        '<td><span class="certs-badge' +
        (nc ? "" : " zero") +
        '">' +
        nc +
        "</span></td>";
      var updCell =
        "<td" +
        (started ? "" : ' class="nodata"') +
        ">" +
        (started ? fmtDate(r.updatedAt) : "no data yet") +
        "</td>";
      return (
        "<tr>" +
        nameCell +
        trackCells +
        overallCell +
        certsCell +
        updCell +
        "</tr>"
      );
    })
    .join("");

  $("#grid tbody").innerHTML =
    html ||
    '<tr><td colspan="' +
      (TRACKS.length + 4) +
      '" class="nodata">No learners.</td></tr>';
  $("#updated").textContent = "Loaded " + new Date().toLocaleString();
  $("#foot").innerHTML =
    "Roster = everyone in <code>data/users.json</code> plus anyone whose browser has synced progress at least once. " +
    "People who signed up in-app (accounts that live only in their own browser) appear here the first time they open the site after sync shipped. " +
    "Earned certificates never disappear; a track % can drop only because new lessons were added to that track.";
}

/* ---- boot ---- */
$("#search").addEventListener("input", render);
$("#refresh").addEventListener("click", load);
load();
