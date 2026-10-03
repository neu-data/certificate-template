/**
 * Neudata certificate portal — Google Apps Script web app.
 *
 * Participants enter their email and official name. If the email is on the
 * eligible list (a .txt file per person in Drive), a certificate with a unique
 * ID and a QR verification code is created, saved to Drive and emailed to them.
 *
 * Deploy as: Execute as "Me" (the Neudata Gmail account), access "Anyone".
 * First run setup() once from the editor. See README.md.
 */

// ===== Settings ======================================================================
const CONFIG = {
  rootFolderName: 'Neudata Certificates',
  eligibleFolderName: 'Eligible participants',       // add <gmail-name>.txt per eligible person
  issuedFolderName: 'Issued certificates',           // a copy of every certificate is saved here
  registerName: 'Certificate register',              // Google Sheet: one row per certificate
  templateName: 'Certificate template (do not delete)',
  // A4 landscape PowerPoint holding the background (make_background.py). It is converted to
  // Google Slides, because Slides cannot create an A4 page itself (new decks are 16:9).
  templatePptxName: 'certificate-template.pptx',
  templatePptxUrl: 'https://raw.githubusercontent.com/neu-data/certificate-template/main/portal/certificate-template.pptx',

  idPrefix: 'NDC-TR-2026-1',                          // -> NDC-TR-2026-1-10XX-001
  // Used in emails and on the verification page. The printed certificate text lives in the
  // background image (portal/make_background.py) — keep the two in step.
  course: 'Clinical Data Analysis in R — Phase I',
  details: '5 online sessions · 7.5 contact hours · 8 September – 6 October 2026 · Online',
  issued: '06-10-2026',                               // date printed on every certificate
  defaultDomain: 'gmail.com',                         // "b.osangir.txt" means b.osangir@gmail.com
  // signature: name of a PNG (transparent background) in the "Neudata Certificates" Drive folder.
  // Signatures are kept only in Drive, never in the public repository. If the file is missing,
  // the certificate is issued without that signature.
  signatories: [
    { name: 'My Luong Vuong', title: 'Lead Trainer, Senior Biostatistician', signature: 'signature-my-luong.png' },
    { name: "Bernard Isekah Osang'ir", title: 'Trainer, Senior Biostatistician', signature: 'signature-bernard.png' },
  ],

  senderName: 'Neudata Consulting Ltd',
  replyTo: 'contact@neu-data.com',
  sendAs: 'contact@neu-data.com',                     // used only if added as a Gmail "Send mail as" alias
  resendCooldownMinutes: 1,                           // stops double clicks sending two emails
};

// The background (portal/certificate-background.png) already carries the artwork, logo and
// all fixed text, drawn to match the approved design. Only these three items are added per
// participant. Positions are in points on an 842 x 595 pt page — values from
// portal/layout.json (written by make_background.py). Slides text boxes have ~7 pt inner
// padding, hence the small offsets.
const PAGE = { w: 841.89, h: 595.28 };
const LAYOUT = {
  name:   { x: 193.3, y: 266, w: 505, h: 66, font: 'DM Serif Display', size: 40, color: '#04242F' },
  idline: { x: 290, y: 532, w: 433, h: 20, font: 'Montserrat', size: 8.5, color: '#808C96', center: true },
  qr:     { x: 712.1, y: 268.6, size: 62.1 },
  // signature images: centred on each signature line (at y 483.6), resting on it
  signatures: [{ cx: 303.6, bottom: 486, maxw: 150, maxh: 44 }, { cx: 698.6, bottom: 490, maxw: 150, maxh: 62 }],
};

// ===== Web app entry point ==============================================================
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.verify) {
    const t = HtmlService.createTemplateFromFile('Verify');
    t.result = verifyCertificate_(String(params.verify));
    return t.evaluate().setTitle('Verify certificate · Neudata')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const t = HtmlService.createTemplateFromFile('Portal');
  t.lang = params.lang === 'vi' || params.lang === 'en' ? params.lang : '';   // ?lang=vi from the course site
  return t.evaluate()
    .setTitle('Certificate · Clinical Data Analysis in R · Neudata')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // allow the portal to be embedded in the course website's Certificate page
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== One-time setup (run from the editor) ===============================================
function setup() {
  const props = PropertiesService.getScriptProperties();
  const root = folder_(DriveApp.getRootFolder(), CONFIG.rootFolderName);
  const eligible = folder_(root, CONFIG.eligibleFolderName);
  const issued = folder_(root, CONFIG.issuedFolderName);
  const work = folder_(root, '_working (temporary)');

  let register = findFile_(root, CONFIG.registerName);
  if (!register) {
    const ss = SpreadsheetApp.create(CONFIG.registerName);
    ss.getSheets()[0].setName('Register')
      .appendRow(['Certificate ID', 'Email (matched)', 'Email entered', 'Name on certificate',
                  'Issued at', 'Last sent', 'PDF', 'Status'])
      .setFrozenRows(1);
    register = DriveApp.getFileById(ss.getId());
    register.moveTo(root);
  }

  props.setProperties({
    ROOT_ID: root.getId(), ELIGIBLE_ID: eligible.getId(), ISSUED_ID: issued.getId(),
    WORK_ID: work.getId(), REGISTER_ID: register.getId(),
  });
  props.setProperty('TEMPLATE_ID', createTemplate_(root).getId());
  Logger.log('Setup complete. Folder: %s', root.getUrl());
  Logger.log('Now deploy: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
}

function createTemplate_(root) {
  const old = findFile_(root, CONFIG.templateName);
  if (old) old.setTrashed(true);

  const id = convertToSlides_(templatePptx_(root), CONFIG.templateName, root);
  const deck = SlidesApp.openById(id);
  if (Math.abs(deck.getPageWidth() - PAGE.w) > 2 || Math.abs(deck.getPageHeight() - PAGE.h) > 2) {
    throw new Error('Template page is ' + deck.getPageWidth() + ' x ' + deck.getPageHeight() +
                    ' pt, expected A4 landscape');
  }
  const slide = deck.getSlides()[0];
  // Only the per-participant items; everything else is part of the background image.
  box_(slide, LAYOUT.name, '{{NAME}}');
  box_(slide, LAYOUT.idline, 'Certificate ID: {{ID}}  ·  Verify at contact@neu-data.com');
  deck.saveAndClose();
  return DriveApp.getFileById(id);
}

function templatePptx_(root) {
  const local = findFile_(root, CONFIG.templatePptxName);
  if (local) return local.getBlob();
  const res = UrlFetchApp.fetch(CONFIG.templatePptxUrl, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Template not found. Upload ' + CONFIG.templatePptxName +
                    ' into the "' + CONFIG.rootFolderName + '" folder and run setup() again.');
  }
  return res.getBlob().setName(CONFIG.templatePptxName);
}

// Upload a .pptx to Drive as a Google Slides file (Drive API v3 multipart upload with conversion).
function convertToSlides_(blob, name, folder) {
  const boundary = 'neudata' + Date.now();
  const meta = JSON.stringify({ name: name, mimeType: MimeType.GOOGLE_SLIDES, parents: [folder.getId()] });
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
               '\r\n--' + boundary + '\r\nContent-Type: ' +
               'application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n';
  const payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes())
    .concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Template conversion failed: ' + res.getContentText());
  return JSON.parse(res.getContentText()).id;
}

function box_(slide, L, text) {
  const shape = slide.insertTextBox(text, L.x, L.y, L.w, L.h);
  const range = shape.getText();
  range.getTextStyle().setFontFamily(L.font).setFontSize(L.size)
    .setForegroundColor(L.color).setBold(!!L.bold).setItalic(!!L.italic);
  range.getParagraphStyle().setParagraphAlignment(
    L.center ? SlidesApp.ParagraphAlignment.CENTER : SlidesApp.ParagraphAlignment.START);
  shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  return shape;
}

// ===== Called from the portal page =========================================================
/**
 * Step 1 — check the email is on the list, then email a 6-digit login code.
 * The code proves the person owns the address, so nobody can claim someone else's certificate.
 */
function requestCode(email, lang) {
  email = String(email || '').trim();
  lang = lang === 'vi' ? 'vi' : 'en';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, code: 'BAD_EMAIL' };
  const key = normalizeEmail_(email);
  if (!eligibleSet_().has(key)) return { ok: false, code: 'NOT_ELIGIBLE' };

  const cache = CacheService.getScriptCache();
  if (cache.get('throttle:' + key)) return { ok: true, code: 'CODE_ALREADY_SENT' };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('code:' + key, code, 15 * 60);           // valid for 15 minutes
  cache.put('throttle:' + key, '1', 60);              // at most one code per minute
  const subject = lang === 'vi' ? 'Mã đăng nhập chứng nhận Neudata: ' + code
                                : 'Your Neudata certificate login code: ' + code;
  const line = lang === 'vi' ? 'Mã đăng nhập của bạn là' : 'Your login code is';
  const note = lang === 'vi' ? 'Mã có hiệu lực trong 15 phút.' : 'The code is valid for 15 minutes.';
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1F2D33">' +
    '<p>' + line + ':</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#055F56">' +
    code + '</p><p>' + note + '</p><p style="color:#8A99A3">Neudata Consulting Ltd · www.neu-data.com</p></div>';
  const options = { htmlBody: html, name: CONFIG.senderName, replyTo: CONFIG.replyTo };
  if (GmailApp.getAliases().indexOf(CONFIG.sendAs) >= 0) options.from = CONFIG.sendAs;
  GmailApp.sendEmail(email, subject, line + ': ' + code + '\n' + note, options);
  return { ok: true, code: 'CODE_SENT' };
}

/**
 * Step 2 — with a valid code, create (or re-send) the certificate.
 * @param {string} email     as typed by the participant
 * @param {string} name      official name, exactly as it should appear
 * @param {string} loginCode the 6-digit code from step 1
 * @param {string} lang      'en' | 'vi' (email language)
 * @return {{ok:boolean, code:string, id?:string, email?:string}}
 */
function generateCertificate(email, name, loginCode, lang) {
  email = String(email || '').trim();
  name = String(name || '').replace(/\s+/g, ' ').trim();
  lang = lang === 'vi' ? 'vi' : 'en';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, code: 'BAD_EMAIL' };
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]{1,79}$/u.test(name) || name.split(' ').length < 2) {
    return { ok: false, code: 'BAD_NAME' };
  }
  const key = normalizeEmail_(email);
  if (!eligibleSet_().has(key)) return { ok: false, code: 'NOT_ELIGIBLE' };
  const cache = CacheService.getScriptCache();
  const expected = cache.get('code:' + key);
  if (!expected || String(loginCode || '').trim() !== expected) return { ok: false, code: 'BAD_CODE' };
  cache.remove('code:' + key);

  const sheet = registerSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  let row, id, existing = false;
  try {
    const data = sheet.getDataRange().getValues();
    const idx = data.findIndex(function (r, i) { return i > 0 && r[1] === key && r[7] !== 'void'; });
    if (idx > 0) {
      existing = true;
      row = idx + 1;
      id = data[idx][0];
      const lastSent = data[idx][5];
      if (lastSent && (Date.now() - new Date(lastSent).getTime()) < CONFIG.resendCooldownMinutes * 60000) {
        return { ok: true, code: 'RECENTLY_SENT', id: id, email: data[idx][2] };
      }
      // Regenerating keeps the same certificate ID; the name entered now replaces the old one.
      sheet.getRange(row, 4).setValue(name);
    } else {
      id = newId_(data);
      sheet.appendRow([id, key, email, name, new Date(), '', '', 'reserved']);
      row = sheet.getLastRow();
    }
  } finally {
    lock.releaseLock();
  }

  const record = sheet.getRange(row, 1, 1, 8).getValues()[0];
  const sendTo = existing ? record[2] : email;          // always the address on record
  // Always build a fresh PDF, so a regenerated certificate has the current design and
  // signatures. The previous PDF is moved to the Drive bin (recoverable for 30 days).
  const file = buildPdf_(id, record[3]);
  if (existing && record[6]) {
    try { DriveApp.getFileById(fileIdFromUrl_(record[6])).setTrashed(true); } catch (e) {}
  }
  sheet.getRange(row, 7).setValue(file.getUrl());

  sendEmail_(sendTo, record[3], id, file.getBlob(), lang);
  sheet.getRange(row, 6).setValue(new Date());
  sheet.getRange(row, 8).setValue('sent');
  return { ok: true, code: existing ? 'REGENERATED' : 'SENT', id: id, email: sendTo };
}

// ===== Certificate IDs ==========================================================================
// NDC-TR-2026-1-10XX-NNN : XX = random two digits, NNN = running number.
// The running number alone makes every ID unique; the register is also checked.
function newId_(data) {
  const used = new Set(data.slice(1).map(function (r) { return r[0]; }));
  const seq = String(data.length).padStart(3, '0');  // header row => first certificate is 001; grows past 999
  for (let attempt = 0; attempt < 100; attempt++) {
    const xx = ('0' + Math.floor(Math.random() * 100)).slice(-2);
    const id = CONFIG.idPrefix + '-10' + xx + '-' + seq;
    if (!used.has(id)) return id;
  }
  throw new Error('Could not create a unique certificate ID');
}

// ===== Eligibility ===============================================================================
// Each file in "Eligible participants" names one person:
//   b.osangir.txt              -> b.osangir@gmail.com   (no @ means @gmail.com)
//   jane.doe@hospital.org.txt  -> jane.doe@hospital.org
function eligibleSet_() {
  const props = PropertiesService.getScriptProperties();
  const files = DriveApp.getFolderById(props.getProperty('ELIGIBLE_ID')).getFiles();
  const set = new Set();
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed()) continue;
    let base = f.getName().replace(/\.txt$/i, '').trim();
    if (!base) continue;
    if (base.indexOf('@') < 0) base += '@' + CONFIG.defaultDomain;
    set.add(normalizeEmail_(base));
  }
  return set;
}

// Gmail ignores dots and anything after "+" in the name part; other providers do not.
function normalizeEmail_(email) {
  let [local, domain] = String(email).trim().toLowerCase().split('@');
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return local + '@' + domain;
}

// ===== PDF ========================================================================================
function buildPdf_(id, name) {
  const props = PropertiesService.getScriptProperties();
  const work = DriveApp.getFolderById(props.getProperty('WORK_ID'));
  const issued = DriveApp.getFolderById(props.getProperty('ISSUED_ID'));
  const copy = DriveApp.getFileById(props.getProperty('TEMPLATE_ID')).makeCopy(id, work);
  try {
    const deck = SlidesApp.openById(copy.getId());
    const slide = deck.getSlides()[0];
    slide.getShapes().forEach(function (shape) {
      const t = shape.getText().asString();
      if (t.indexOf('{{NAME}}') >= 0) {
        shape.getText().setText(name);
        shape.getText().getTextStyle().setFontFamily(LAYOUT.name.font)
          .setFontSize(nameSize_(name)).setForegroundColor(LAYOUT.name.color);
      }
    });
    slide.getShapes().forEach(function (shape) {
      const text = shape.getText();
      if (text.asString().indexOf('{{ID}}') >= 0) {
        text.replaceAllText('{{ID}}', id);
        text.find(id.replace(/[-]/g, '\\-')).forEach(function (r) {   // ID in bold navy, as in the design
          r.getTextStyle().setBold(true).setForegroundColor('#04242F');
        });
      }
    });
    const qr = slide.insertImage(qrBlob_(verifyUrl_(id)));
    qr.setLeft(LAYOUT.qr.x).setTop(LAYOUT.qr.y).setWidth(LAYOUT.qr.size).setHeight(LAYOUT.qr.size);
    addSignatures_(slide);
    deck.saveAndClose();
    const pdf = copy.getAs('application/pdf').setName(id + '_' + slug_(name) + '.pdf');
    return issued.createFile(pdf);
  } finally {
    copy.setTrashed(true);
  }
}

// Long names shrink so they stay on one line beside the QR code
function nameSize_(name) {
  const n = name.length, base = LAYOUT.name.size;
  return Math.round(n <= 24 ? base : n <= 30 ? base * 0.85 : n <= 38 ? base * 0.7 : base * 0.58);
}

// Each trainer's signature (a PNG in the Drive folder), scaled to fit above their signature line.
function addSignatures_(slide) {
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ROOT_ID'));
  CONFIG.signatories.forEach(function (s, i) {
    const file = s.signature && findFile_(root, s.signature);
    if (!file) return;
    const img = slide.insertImage(file.getBlob());
    const box = LAYOUT.signatures[i];
    const k = Math.min(box.maxw / img.getWidth(), box.maxh / img.getHeight());
    const w = img.getWidth() * k, h = img.getHeight() * k;
    img.setWidth(w).setHeight(h).setLeft(box.cx - w / 2).setTop(box.bottom - h);
  });
}

function qrBlob_(text) {
  const urls = [
    'https://quickchart.io/qr?size=600&margin=1&ecLevel=M&text=' + encodeURIComponent(text),
    'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=4&data=' + encodeURIComponent(text),
  ];
  for (let i = 0; i < urls.length; i++) {
    const res = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) return res.getBlob().setName('qr.png');
  }
  throw new Error('QR code service unavailable');
}

function verifyUrl_(id) {
  return ScriptApp.getService().getUrl() + '?verify=' + encodeURIComponent(id);
}

// ===== Email ======================================================================================
function sendEmail_(to, name, id, pdf, lang) {
  const url = verifyUrl_(id);
  const T = lang === 'vi' ? {
    subject: 'Chứng nhận hoàn thành — ' + CONFIG.course,
    hello: 'Kính gửi ' + name + ',',
    body: 'Chúc mừng bạn đã hoàn thành khóa học <b>' + CONFIG.course + '</b>. ' +
          'Chứng nhận của bạn được đính kèm trong email này (PDF).',
    id: 'Mã chứng nhận', verify: 'Xác minh chứng nhận', thanks: 'Trân trọng,',
  } : {
    subject: 'Your certificate of completion — ' + CONFIG.course,
    hello: 'Dear ' + name + ',',
    body: 'Congratulations on completing <b>' + CONFIG.course + '</b>. ' +
          'Your certificate is attached to this email as a PDF.',
    id: 'Certificate ID', verify: 'Verify this certificate', thanks: 'With best wishes,',
  };
  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1F2D33;max-width:560px">' +
    '<div style="background:#04242F;border-bottom:4px solid #055F56;padding:14px 18px;color:#fff;font-weight:700">' +
    'Neudata Consulting Ltd</div><div style="padding:18px">' +
    '<p>' + esc_(T.hello) + '</p><p>' + T.body + '</p>' +
    '<p><b>' + T.id + ':</b> ' + esc_(id) + '<br><a href="' + url + '">' + T.verify + '</a></p>' +
    '<p>' + T.thanks + '<br>' + esc_(CONFIG.signatories[0].name) + ' &amp; ' +
    esc_(CONFIG.signatories[1].name) + '<br>Neudata Consulting Ltd · ' +
    '<a href="https://www.neu-data.com">www.neu-data.com</a></p>' +
    '<p style="color:#8A99A3;font-style:italic">Insight. Impact. Innovation.</p></div></div>';
  const options = { htmlBody: html, attachments: [pdf], name: CONFIG.senderName, replyTo: CONFIG.replyTo };
  if (GmailApp.getAliases().indexOf(CONFIG.sendAs) >= 0) options.from = CONFIG.sendAs;
  GmailApp.sendEmail(to, T.subject, html.replace(/<[^>]+>/g, ' '), options);
}

// ===== Verification ==================================================================================
function verifyCertificate_(id) {
  id = id.trim().toUpperCase();
  const data = registerSheet_().getDataRange().getValues();
  const r = data.find(function (row, i) { return i > 0 && String(row[0]).toUpperCase() === id; });
  if (!r || r[7] !== 'sent') return { valid: false, id: id };
  return { valid: true, id: r[0], name: r[3], course: CONFIG.course, issued: CONFIG.issued };
}

// ===== Helpers ========================================================================================
function registerSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('REGISTER_ID');
  return SpreadsheetApp.openById(id).getSheets()[0];
}

function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function findFile_(parent, name) {
  const it = parent.getFilesByName(name);
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed()) return f;
  }
  return null;
}

function fileIdFromUrl_(url) {
  const m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : url;
}

function slug_(name) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== Admin helper: test the whole flow on your own email from the editor ======================
// (Put "<your gmail name>.txt" in Eligible participants first.)
function testIssueToMe() {
  const me = Session.getEffectiveUser().getEmail();
  const key = normalizeEmail_(me);
  if (!eligibleSet_().has(key)) throw new Error('Add ' + me.split('@')[0] + '.txt to Eligible participants first');
  CacheService.getScriptCache().put('code:' + key, '123456', 300);
  Logger.log(JSON.stringify(generateCertificate(me, 'Test Participant', '123456', 'en')));
}

// Admin helper: build a sample certificate (no email, not in the register) as
// "Certificate preview.pdf" in the Neudata Certificates folder, to check the design.
function previewCertificate() {
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ROOT_ID'));
  const old = findFile_(root, 'Certificate preview.pdf');
  if (old) old.setTrashed(true);
  const pdf = buildPdf_(CONFIG.idPrefix + '-1047-001', "Bernard Isekah Osang'ir");
  pdf.setName('Certificate preview.pdf').moveTo(root);
  Logger.log('Preview: %s', pdf.getUrl());
}

// Admin helper: withdraw your own certificate(s) so you can generate a fresh one (e.g. after a
// design change). The register row is kept and marked "void"; the old PDF stays in Drive.
function voidMyCertificate() {
  const key = normalizeEmail_(Session.getEffectiveUser().getEmail());
  const sheet = registerSheet_();
  const data = sheet.getDataRange().getValues();
  data.forEach(function (r, i) {
    if (i > 0 && r[1] === key && r[7] !== 'void') {
      sheet.getRange(i + 1, 8).setValue('void');
      Logger.log('Voided %s', r[0]);
    }
  });
}

// Admin helper: put your own address on the eligible list (creates "<gmail name>.txt").
function addMeToEligibleList() {
  const me = Session.getEffectiveUser().getEmail();
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ELIGIBLE_ID'));
  const name = (me.endsWith('@' + CONFIG.defaultDomain) ? me.split('@')[0] : me) + '.txt';
  if (!folder.getFilesByName(name).hasNext()) folder.createFile(name, '');
  Logger.log('Eligible: %s', name);
}
