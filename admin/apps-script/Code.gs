/* ============================================================
   Zoca Sales Academy — progress collector (Google Apps Script)
   ------------------------------------------------------------
   This is the ONE small off-Pages endpoint. GitHub Pages is
   read-only static hosting and cannot receive writes, so each
   learner's browser POSTs their progress here, and this script
   upserts one row per email into the bound Google Sheet. The
   public overview page (admin/index.html in the GitHub repo)
   reads the data back via JSONP (doGet with ?callback=).

   DEPLOY (in the user's own Google account):
     1. sheets.new  → name it e.g. "Zoca Academy Progress".
     2. Extensions → Apps Script. Delete the stub, paste THIS file.
     3. Deploy → New deployment → type "Web app".
        - Execute as: Me
        - Who has access: Anyone
     4. Authorize when prompted. Copy the /exec Web app URL.
     5. Put that URL into assets/app.js  -> SYNC_URL
        and into admin/admin.js          -> SCRIPT_URL
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

/* Learner's browser POSTs {email,name,completed,scores,certs} (text/plain,
   no-cors) — we upsert by email. Response is not read by the client. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var email = String(data.email || "")
      .toLowerCase()
      .trim();
    if (!email) return _json({ ok: false, error: "missing email" });

    var sh = _sheet();
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).toLowerCase() === email) {
        rowIdx = i + 1;
        break;
      }
    }
    var row = [
      email,
      String(data.name || ""),
      new Date().toISOString(),
      JSON.stringify(data.completed || {}),
      JSON.stringify(data.scores || {}),
      JSON.stringify(data.certs || {}),
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
