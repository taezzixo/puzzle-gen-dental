/**
 * PuzzleGen Dental 사용성 평가 — Google Apps Script 저장소
 * (정적 호스팅(Vercel · Netlify · GitHub Pages 등)에 화면만 올릴 때 사용)
 *
 * 설정 방법
 *  1. Google 스프레드시트를 새로 만들고 [확장 프로그램] → [Apps Script] 를 엽니다.
 *  2. 이 파일 내용을 그대로 붙여넣고 ADMIN_PIN 을 원하는 비밀번호로 바꿉니다.
 *  3. [배포] → [새 배포] → 유형 "웹 앱", 실행 계정 "나", 액세스 권한 "모든 사용자" → 배포
 *  4. 발급된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을
 *     화면 빌드 시 환경변수 VITE_SURVEY_API_URL 로 지정합니다.
 *
 * 스프레드시트 시트 구성
 *  - responses : 평가자별 최신 응답 1행 (원본 JSON 포함)
 *  - log       : 저장할 때마다 1행씩 누적 (변경 이력)
 */
var ADMIN_PIN = '1234';

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function mask_(s) {
  s = String(s || '').trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s.charAt(0) + '*';
  return s.charAt(0) + new Array(s.length - 1).join('*') + s.charAt(s.length - 1);
}
function all_() {
  var sh = sheet_('responses', ['evaluatorId', 'name', 'status', 'progress', 'updatedAt', 'json']);
  var v = sh.getDataRange().getValues();
  var recs = [];
  for (var i = 1; i < v.length; i++) { try { recs.push(JSON.parse(v[i][5])); } catch (e) {} }
  recs.sort(function (a, b) { return a.evaluatorId - b.evaluatorId; });
  return recs;
}

function doGet(e) {
  var p = e.parameter || {};
  if (p.action === 'get') {
    var id = Number(p.id);
    var rec = all_().filter(function (r) { return r.evaluatorId === id; })[0] || null;
    return out_({ ok: true, record: rec });
  }
  if (p.action === 'summary') {
    return out_({ ok: true, summary: all_().map(function (r) {
      return { evaluatorId: r.evaluatorId, name: mask_(r.answers && r.answers.consent && r.answers.consent.name), status: r.status, progress: r.progress, updatedAt: r.updatedAt };
    }) });
  }
  if (p.action === 'list') {
    if (String(p.pin) !== String(ADMIN_PIN)) return out_({ ok: false, code: 'BAD_PIN', error: '관리자 비밀번호가 올바르지 않습니다' });
    return out_({ ok: true, records: all_() });
  }
  return out_({ ok: false, error: '알 수 없는 요청' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== 'save' || !body.record) return out_({ ok: false, error: '알 수 없는 요청' });
    var rec = body.record;
    var id = Number(rec.evaluatorId);
    if (!(id >= 1 && id <= 50)) return out_({ ok: false, error: '잘못된 평가자 번호' });
    var sh = sheet_('responses', ['evaluatorId', 'name', 'status', 'progress', 'updatedAt', 'json']);
    var v = sh.getDataRange().getValues();
    var row = -1, prev = null;
    for (var i = 1; i < v.length; i++) if (Number(v[i][0]) === id) { row = i + 1; try { prev = JSON.parse(v[i][5]); } catch (x) {} }
    if (prev && prev.status === 'submitted' && rec.status !== 'submitted') rec.status = 'submitted';
    var savedAt = new Date().toISOString();
    rec.evaluatorId = id; rec.savedAt = savedAt;
    rec.createdAt = (prev && prev.createdAt) || rec.createdAt || savedAt;
    rec.saveCount = ((prev && prev.saveCount) || 0) + 1;
    var json = JSON.stringify(rec);
    var name = (rec.answers && rec.answers.consent && rec.answers.consent.name) || '';
    var values = [[id, name, rec.status, rec.progress, savedAt, json]];
    if (row > 0) sh.getRange(row, 1, 1, 6).setValues(values); else sh.appendRow(values[0]);
    sheet_('log', ['savedAt', 'evaluatorId', 'name', 'status', 'progress', 'json']).appendRow([savedAt, id, name, rec.status, rec.progress, json]);
    return out_({ ok: true, savedAt: savedAt });
  } finally {
    lock.releaseLock();
  }
}
