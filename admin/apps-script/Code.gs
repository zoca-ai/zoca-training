/* ============================================================
   Zoca Sales Academy — progress collector (Google Apps Script)
   ------------------------------------------------------------
   This is the ONE small off-Pages endpoint. GitHub Pages is
   read-only static hosting and cannot receive writes, so each
   learner's browser POSTs their progress here, and this script
   MERGES it into one row per email in the bound Google Sheet.
   The public overview page (admin/index.html in the GitHub repo)
   reads the data back via JSONP (doGet with ?callback=).

   NO DATA LOSS GUARANTEE: writes MERGE and never shrink —
   completed lessons are unioned, each quiz score keeps the max,
   and certs are never removed. This matches the app's semantics
   (progress is monotonic) so a stale, partial, or different-device
   sync can never erase a learner's recorded progress.
   ============================================================ */

var SHEET_NAME = "progress";
var HEADERS = ["email", "name", "updatedAt", "completed", "scores", "certs"];

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  }
  return sh;
}

/* Learner's browser POSTs {email,name,completed,scores,certs}. We MERGE
   into any existing row (never overwrite-shrink). Response not read by client. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = JSON.parse(e.postData.contents);
    var email = String(data.email || "")
      .toLowerCase()
      .trim();
    if (!email) return _json({ ok: false, error: "missing email" });

    var sh = _sheet();
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    var existing = null;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).toLowerCase() === email) {
        rowIdx = i + 1;
        existing = values[i];
        break;
      }
    }

    var exCompleted = existing ? _parse(existing[3]) : {};
    var exScores = existing ? _parse(existing[4]) : {};
    var exCerts = existing ? _parse(existing[5]) : {};

    var completed = _mergeCompleted(exCompleted, data.completed || {});
    var scores = _mergeScores(exScores, data.scores || {});
    var certs = _mergeCerts(exCerts, data.certs || {});
    var name = String(data.name || "") || (existing ? existing[1] : "");

    var row = [
      email,
      name,
      new Date().toISOString(),
      JSON.stringify(completed),
      JSON.stringify(scores),
      JSON.stringify(certs),
    ];
    if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

/* Merge helpers — monotonic, never shrink. */
function _mergeCompleted(a, b) {
  var o = {};
  for (var k in a) if (a[k]) o[k] = true;
  for (var k2 in b) if (b[k2]) o[k2] = true;
  return o;
}
function _mergeScores(a, b) {
  var o = {};
  for (var k in a) o[k] = a[k];
  for (var k2 in b) {
    var v = b[k2];
    o[k2] = o[k2] == null ? v : Math.max(o[k2], v);
  }
  return o;
}
function _mergeCerts(a, b) {
  var o = {};
  for (var k in a) o[k] = a[k]; // keep the original cert (earned date) if present
  for (var k2 in b) if (o[k2] == null) o[k2] = b[k2];
  return o;
}

/* Overview page reads all rows. JSONP when ?callback= is supplied
   (avoids cross-origin restrictions from GitHub Pages). */
function doGet(e) {
  var cb = e && e.parameter && e.parameter.callback;
  var sh = _sheet();
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    out.push({
      email: r[0],
      name: r[1],
      updatedAt: r[2],
      completed: _parse(r[3]),
      scores: _parse(r[4]),
      certs: _parse(r[5]),
    });
  }
  var payload = JSON.stringify({ ok: true, learners: out });
  if (cb) {
    return ContentService.createTextOutput(
      cb + "(" + payload + ")"
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload).setMimeType(
    ContentService.MimeType.JSON
  );
}

function _parse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch (e) {
    return {};
  }
}
function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON
  );
}
