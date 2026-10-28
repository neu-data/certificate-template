/**
 * Eligibility from the course registration list (Foundations of Clinical Research — Level 1).
 *
 * A certificate is issued only to someone who
 *   1. is on the registration list (the email they registered with),
 *   2. followed the course: 6 or more sessions attended, and the proposal, Results draft,
 *      review and revision all submitted (columns in the same list), and
 *   3. asks on or after REG.opensOn, after the final feedback.
 * The course evaluation survey (Survey.gs) comes first, as in the other course.
 *
 * The list: upload the registration Excel file to the "Neudata Certificates" folder with a name
 * starting "FCR Level 1 · Registration list", then run importRegistrationList(). Or edit the
 * Google Sheet "FCR Level 1 · Registration list" directly. Columns (first row, any order, other
 * columns are ignored): Email | Full name | Sessions attended | Proposal | Results draft | Review | Revision
 * Submissions count when the cell says yes, có, x, ✓ or 1.
 */
const REG = {
  sheetName: 'FCR Level 1 · Registration list',
  opensOn: '2027-01-11',                      // yyyy-mm-dd, Vietnam time: after the final feedback
  minSessions: 6,
  headers: ['Email', 'Full name', 'Sessions attended', 'Proposal', 'Results draft', 'Review', 'Revision'],
  required: ['Proposal', 'Results draft', 'Review', 'Revision'],
};
const YES_ = /^(yes|y|có|co|x|✓|✔|true|1|done|submitted|đã nộp)$/i;

// 'OK' | 'NOT_OPEN' | 'NOT_REGISTERED' | 'NOT_ELIGIBLE' for a normalised email.
function eligibility_(key) {
  const me = normalizeEmail_(Session.getEffectiveUser().getEmail());   // the owner can test any time
  if (key !== me && new Date() < new Date(REG.opensOn + 'T00:00:00+07:00')) return 'NOT_OPEN';
  const row = registrationRows_()[key];
  if (!row) return 'NOT_REGISTERED';
  return row.eligible ? 'OK' : 'NOT_ELIGIBLE';
}

// Emails that may receive a certificate now (used by the admin test helpers).
function eligibleSet_() {
  const rows = registrationRows_();
  return new Set(Object.keys(rows).filter(function (k) { return rows[k].eligible; }));
}

function registrationRows_() {
  const id = PropertiesService.getScriptProperties().getProperty('REGISTRATION_ID');
  if (!id) throw new Error('Run setup() first');
  const values = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
  const head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const col = function (name) { return head.indexOf(name.toLowerCase()); };
  const iEmail = col('Email');
  if (iEmail < 0) throw new Error('The registration list needs an "Email" column');
  const iSessions = col('Sessions attended');
  const iReq = REG.required.map(col);
  const rows = {};
  values.slice(1).forEach(function (r) {
    const email = String(r[iEmail] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const sessions = iSessions < 0 ? 0 : Number(r[iSessions]) || 0;
    const done = iReq.every(function (i) { return i >= 0 && YES_.test(String(r[i]).trim()); });
    rows[normalizeEmail_(email)] = { eligible: sessions >= REG.minSessions && done };
  });
  return rows;
}

// Called by setup(): an empty list with the expected columns, if there is none yet.
function setupRegistration_(root) {
  const props = PropertiesService.getScriptProperties();
  const old = props.getProperty('REGISTRATION_ID');
  if (old) { try { DriveApp.getFileById(old); return; } catch (e) { /* deleted: make a new one */ } }
  const found = findFile_(root, REG.sheetName);
  if (found) { props.setProperty('REGISTRATION_ID', found.getId()); return; }
  const ss = SpreadsheetApp.create(REG.sheetName);
  ss.getSheets()[0].appendRow(REG.headers).setFrozenRows(1);
  DriveApp.getFileById(ss.getId()).moveTo(root);
  props.setProperty('REGISTRATION_ID', ss.getId());
  Logger.log('Registration list: %s', ss.getUrl());
}

/**
 * Replace the registration list with the newest Excel file in the "Neudata Certificates" folder
 * whose name starts with "FCR Level 1 · Registration list". Run it after each update of the Excel file.
 */
function importRegistrationList() {
  const props = PropertiesService.getScriptProperties();
  const root = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  let newest = null;
  const files = root.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed() || f.getName().indexOf(REG.sheetName) !== 0 || !/\.xlsx?$/i.test(f.getName())) continue;
    if (!newest || f.getLastUpdated() > newest.getLastUpdated()) newest = f;
  }
  if (!newest) throw new Error('Upload the Excel file as "' + REG.sheetName + '.xlsx" into ' + CONFIG.rootFolderName);

  const boundary = 'neudata' + Date.now();
  const meta = JSON.stringify({ name: REG.sheetName, mimeType: MimeType.GOOGLE_SHEETS, parents: [root.getId()] });
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
               '\r\n--' + boundary + '\r\nContent-Type: ' + newest.getMimeType() + '\r\n\r\n';
  const payload = Utilities.newBlob(head).getBytes().concat(newest.getBlob().getBytes())
    .concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Import failed: ' + res.getContentText());
  const id = JSON.parse(res.getContentText()).id;

  const old = props.getProperty('REGISTRATION_ID');
  if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { /* already gone */ } }
  props.setProperty('REGISTRATION_ID', id);
  const rows = registrationRows_();
  const n = Object.keys(rows).length;
  const ok = Object.keys(rows).filter(function (k) { return rows[k].eligible; }).length;
  Logger.log('Imported %s: %s registered, %s eligible for a certificate.', newest.getName(), n, ok);
}

// Admin helper: add your own address to the registration list as a completed participant (for testing).
function addMeToEligibleList() {
  const me = Session.getEffectiveUser().getEmail();
  if (registrationRows_()[normalizeEmail_(me)]) { Logger.log('Already on the list: %s', me); return; }
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('REGISTRATION_ID')).getSheets()[0];
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const row = head.map(function (h) {
    if (h === 'email') return me;
    if (h === 'full name') return 'Test Participant';
    if (h === 'sessions attended') return 8;
    return REG.required.some(function (r) { return r.toLowerCase() === h; }) ? 'yes' : '';
  });
  sheet.appendRow(row);
  Logger.log('Added %s to the registration list. Remove the row after testing.', me);
}
