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
  backgroundFileName: 'certificate-background.png',
  backgroundUrl: 'https://raw.githubusercontent.com/neu-data/certificate-template/main/portal/certificate-background.png',

  idPrefix: 'NDC-TR-2026-1',                          // -> NDC-TR-2026-1-10XX-001
  course: 'Clinical Data Analysis in R — Phase I',
  details: '5 online sessions · 7.5 contact hours · 8 September – 6 October 2026 · Online',
  issued: '06-10-2026',                               // date printed on every certificate
  defaultDomain: 'gmail.com',                         // "b.osangir.txt" means b.osangir@gmail.com
  signatories: [
    { name: 'My Luong Vuong', title: 'Lead Trainer, Senior Biostatistician' },
    { name: "Bernard Isekah Osang'ir", title: 'Trainer, Senior Biostatistician' },
  ],

  senderName: 'Neudata Consulting Ltd',
  replyTo: 'contact@neu-data.com',
  sendAs: 'contact@neu-data.com',                     // used only if added as a Gmail "Send mail as" alias
  resendCooldownMinutes: 10,                          // stops repeated clicks from flooding an inbox
};

// Positions in points on an 842 x 595 pt (A4 landscape) page. Mirrors portal/preview.py.
// Slides text boxes have ~7 pt inner padding, hence the small left offsets.
const PAGE = { w: 841.89, h: 595.28 };
const LAYOUT = {
  title:     { x: 191, y: 180, w: 520, h: 34, font: 'Montserrat', size: 25, bold: true,  color: '#055F56' },
  certify:   { x: 193, y: 234, w: 360, h: 22, font: 'Montserrat', size: 13, bold: false, color: '#8A99A3' },
  name:      { x: 190, y: 262, w: 560, h: 62, font: 'Playfair Display', size: 44, bold: false, color: '#04242F' },
  completed: { x: 193, y: 333, w: 360, h: 22, font: 'Montserrat', size: 13, bold: false, color: '#8A99A3' },
  course:    { x: 191, y: 365, w: 560, h: 34, font: 'Montserrat', size: 23, bold: true,  color: '#0B376C' },
  details:   { x: 193, y: 405, w: 560, h: 22, font: 'Montserrat', size: 12, bold: false, color: '#04242F' },
  sign1:     { x: 206, y: 488, w: 196, h: 18, font: 'Montserrat', size: 11, bold: true,  color: '#04242F', center: true },
  sign1t:    { x: 196, y: 505, w: 216, h: 16, font: 'Montserrat', size: 9,  bold: false, color: '#8A99A3', center: true },
  sign2:     { x: 594, y: 488, w: 209, h: 18, font: 'Montserrat', size: 11, bold: true,  color: '#04242F', center: true },
  sign2t:    { x: 584, y: 505, w: 229, h: 16, font: 'Montserrat', size: 9,  bold: false, color: '#8A99A3', center: true },
  issuedL:   { x: 436, y: 482, w: 113, h: 16, font: 'Montserrat', size: 9,  bold: false, color: '#8A99A3', center: true },
  issued:    { x: 436, y: 498, w: 113, h: 20, font: 'Montserrat', size: 12, bold: true,  color: '#04242F', center: true },
  idline:    { x: 206, y: 533, w: 570, h: 16, font: 'Montserrat', size: 8.5, bold: false, color: '#8A99A3', center: true },
  company:   { x: 206, y: 547, w: 570, h: 16, font: 'Montserrat', size: 8.5, bold: false, color: '#8A99A3', center: true },
  tagline:   { x: 206, y: 562, w: 570, h: 20, font: 'Lora', size: 11, bold: false, italic: true, color: '#055F56', center: true },
  qr:        { x: 728, y: 209, size: 66 },
  qrcap:     { x: 714, y: 277, w: 94, h: 14, font: 'Montserrat', size: 7.5, bold: false, color: '#8A99A3', center: true },
};

// ===== Web app entry point ==============================================================
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.verify) {
    const t = HtmlService.createTemplateFromFile('Verify');
    t.result = verifyCertificate_(String(params.verify));
    return t.evaluate().setTitle('Verify certificate · Neudata')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createTemplateFromFile('Portal').evaluate()
    .setTitle('Certificate · Clinical Data Analysis in R · Neudata')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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

  const pres = Slides.Presentations.create({
    title: CONFIG.templateName,
    pageSize: { width: { magnitude: PAGE.w, unit: 'PT' }, height: { magnitude: PAGE.h, unit: 'PT' } },
  });
  const deck = SlidesApp.openById(pres.presentationId);
  const slide = deck.getSlides()[0];
  slide.getPageElements().forEach(function (el) { el.remove(); });
  slide.getBackground().setPictureFill(backgroundBlob_(root));

  const S = CONFIG.signatories;
  box_(slide, LAYOUT.title, 'CERTIFICATE OF COMPLETION');
  box_(slide, LAYOUT.certify, 'This is to certify that');
  box_(slide, LAYOUT.name, '{{NAME}}');
  box_(slide, LAYOUT.completed, 'has successfully completed');
  box_(slide, LAYOUT.course, CONFIG.course);
  box_(slide, LAYOUT.details, CONFIG.details);
  box_(slide, LAYOUT.sign1, S[0].name);
  box_(slide, LAYOUT.sign1t, S[0].title);
  box_(slide, LAYOUT.sign2, S[1].name);
  box_(slide, LAYOUT.sign2t, S[1].title);
  box_(slide, LAYOUT.issuedL, 'Issued');
  box_(slide, LAYOUT.issued, CONFIG.issued);
  box_(slide, LAYOUT.idline, 'Certificate ID: {{ID}}  ·  Scan the QR code to verify');
  box_(slide, LAYOUT.company, 'Neudata Consulting Ltd  ·  www.neu-data.com  ·  contact@neu-data.com');
  box_(slide, LAYOUT.tagline, 'Insight. Impact. Innovation.');
  box_(slide, LAYOUT.qrcap, 'Scan to verify');
  deck.saveAndClose();

  const file = DriveApp.getFileById(pres.presentationId);
  file.moveTo(root);
  return file;
}

function backgroundBlob_(root) {
  const local = findFile_(root, CONFIG.backgroundFileName);
  if (local) return local.getBlob();
  const res = UrlFetchApp.fetch(CONFIG.backgroundUrl, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Background image not found. Upload ' + CONFIG.backgroundFileName +
                    ' into the "' + CONFIG.rootFolderName + '" folder and run setup() again.');
  }
  const blob = res.getBlob().setName(CONFIG.backgroundFileName);
  root.createFile(blob);
  return blob;
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
    const idx = data.findIndex(function (r, i) { return i > 0 && r[1] === key; });
    if (idx > 0) {
      existing = true;
      row = idx + 1;
      id = data[idx][0];
      const lastSent = data[idx][5];
      if (lastSent && (Date.now() - new Date(lastSent).getTime()) < CONFIG.resendCooldownMinutes * 60000) {
        return { ok: true, code: 'RECENTLY_SENT', id: id, email: data[idx][2] };
      }
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
  let pdf;
  if (existing && record[6]) {
    pdf = DriveApp.getFileById(fileIdFromUrl_(record[6])).getBlob();
  } else {
    const file = buildPdf_(id, record[3]);
    sheet.getRange(row, 7).setValue(file.getUrl());
    pdf = file.getBlob();
  }

  sendEmail_(sendTo, record[3], id, pdf, lang);
  sheet.getRange(row, 6).setValue(new Date());
  sheet.getRange(row, 8).setValue('sent');
  return { ok: true, code: existing ? 'RESENT' : 'SENT', id: id, email: sendTo };
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
    deck.replaceAllText('{{ID}}', id);
    const qr = slide.insertImage(qrBlob_(verifyUrl_(id)));
    qr.setLeft(LAYOUT.qr.x).setTop(LAYOUT.qr.y).setWidth(LAYOUT.qr.size).setHeight(LAYOUT.qr.size);
    deck.saveAndClose();
    const pdf = copy.getAs('application/pdf').setName(id + '_' + slug_(name) + '.pdf');
    return issued.createFile(pdf);
  } finally {
    copy.setTrashed(true);
  }
}

function nameSize_(name) {
  const n = name.length;
  return n <= 22 ? 44 : n <= 30 ? 36 : n <= 38 ? 30 : 24;
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
