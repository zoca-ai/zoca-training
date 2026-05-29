#!/usr/bin/env node
/* ============================================================
   Zoca Sales Academy — content generator (dev tool, not shipped at runtime)
   Reads markdown lessons (product-docs ae-training + local src/),
   converts callout-aware markdown -> lesson HTML fragments, and
   assembles data/curriculum.json. Quizzes are merged from
   data/quizzes.json (hand-authored), keyed by "<trackId>/<moduleId>"
   and "<trackId>/__final__".
   Run:  node tools/generate.js
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME;
const SITE = path.resolve(__dirname, "..");
const PRODUCT_DOCS = path.join(HOME, "Downloads", "product-docs");
const SRC = path.join(SITE, "tools", "src"); // locally-authored md (foundations, selling)
const CONTENT = path.join(SITE, "content");

/* ---------------- track configuration ---------------- */
// kind: "docs" => product-docs/<dir>/ae-training/NN-*.md
//       "src"  => tools/src/<dir>/NN-*.md (authored here)
const TRACKS = [
  {
    id: "foundations",
    title: "Foundations",
    type: "foundations",
    emoji: "🎓",
    blurb:
      "The concepts behind the products — what local SEO, AEO/GEO, AI voice, reviews, Google profiles and content marketing actually are. Learn these first; every product sits on top of them.",
    kind: "src",
    dir: "foundations",
  },
  {
    id: "discovery",
    title: "Discovery",
    type: "product",
    emoji: "🧭",
    blurb:
      "Zoca's marketing engine: a real SEO website, local rankings, AI-search visibility, an optimised Google profile, and the leads it all drives.",
    kind: "docs",
    dir: "Discovery",
  },
  {
    id: "front-desk",
    title: "Front Desk",
    type: "product",
    emoji: "📞",
    blurb:
      "Zoe, the AI front desk that answers calls and messages, books appointments, and recovers leads who almost booked.",
    kind: "docs",
    dir: "Front-Desk",
  },
  {
    id: "scheduling",
    title: "Scheduling",
    type: "product",
    emoji: "🗓️",
    blurb:
      "The calendar and booking system: lifecycle, no-shows, deposits and payments, checkout/POS, and offers.",
    kind: "docs",
    dir: "Scheduling",
  },
  {
    id: "brain",
    title: "Brain",
    type: "product",
    emoji: "🧠",
    blurb:
      "The shared memory that grounds every product in the business's real, specific facts — so content and the AI front desk sound like this salon, not a generic one.",
    kind: "docs",
    dir: "Brain",
  },
  {
    id: "command-center",
    title: "Command Center",
    type: "product",
    emoji: "🎛️",
    blurb:
      "The single console where an owner runs the business by conversation — read status and make changes across products, with confirmation on writes.",
    kind: "docs",
    dir: "Command-Center",
  },
  {
    id: "onboarding",
    title: "Onboarding",
    type: "product",
    emoji: "🚀",
    blurb:
      "How a new salon goes from sign-up to live: the flow, the trial/contract/card step, and the per-platform journeys.",
    kind: "docs",
    dir: "Onboarding",
  },
  {
    id: "selling-zoca",
    title: "Selling Zoca",
    type: "selling",
    emoji: "💼",
    blurb:
      "How to actually sell the suite: the master objection bank, how the beauty business really works, and how the sales team is organised.",
    kind: "src",
    dir: "selling",
  },
];

/* ============================================================
   Markdown -> HTML (callout-aware, no deps)
   ============================================================ */
const CALLOUT_CLASS = { "TL;DR": "tldr", OBJECTION: "objection" };

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    if (/^https?:\/\//.test(u))
      return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    return `<strong>${t}</strong>`; // internal doc link -> plain emphasis (no broken nav)
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
  return s;
}

function renderParas(text) {
  // split on blank lines -> paragraphs
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`)
    .join("\n");
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let out = [];
  let i = 0;
  let firstH1 = null;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    let line = lines[i];

    // blank
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }

    // hr
    if (/^---+\s*$/.test(line)) {
      flushPara();
      out.push("<hr />");
      i++;
      continue;
    }

    // heading
    let h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const txt = h[2].trim();
      if (level === 1 && firstH1 === null) {
        firstH1 = txt;
        i++;
        continue; // drop the H1 from body; lesson header shows the title separately
      }
      out.push(`<h${level}>${inline(txt)}</h${level}>`);
      i++;
      continue;
    }

    // blockquote callout block
    if (/^>\s?/.test(line)) {
      flushPara();
      const block = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const joined = block.join("\n");
      const m = joined.match(/^\[!([^\]]+)\]\s*([\s\S]*)$/);
      if (m) {
        const title = m[1].trim();
        const cls = CALLOUT_CLASS[title.toUpperCase()] || "";
        const body = renderParas(m[2].trim()) || "";
        out.push(
          `<div class="callout ${cls}"><div class="callout-title">${esc(
            title
          )}</div>${body}</div>`
        );
      } else {
        out.push(`<blockquote>${renderParas(joined)}</blockquote>`);
      }
      continue;
    }

    // table (pipe table with a separator row)
    if (
      /\|/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      /-/.test(lines[i + 1])
    ) {
      flushPara();
      const headerCells = splitRow(line);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      let t = "<table><thead><tr>";
      headerCells.forEach((c) => (t += `<th>${inline(c)}</th>`));
      t += "</tr></thead><tbody>";
      bodyRows.forEach((r) => {
        t += "<tr>";
        r.forEach((c) => (t += `<td>${inline(c)}</td>`));
        t += "</tr>";
      });
      t += "</tbody></table>";
      out.push(t);
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        "<ul>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ul>"
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        "<ol>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ol>"
      );
      continue;
    }

    // default: paragraph text
    para.push(line.trim());
    i++;
  }
  flushPara();
  return { html: out.join("\n"), title: firstH1 };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/* ============================================================
   Build
   ============================================================ */
function wordCount(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
function titleCase(slug) {
  return slug
    .replace(/^\d+-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function listLessonFiles(track) {
  let dir;
  if (track.kind === "docs")
    dir = path.join(PRODUCT_DOCS, track.dir, "ae-training");
  else dir = path.join(SRC, track.dir);
  if (!fs.existsSync(dir)) return { dir, files: [] };
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.md$/.test(f) && f.toLowerCase() !== "index.md")
    .sort();
  return { dir, files };
}

/* Progress-safety guard: every live user's lesson completion and quiz score
   is stored in localStorage under the key "<trackId>/<moduleId>". That id is
   the lesson's filename (minus .md), so renaming/renumbering an existing file
   silently orphans real users' progress. Compare the freshly-built curriculum
   against the last committed one (= what's live on Pages) and hard-fail if any
   previously-published module id disappeared. Intentional removals: re-run with
   ALLOW_MODULE_REMOVAL=1. */
function moduleGidsOf(curriculum) {
  const set = new Set();
  (curriculum.tracks || []).forEach((t) => {
    (t.modules || []).forEach((m) => set.add(`${t.id}/${m.id}`));
  });
  return set;
}

function checkNoOrphanedProgress(newCurriculum) {
  const { execSync } = require("child_process");
  let baseline;
  try {
    const raw = execSync("git show HEAD:data/curriculum.json", {
      cwd: SITE,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    baseline = JSON.parse(raw);
  } catch {
    // No committed baseline yet (first run) or not in git — nothing live to protect.
    return;
  }

  const before = moduleGidsOf(baseline);
  const after = moduleGidsOf(newCurriculum);
  const missing = [...before].filter((g) => !after.has(g));
  if (!missing.length) return;

  if (process.env.ALLOW_MODULE_REMOVAL === "1") {
    console.warn(
      `\n⚠️  ${missing.length} previously-published module id(s) removed (ALLOW_MODULE_REMOVAL=1 set):`
    );
    missing.forEach((g) => console.warn(`     - ${g}`));
    console.warn(
      "   Live users' completion + quiz score for these keys will be orphaned. Proceeding because override is set.\n"
    );
    return;
  }

  console.error(
    "\n✖ PROGRESS SAFETY CHECK FAILED — these module ids were in the last commit but are gone now:"
  );
  missing.forEach((g) => console.error(`     - ${g}`));
  console.error(
    "\n  Each id is the localStorage key live users' progress is stored under. Removing or renaming it\n" +
      "  silently wipes their completion + quiz score for that module (and detaches its quiz).\n\n" +
      "  • Renamed/renumbered a file? Restore the original filename. To reorder, APPEND a new number\n" +
      "    (e.g. 15-new.md) or insert with a letter suffix (e.g. 03b-new.md) — never rename neighbours.\n" +
      "  • Genuinely retiring this lesson? Re-run with ALLOW_MODULE_REMOVAL=1 to override.\n"
  );
  process.exit(1);
}

function main() {
  let quizzes = {};
  const quizPath = path.join(SITE, "data", "quizzes.json");
  if (fs.existsSync(quizPath))
    quizzes = JSON.parse(fs.readFileSync(quizPath, "utf8"));

  const curriculum = { generatedAt: new Date().toISOString(), tracks: [] };
  let totalLessons = 0;

  for (const track of TRACKS) {
    const { dir, files } = listLessonFiles(track);
    if (!files.length) {
      console.warn(`! ${track.id}: no lesson files in ${dir} — skipping`);
      continue;
    }
    const outDir = path.join(CONTENT, track.id);
    fs.mkdirSync(outDir, { recursive: true });

    const modules = [];
    for (const file of files) {
      const md = fs.readFileSync(path.join(dir, file), "utf8");
      const { html, title } = mdToHtml(md);
      const mid = file.replace(/\.md$/, "");
      const outFile = path.join(outDir, mid + ".html");
      fs.writeFileSync(outFile, html);
      const mins = Math.max(2, Math.round(wordCount(html) / 200));
      const gid = `${track.id}/${mid}`;
      const mod = {
        id: mid,
        title: title || titleCase(mid),
        sub: "",
        minutes: mins,
        file: `content/${track.id}/${mid}.html`,
      };
      if (quizzes[gid]) mod.quiz = quizzes[gid];
      modules.push(mod);
      totalLessons++;
    }

    const t = {
      id: track.id,
      title: track.title,
      type: track.type,
      emoji: track.emoji,
      blurb: track.blurb,
      modules,
    };
    const finalKey = `${track.id}/__final__`;
    if (quizzes[finalKey]) t.final = quizzes[finalKey];
    curriculum.tracks.push(t);
    console.log(
      `✓ ${track.id}: ${modules.length} modules${t.final ? " + final" : ""}`
    );
  }

  checkNoOrphanedProgress(curriculum);

  fs.writeFileSync(
    path.join(SITE, "data", "curriculum.json"),
    JSON.stringify(curriculum, null, 2)
  );
  console.log(
    `\nWrote data/curriculum.json — ${curriculum.tracks.length} tracks, ${totalLessons} lessons.`
  );
}

main();
