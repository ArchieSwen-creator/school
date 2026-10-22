/* ============================================================
   EduCore Shared Helpers
   Build: v15 — user profile fields migration (with qualification),
                updateLinkedUserProfile helper,
                Principals & Registrars menu entries
   ============================================================ */
(function(global){
  'use strict';

  const STORE_KEYS = {
    students: 'educoreStudents',
    results: 'educoreResults',
    attendance: 'educoreAttendance',
    fees: 'educoreFees',
    payments: 'educorePayments',
    classFees: 'educoreClassFees',
    adjustments: 'educoreAdjustments',
    classes: 'educoreClasses',
    settings: 'educoreSchoolSettings',
    settingsExtra: 'educoreSettingsExtra',
    terms: 'educoreTerms',
    semesters: 'educoreSemesters',
    audit: 'educoreAudit',
    classSignatures: 'educoreClassSignatures',
    users: 'educoreUsers',
    session: 'educoreSession',
    seeded: 'educoreSeeded',
    transfers: 'educoreTransfers',
    transcripts: 'educoreTranscripts',
    recommendations: 'educoreRecommendations',
    photos: 'educorePhotos',
    profilePhotos: 'educoreProfilePhotos',
    teachers: 'educoreTeachers',
    parents: 'educoreParents',
    announcements: 'educoreAnnouncements',
    announcementReads: 'educoreAnnouncementReads',
    announcementAcks: 'educoreAnnouncementAcks',
    subjects: 'educoreSubjects',
    assignments: 'educoreAssignments',
    sponsors: 'educoreSponsors',
    enrollments: 'educoreEnrollments',
    archives: 'educoreArchives',
    salaryPayments: 'educoreSalaryPayments',
    quizzes: 'educoreQuizzes',
    quizQuestions: 'educoreQuizQuestions',
    quizAttempts: 'educoreQuizAttempts',
    quizResponses: 'educoreQuizResponses',
    timetableSettings: 'educoreTimetableSettings',
    timetable: 'educoreTimetable',
    gradePushes: 'educoreGradePushes',
    lastPushCheck: 'educoreLastPushCheck',
    migratedCategories: 'educoreMigratedCategoriesV2',
    migratedResults: 'educoreMigratedResultsToPeriodsV1',
    migratedFees: 'educoreMigratedFeesV3',
    migratedResultStatus: 'educoreMigratedResultStatusV1',
    migratedResultStudentIds: 'educoreMigratedResultStudentIdsV1',
    migratedSubmittedPushIds: 'educoreMigratedSubmittedPushIdsV1',
    migratedAutoSeedSubjects: 'educoreMigratedAutoSeedSubjectsV1',
    migratedStripExams: 'educoreMigratedStripExamsFromNonStaffV1',
    migratedSubjectCanonical: 'educoreMigratedSubjectCanonicalV1',
    migratedPublicVerify: 'educoreMigratedPublicVerifyV1',
    enquiries: 'educoreEnquiries',
    homepage: 'educoreHomepage',
    homepageLive: 'educoreHomepageLive',
    hiringForms: 'educoreHiringForms',
    hiringApplications: 'educoreHiringApplications'
  };

  /* ============================================================
     STORE I/O
     ============================================================ */
  function readStore(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }catch(e){ return fallback; }
  }

  function writeStore(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.error('[EduCore writeStore] failed for', key, e);
      try{
        if(typeof window.__educoreStorageError === 'function'){
          window.__educoreStorageError(key, e);
        }
      }catch(_){}
      return false;
    }
  }

  function removeStore(key){
    try{ localStorage.removeItem(key); return true; }catch(e){ return false; }
  }
  function storageAvailable(){
    try{
      const probe = '__educore_probe_' + Math.random().toString(36).slice(2);
      localStorage.setItem(probe, '1');
      const readBack = localStorage.getItem(probe);
      localStorage.removeItem(probe);
      if(readBack !== '1') return { ok:false, reason:'localStorage write did not persist.' };
      return { ok:true };
    }catch(e){
      return { ok:false, reason: e.message || 'localStorage threw.' };
    }
  }

  const DEVICE_ID = (function(){
    try{
      let id = localStorage.getItem('educoreDeviceId');
      if(!id){
        id = 'Device ' + Math.random().toString(36).slice(2,6).toUpperCase();
        localStorage.setItem('educoreDeviceId', id);
      }
      return id;
    }catch(e){ return 'Device ????'; }
  })();

  /* ============================================================
     SESSION + IDENTITY
     ============================================================ */
  const SESSION_TTL_MIN = 60;
  function currentUser(){
    const session = readStore(STORE_KEYS.session, null);
    if(!session) return null;
    const lastSeenRaw = session.lastSeenAt || session.loggedInAt;
    if(lastSeenRaw){
      const t = new Date(lastSeenRaw).getTime();
      if(Number.isFinite(t)){
        const deltaMin = (Date.now() - t) / 60000;
        if(deltaMin > SESSION_TTL_MIN && deltaMin < 60 * 24 * 365){
          writeStore(STORE_KEYS.session, null);
          return null;
        }
      }
    }
    const users = readStore(STORE_KEYS.users, []) || [];
    const u = users.find(x => x.id === session.userId);
    if(!u || !u.active) return null;
    session.lastSeenAt = new Date().toISOString();
    writeStore(STORE_KEYS.session, session);
    return u;
  }
  function hasPerm(perm){
    const u = currentUser();
    return !!(u && u.permissions && u.permissions[perm]);
  }
  function can(key){
    const u = currentUser();
    if(!u || !u.permissions) return false;
    if(Object.prototype.hasOwnProperty.call(u.permissions, key)) return !!u.permissions[key];
    if(key.indexOf('.') === -1) return !!u.permissions[key];
    return !!u.permissions[key.split('.')[0]];
  }
  function requireLogin(){
    const u = currentUser();
    if(!u){
      sessionStorage.setItem('educoreAuthError', 'Please sign in.');
      window.location.href = 'index.html';
      return null;
    }
    return u;
  }
  function requirePerm(perm, pageLabel){
    const u = requireLogin();
    if(!u) return null;
    if(!hasPerm(perm)){ showDenied(pageLabel || perm); return null; }
    return u;
  }
  function logout(){
    const u = currentUser();
    if(u) audit('logout', 'User ' + u.username, '', '');
    writeStore(STORE_KEYS.session, null);
    window.location.href = 'index.html';
  }

  /* ============================================================
     AUDIT
     ============================================================ */
  function readAudit(){ return readStore(STORE_KEYS.audit, []) || []; }
  function writeAudit(list){ writeStore(STORE_KEYS.audit, list); }
  function audit(action, target, from, to, meta){
    const u = currentUser();
    const list = readAudit();
    list.unshift({
      id: 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      at: new Date().toISOString(),
      actor: u ? u.username : DEVICE_ID,
      action: action || '',
      target: target || '',
      from: from === undefined ? '' : from,
      to: to === undefined ? '' : to,
      meta: meta || ''
    });
    if(list.length > 3000) list.length = 3000;
    writeAudit(list);
  }

  /* ============================================================
     PROFILE PHOTOS
     ============================================================ */
  const PHOTO_MAX_BYTES = 1024 * 1024;
  const PHOTO_MAX_ENCODED = 1.4 * 1024 * 1024;

  function profilePhotoKey(type, id){
    return String(type || 'user') + ':' + String(id || '');
  }
  function readProfilePhotos(){
    return readStore(STORE_KEYS.profilePhotos, {}) || {};
  }
  function getProfilePhoto(type, id){
    const store = readProfilePhotos();
    return store[profilePhotoKey(type, id)] || '';
  }
  function setProfilePhoto(type, id, dataUrl){
    const store = readProfilePhotos();
    const key = profilePhotoKey(type, id);
    if(dataUrl){ store[key] = dataUrl; }
    else { delete store[key]; }
    return writeStore(STORE_KEYS.profilePhotos, store);
  }
  function removeProfilePhoto(type, id){
    return setProfilePhoto(type, id, '');
  }
  function readPhotoFile(file){
    return new Promise(resolve => {
      if(!file){ resolve({ ok:false, error:'No file selected.' }); return; }
      if(!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)){
        resolve({ ok:false, error:'Only PNG, JPG, WEBP, or GIF images are allowed.' });
        return;
      }
      if(file.size > PHOTO_MAX_BYTES){
        resolve({ ok:false, error:'Image is too large (max ' + (PHOTO_MAX_BYTES/1024/1024).toFixed(1) + ' MB).' });
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => resolve({ ok:false, error:'Could not read that file.' });
      reader.onload = ev => {
        const dataUrl = String(ev.target.result || '');
        if(dataUrl.length > PHOTO_MAX_ENCODED){
          resolve({ ok:false, error:'Image is too large after encoding. Try a smaller file.' });
          return;
        }
        resolve({ ok:true, dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }
  function downscalePhoto(dataUrl, maxDim){
    maxDim = maxDim || 512;
    return new Promise(resolve => {
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try{
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          if(ratio >= 1){ resolve(dataUrl); return; }
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        }catch(e){
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  }

  /* ============================================================
     FORMATTING
     ============================================================ */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = n => String(n||'').split(' ').filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const money = (n, currency) => {
    const sym = currency === 'LRD' ? 'L$' : '$';
    return sym + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' }); } catch(e){ return iso; } };
  const fmtDateTime = iso => { try { return new Date(iso).toLocaleString(); } catch(e){ return iso; } };
  const round2 = n => Math.round(Number(n || 0) * 100) / 100;

  /* ============================================================
     GRADING
     ============================================================ */
  const NURSERY_SCALE = [
    { letter: 'A', min: 90, max: 100, remark: 'Excellence' },
    { letter: 'B', min: 85, max: 89,  remark: 'Very Good' },
    { letter: 'C', min: 80, max: 84,  remark: 'Good' },
    { letter: 'D', min: 75, max: 79,  remark: 'Fair' },
    { letter: 'E', min: 70, max: 74,  remark: 'Not Impressive' },
    { letter: 'F', min: 0,  max: 69,  remark: 'FAIL' }
  ];
  const DEFAULT_NUMERIC_SCALE = [
    { letter: 'A', min: 90, max: 100, remark: 'Excellent' },
    { letter: 'B', min: 80, max: 89,  remark: 'Very Good' },
    { letter: 'C', min: 70, max: 79,  remark: 'Good' },
    { letter: 'D', min: 60, max: 69,  remark: 'Satisfactory' },
    { letter: 'F', min: 0,  max: 59,  remark: 'Fail' }
  ];
  function numericScale(){
    const s = readStore(STORE_KEYS.settings, {}) || {};
    return Array.isArray(s.numericScale) && s.numericScale.length ? s.numericScale : DEFAULT_NUMERIC_SCALE;
  }
  const CATEGORY_LIST = [
    'Nursery','K-1','K-2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
    'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'
  ];
  function isNurseryCategory(c){ return String(c || '').trim().toLowerCase() === 'nursery'; }
  function resolveGradingScale(c){
    return isNurseryCategory(c) ? { type:'letter', scale: NURSERY_SCALE } : { type:'numeric', scale: numericScale() };
  }
  function gradeFromNumber(n, category){
    const v = Number(n);
    if(!Number.isFinite(v)) return '—';
    const scale = resolveGradingScale(category).scale;
    for(const band of scale){ if(v >= band.min && v <= band.max) return band.letter; }
    return 'F';
  }
  function gradeFromNurseryNumber(n){ return gradeFromNumber(n, 'Nursery'); }
  function remarkForGrade(letter, category){
    const scale = resolveGradingScale(category).scale;
    const band = scale.find(b => b.letter === String(letter).toUpperCase());
    return band ? band.remark : '';
  }
  function midpointForLetter(letter, category){
    const scale = resolveGradingScale(category).scale;
    const band = scale.find(b => b.letter === String(letter).toUpperCase());
    if(!band) return null;
    return (band.min + band.max) / 2;
  }
  function grade(n){ return gradeFromNumber(n, null); }
  function gradeFromScore(score, category){
    if(score === '' || score === null || score === undefined) return '—';
    if(typeof score === 'string' && /^[A-Fa-f]$/.test(score.trim())) return score.trim().toUpperCase();
    const num = Number(score);
    if(!Number.isFinite(num)) return '—';
    return gradeFromNumber(num, category);
  }
  function validateScore(raw, category){
    if(raw === '' || raw === null || raw === undefined) return { ok:true, normalized:'' };
    if(isNurseryCategory(category)){
      if(typeof raw === 'string' && /^[A-Fa-f]$/.test(raw.trim())) return { ok:true, normalized: raw.trim().toUpperCase() };
      const n = Number(raw);
      if(!Number.isFinite(n) || n < 0 || n > 100) return { ok:false, error:'Nursery scores must be a letter A–F or a number 0–100.' };
      return { ok:true, normalized: gradeFromNumber(n, category) };
    }
    const n = Number(raw);
    if(!Number.isFinite(n) || n < 0 || n > 100) return { ok:false, error:'Enter a score between 0 and 100.' };
    return { ok:true, normalized:n };
  }
  function averageScores(values, category){
    const nums = values.map(v => {
      if(v === '' || v === null || v === undefined) return NaN;
      if(typeof v === 'string' && /^[A-Fa-f]$/.test(v.trim())) return midpointForLetter(v, category);
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    }).filter(n => Number.isFinite(n));
    if(!nums.length) return null;
    const mean = nums.reduce((a,b) => a + b, 0) / nums.length;
    return { letter: gradeFromNumber(mean, category), number: mean };
  }

  /* ============================================================
     ACADEMIC STRUCTURE
     ============================================================ */
  const SEMESTER_1_PERIODS = [
    { key: 1,   label:'P1', short:'P1', semester:1, isExam:false },
    { key: 2,   label:'P2', short:'P2', semester:1, isExam:false },
    { key: 3,   label:'P3', short:'P3', semester:1, isExam:false },
    { key:'e1', label:'Exam', short:'S1 Exam', semester:1, isExam:true }
  ];
  const SEMESTER_2_PERIODS = [
    { key: 4,   label:'P4', short:'P4', semester:2, isExam:false },
    { key: 5,   label:'P5', short:'P5', semester:2, isExam:false },
    { key: 6,   label:'P6', short:'P6', semester:2, isExam:false },
    { key:'e2', label:'Exam', short:'S2 Exam', semester:2, isExam:true }
  ];
  const ALL_PERIODS = [...SEMESTER_1_PERIODS, ...SEMESTER_2_PERIODS];
  function periodsForSemester(s){ return Number(s) === 2 ? SEMESTER_2_PERIODS : SEMESTER_1_PERIODS; }
  function periodMeta(key){ return ALL_PERIODS.find(p => String(p.key) === String(key)) || null; }
  function currentAcademicYear(){
    const s = readStore(STORE_KEYS.settings, {}) || {};
    return s.academicYear || '2025/2026';
  }
  function weightConfig(){
    const s = readStore(STORE_KEYS.settings, {}) || {};
    const w = s.weights || {};
    return {
      periodWeight: Number.isFinite(w.periodWeight) ? w.periodWeight : 0.6,
      examWeight:   Number.isFinite(w.examWeight)   ? w.examWeight   : 0.4,
      semesterWeight: Number.isFinite(w.semesterWeight) ? w.semesterWeight : 0.5
    };
  }

  /* ============================================================
     RESULTS
     ============================================================ */
  function readResults(){ return readStore(STORE_KEYS.results, []) || []; }
  function writeResults(list){ writeStore(STORE_KEYS.results, list); }

  function filterResultsByApproval(list, opts){
    if(!opts || !opts.approvedOnly) return list;
    return list.filter(r => r.status === 'approved');
  }

  /* ============================================================
     PUSH ENGINE
     ============================================================ */
  function readGradePushes(){ return readStore(STORE_KEYS.gradePushes, []) || []; }
  function writeGradePushes(list){ writeStore(STORE_KEYS.gradePushes, list); }
  function getGradePush(id){ return readGradePushes().find(p => p.id === id) || null; }

  function ensureFreshGradePushStates(){
    const last = readStore(STORE_KEYS.lastPushCheck, 0);
    if(Date.now() - Number(last || 0) < 5 * 60 * 1000) return;
    autoLockExpiredPushes();
    writeStore(STORE_KEYS.lastPushCheck, Date.now());
  }

  function autoLockExpiredPushes(){
    const now = Date.now();
    const pushes = readGradePushes();
    let changed = false;
    pushes.forEach(p => {
      if(p.status === 'open' && p.deadline && new Date(p.deadline).getTime() < now){
        p.status = 'locked';
        p.lockedAt = new Date().toISOString();
        changed = true;
        audit('lock', `Push ${p.id}`, 'open', 'locked', 'Deadline expired');
      }
    });
    if(changed){
      writeGradePushes(pushes);
      const results = readResults();
      let touched = false;
      results.forEach(r => {
        if(!r.pushId) return;
        const p = pushes.find(x => x.id === r.pushId);
        if(!p) return;
        if(p.status === 'locked' && (r.status === 'draft' || r.status === 'open' || !r.status)){
          r.status = 'submitted';
          touched = true;
        }
      });
      if(touched) writeResults(results);
    }
    return changed;
  }

  function findPush(teacherId, className, subject, semester, period, year){
    const y = year || currentAcademicYear();
    const target = normSubject(subject);
    return readGradePushes().find(p =>
      p.teacherId === teacherId &&
      p.className === className &&
      normSubject(p.subject) === target &&
      Number(p.semester) === Number(semester) &&
      String(p.period) === String(period) &&
      p.year === y
    ) || null;
  }
  function findPushForStudentView(className, subject, semester, period, year){
    const y = year || currentAcademicYear();
    const target = normSubject(subject);
    return readGradePushes().find(p =>
      p.className === className &&
      normSubject(p.subject) === target &&
      Number(p.semester) === Number(semester) &&
      String(p.period) === String(period) &&
      p.year === y &&
      p.status === 'approved'
    ) || null;
  }

  function createGradePushes({ scope, semester, period, year, deadlineIso, notes }){
    const y = year || currentAcademicYear();
    const assignments = getAssignments();
    const teachers = getTeachers();
    let targets = [];
    if(scope.type === 'school'){
      assignments.forEach(a => {
        const t = teachers.find(x => x.id === a.teacherId);
        targets.push({ teacherId: a.teacherId, teacherName: t ? t.name : a.teacherId, className: a.className, subject: a.subject });
      });
    } else if(scope.type === 'class'){
      assignments.filter(a => a.className === scope.className).forEach(a => {
        const t = teachers.find(x => x.id === a.teacherId);
        targets.push({ teacherId: a.teacherId, teacherName: t ? t.name : a.teacherId, className: a.className, subject: a.subject });
      });
    } else if(scope.type === 'teacher'){
      targets.push({
        teacherId: scope.teacherId,
        teacherName: (teachers.find(t => t.id === scope.teacherId) || {}).name || scope.teacherId,
        className: scope.className,
        subject: scope.subject
      });
    }
    const seen = new Set();
    targets = targets.filter(t => {
      const k = `${t.teacherId}|${t.className}|${normSubject(t.subject)}`;
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if(!targets.length) return { ok:false, error:'No teaching assignments match that scope.' };
    const existing = readGradePushes();
    const created = [], replaced = [], blocked = [];
    const u = currentUser();
    targets.forEach(t => {
      const normT = normSubject(t.subject);
      const dup = existing.find(p =>
        p.teacherId === t.teacherId &&
        p.className === t.className &&
        normSubject(p.subject) === normT &&
        Number(p.semester) === Number(semester) &&
        String(p.period) === String(period) &&
        p.year === y
      );
      if(dup){
        if(dup.status === 'open' || dup.status === 'locked' || dup.status === 'returned'){
          dup.deadline = deadlineIso;
          dup.pushedAt = new Date().toISOString();
          dup.pushedBy = u ? u.username : '';
          dup.status = 'open';
          dup.lockedAt = null;
          dup.returnedAt = null;
          dup.returnedBy = null;
          dup.returnReason = '';
          dup.notes = notes || '';
          replaced.push(dup.id);
        } else {
          blocked.push({ pushId: dup.id, teacherName: t.teacherName, className: t.className, subject: t.subject, reason: `Already ${dup.status}` });
        }
        return;
      }
      const row = {
        id: 'gp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
        semester: Number(semester), period: String(period), year: y,
        className: t.className,
        subject: subjectName(t.subject) || t.subject,
        teacherId: t.teacherId, teacherName: t.teacherName,
        pushedAt: new Date().toISOString(),
        pushedBy: u ? u.username : '',
        deadline: deadlineIso,
        openedAt: null, submittedAt: null, submittedBy: null,
        approvedAt: null, approvedBy: null,
        returnedAt: null, returnedBy: null, returnReason: '',
        hiddenAt: null, hiddenBy: null,
        lockedAt: null,
        status: 'open',
        approvedCount: 0, submittedCount: 0, pendingCount: 0,
        notes: notes || ''
      };
      existing.push(row);
      created.push(row.id);
    });
    writeGradePushes(existing);
    audit('create', 'Grade pushes', '', `${created.length} created · ${replaced.length} replaced · ${blocked.length} blocked`);
    return { ok:true, created, replaced, blocked, targets };
  }

  function markPushOpened(pushId){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p || p.openedAt) return false;
    p.openedAt = new Date().toISOString();
    writeGradePushes(pushes);
    return true;
  }

  function submitGradePush(pushId){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { ok:false, error:'Push not found.' };
    if(p.status !== 'open' && p.status !== 'returned' && p.status !== 'locked'){
      return { ok:false, error:`Cannot submit a push in status "${p.status}".` };
    }
    if(p.status === 'locked') return { ok:false, error:'Deadline passed. Ask the admin to reopen.' };
    if(p.deadline && Date.now() > new Date(p.deadline).getTime()){
      autoLockExpiredPushes();
      return { ok:false, error:'Deadline passed. Push is now locked.' };
    }
    const u = currentUser();
    p.status = 'submitted';
    p.submittedAt = new Date().toISOString();
    p.submittedBy = u ? u.username : '';
    refreshPushRollupInto(p);
    writeGradePushes(pushes);
    const results = readResults();
    let touched = 0;
    results.forEach(r => {
      if(r.pushId === p.id && (r.status === 'draft' || r.status === 'open' || r.status === 'returned' || !r.status)){
        r.status = 'submitted';
        touched++;
      }
    });
    if(touched) writeResults(results);
    audit('submit', `Push ${p.id}`, '', `${touched} rows submitted`);
    return { ok:true, rows: touched };
  }

  function approveGradePush(pushId, opts){
    opts = opts || {};
    const studentIds = opts.studentIds || null;
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { ok:false, error:'Push not found.' };
    if(p.status !== 'submitted' && p.status !== 'hidden' && p.status !== 'approved'){
      return { ok:false, error:`Cannot approve a push in status "${p.status}".` };
    }
    const u = currentUser();
    let studentIdSet = null;
    let studentNameSet = null;
    if(studentIds){
      studentIdSet = new Set(studentIds);
      const allStudents = readStore(STORE_KEYS.students, []) || [];
      studentNameSet = new Set(
        studentIds
          .map(id => { const s = allStudents.find(x => x.id === id); return s ? s.name : null; })
          .filter(Boolean)
      );
    }
    const results = readResults();
    let approved = 0;
    results.forEach(r => {
      if(r.pushId !== p.id) return;
      if(studentIdSet){
        const matchesById   = r.studentId && studentIdSet.has(r.studentId);
        const matchesByName = !r.studentId && studentNameSet && studentNameSet.has(r.student);
        if(!matchesById && !matchesByName) return;
      }
      if(r.status === 'approved') return;
      if(r.status !== 'submitted' && r.status !== 'hidden') return;
      r.status = 'approved';
      r.approvedAt = new Date().toISOString();
      r.approvedBy = u ? u.username : '';
      approved++;
    });
    if(approved) writeResults(results);
    refreshPushRollupInto(p);
    if(p.pendingCount === 0 && p.submittedCount === 0 && p.approvedCount > 0){
      p.status = 'approved';
      p.approvedAt = new Date().toISOString();
      p.approvedBy = u ? u.username : '';
    }
    writeGradePushes(pushes);
    audit('approve', `Push ${p.id}`, '', `${approved} rows approved`);
    return { ok:true, rows: approved, status: p.status };
  }

  function returnGradePush(pushId, reason, newDeadlineIso){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { ok:false, error:'Push not found.' };
    if(!['submitted','approved','hidden','locked'].includes(p.status)){
      return { ok:false, error:`Cannot return a push in status "${p.status}".` };
    }
    if(!newDeadlineIso) return { ok:false, error:'A new deadline is required.' };
    const u = currentUser();
    p.status = 'returned';
    p.returnedAt = new Date().toISOString();
    p.returnedBy = u ? u.username : '';
    p.returnReason = reason || '';
    p.deadline = newDeadlineIso;
    p.lockedAt = null;
    p.hiddenAt = null;
    writeGradePushes(pushes);
    const results = readResults();
    let touched = 0;
    results.forEach(r => {
      if(r.pushId === p.id && r.status !== 'rejected'){
        r.status = 'returned';
        touched++;
      }
    });
    if(touched) writeResults(results);
    audit('return', `Push ${p.id}`, '', reason || '');
    return { ok:true, rows: touched };
  }

  function hideGradePush(pushId){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { ok:false, error:'Push not found.' };
    if(p.status !== 'approved'){
      return { ok:false, error:`Cannot hide a push in status "${p.status}".` };
    }
    const u = currentUser();
    p.status = 'hidden';
    p.hiddenAt = new Date().toISOString();
    p.hiddenBy = u ? u.username : '';
    writeGradePushes(pushes);
    audit('hide', `Push ${p.id}`, 'approved', 'hidden');
    return { ok:true };
  }

  function reopenGradePush(pushId, newDeadlineIso){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { ok:false, error:'Push not found.' };
    if(!['locked','returned','hidden','submitted'].includes(p.status)){
      return { ok:false, error:`Cannot reopen a push in status "${p.status}".` };
    }
    if(!newDeadlineIso) return { ok:false, error:'A new deadline is required.' };
    p.status = 'open';
    p.deadline = newDeadlineIso;
    p.lockedAt = null;
    p.returnedAt = null;
    p.returnedBy = null;
    p.returnReason = '';
    p.hiddenAt = null;
    p.hiddenBy = null;
    writeGradePushes(pushes);
    const results = readResults();
    let touched = 0;
    results.forEach(r => {
      if(r.pushId === p.id && r.status !== 'approved'){
        r.status = 'draft';
        touched++;
      }
    });
    if(touched) writeResults(results);
    audit('reopen', `Push ${p.id}`, '', `new deadline ${newDeadlineIso}`);
    return { ok:true };
  }

  function refreshPushRollupInto(p){
    const results = readResults();
    const rows = results.filter(r => r.pushId === p.id);
    let approvedCount = 0, submittedCount = 0, pendingCount = 0;
    rows.forEach(r => {
      if(r.status === 'approved') approvedCount++;
      else if(r.status === 'submitted') submittedCount++;
      else pendingCount++;
    });
    p.approvedCount = approvedCount;
    p.submittedCount = submittedCount;
    p.pendingCount = pendingCount;
  }
  function refreshPushRollup(pushId){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return;
    refreshPushRollupInto(p);
    writeGradePushes(pushes);
  }

  function isScoreApproved(studentId, className, subject, semester, period, year){
    const y = year || currentAcademicYear();
    const target = normSubject(subject);
    const r = readResults().find(x =>
      x.studentId === studentId &&
      x.class === className &&
      normSubject(x.subject) === target &&
      Number(x.semester) === Number(semester) &&
      String(x.period) === String(period) &&
      (x.year === y || !x.year)
    );
    return !!(r && r.status === 'approved');
  }

  function pushProgress(pushId){
    const pushes = readGradePushes();
    const p = pushes.find(x => x.id === pushId);
    if(!p) return { filled:0, total:0, pct:0 };
    const students = (readStore(STORE_KEYS.students, []) || []).filter(s => s.class === p.className);
    const results = readResults();
    const target = normSubject(p.subject);
    let filled = 0;
    students.forEach(s => {
      const r = results.find(x =>
        x.studentId === s.id && x.class === p.className &&
        normSubject(x.subject) === target &&
        Number(x.semester) === Number(p.semester) &&
        String(x.period) === String(p.period) && (x.year === p.year || !x.year)
      );
      if(r && r.score !== '' && r.score !== null && r.score !== undefined) filled++;
    });
    return { filled, total: students.length, pct: students.length ? Math.round(filled / students.length * 100) : 0 };
  }

  function pushStatusLabel(p){
    if(!p) return '—';
    const map = {
      open: 'Open — awaiting teacher',
      locked: 'Locked — deadline passed',
      submitted: 'Submitted — awaiting approval',
      approved: 'Approved — visible to students',
      returned: 'Returned — awaiting revision',
      hidden: 'Hidden from students'
    };
    return map[p.status] || p.status;
  }

  function pendingPushCountForTeacher(teacherId){
    if(!teacherId) return 0;
    return readGradePushes().filter(p =>
      p.teacherId === teacherId && (p.status === 'open' || p.status === 'returned')
    ).length;
  }
  function pendingApprovalCount(){
    return readGradePushes().filter(p => p.status === 'submitted').length;
  }

  function periodResultsFor(studentName, className, subject, year, opts){
    const y = year || currentAcademicYear();
    const target = normSubject(subject);
    let list = readResults().filter(r =>
      r.student === studentName && r.class === className &&
      normSubject(r.subject) === target &&
      (r.year === y || !r.year));
    return filterResultsByApproval(list, opts);
  }
  function scoreFor(studentName, className, subject, semester, period, year, opts){
    const rows = periodResultsFor(studentName, className, subject, year, opts);
    const row = rows.find(r => Number(r.semester) === Number(semester) && String(r.period) === String(period));
    return row ? row.score : '';
  }

  function saveScore({ studentId, student, className, subject, semester, period, score, year }){
    const clsCategory = classCategoryFor(className);
    const v = validateScore(score, clsCategory);
    if(!v.ok) return { ok:false, error: v.error };
    const y = year || currentAcademicYear();
    const list = readResults();
    const targetSubj = normSubject(subject);
    const idx = list.findIndex(r =>
      r.student === student && r.class === className &&
      normSubject(r.subject) === targetSubj &&
      String(r.period) === String(period) && Number(r.semester) === Number(semester) &&
      (r.year === y || !r.year));

    const u = currentUser();
    const isAdmin = u && (u.role === 'Principal' || u.role === 'Registrar');
    let pushId = idx >= 0 ? list[idx].pushId : null;
    if(!pushId && u && u.role === 'Teacher'){
      const tid = currentTeacherId();
      if(tid){
        const push = findPush(tid, className, subject, semester, period, y);
        if(push) pushId = push.id;
      }
    }
    if(pushId){
      const push = getGradePush(pushId);
      if(push && push.status !== 'open' && push.status !== 'returned' && !isAdmin){
        return { ok:false, error: `Push is ${push.status}. Cannot edit.` };
      }
      if(push && push.deadline && Date.now() > new Date(push.deadline).getTime() && !isAdmin){
        autoLockExpiredPushes();
        return { ok:false, error:'Deadline passed. Push is now locked.' };
      }
    }

    let resolvedStudentId = studentId || (list[idx] && list[idx].studentId) || null;
    if(!resolvedStudentId){
      const foundStudent = (readStore(STORE_KEYS.students, []) || []).find(s => s.name === student && s.class === className);
      if(foundStudent) resolvedStudentId = foundStudent.id;
    }

    const payload = {
      student, class: className,
      subject: subjectName(subject) || subject,
      year: y,
      semester: Number(semester), period: period,
      score: v.normalized,
      studentId: resolvedStudentId,
      updatedAt: new Date().toISOString(),
      updatedBy: u ? u.username : '',
      pushId: pushId || (idx >= 0 ? list[idx].pushId : null) || null
    };

    if(!payload.pushId){
      payload.status = isAdmin ? 'approved' : 'draft';
      if(isAdmin){ payload.approvedAt = new Date().toISOString(); payload.approvedBy = u.username; }
    } else {
      const push = getGradePush(payload.pushId);
      if(idx < 0){
        payload.status = (push && push.status === 'returned') ? 'returned' : 'draft';
      } else {
        const existingStatus = list[idx].status || 'draft';
        if(existingStatus === 'draft' || existingStatus === 'returned') payload.status = 'draft';
        else payload.status = existingStatus;
      }
    }

    if(idx >= 0){
      const existingStatus = list[idx].status || 'draft';
      if(existingStatus === 'approved' && !isAdmin){
        return { ok:false, error:'This score is already approved and visible to students.' };
      }
      list[idx] = Object.assign({}, list[idx], payload);
    } else {
      if(v.normalized === '') return { ok:true, skipped:true };
      list.push(Object.assign({
        id: 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6)
      }, payload));
    }
    writeResults(list);
    if(pushId) refreshPushRollup(pushId);
    return { ok:true };
  }

  function semesterAverageFor(studentName, className, subject, semester, category, year, opts){
    ensureFreshGradePushStates();
    const cat = category || classCategoryFor(className);
    const periods = periodsForSemester(semester);
    const nonExam = periods.filter(p => !p.isExam);
    const exam = periods.find(p => p.isExam);
    const nonExamVals = nonExam.map(p => scoreFor(studentName, className, subject, semester, p.key, year, opts))
      .filter(v => v !== '' && v !== null && v !== undefined);
    const examVal = exam ? scoreFor(studentName, className, subject, semester, exam.key, year, opts) : '';
    if(!nonExamVals.length && (examVal === '' || examVal === undefined)) return null;
    const w = weightConfig();
    const periodMean = nonExamVals.length ? averageScores(nonExamVals, cat).number : null;
    const examNum = (() => {
      if(examVal === '' || examVal === undefined || examVal === null) return null;
      if(typeof examVal === 'string' && /^[A-Fa-f]$/.test(examVal.trim())) return midpointForLetter(examVal, cat);
      const n = Number(examVal);
      return Number.isFinite(n) ? n : null;
    })();
    let mean;
    if(periodMean != null && examNum != null) mean = periodMean * w.periodWeight + examNum * w.examWeight;
    else if(periodMean != null) mean = periodMean;
    else mean = examNum;
    if(mean == null) return null;
    return { letter: gradeFromNumber(mean, cat), number: mean };
  }

  function yearlyAverageFor(studentName, className, subject, category, year, opts){
    ensureFreshGradePushStates();
    const cat = category || classCategoryFor(className);
    const s1 = semesterAverageFor(studentName, className, subject, 1, cat, year, opts);
    const s2 = semesterAverageFor(studentName, className, subject, 2, cat, year, opts);
    const w = weightConfig();
    if(s1 && s2){
      const mean = s1.number * w.semesterWeight + s2.number * (1 - w.semesterWeight);
      return { letter: gradeFromNumber(mean, cat), number: mean };
    }
    if(s1) return s1;
    if(s2) return s2;
    return null;
  }

  function subjectLedgerRow(studentName, className, subject, year, opts){
    ensureFreshGradePushStates();
    const cat = classCategoryFor(className);
    const g = k => scoreFor(studentName, className, subject,
      (Number(k) >= 4 || k === 'e2') ? 2 : 1, k, year, opts);
    const s1 = semesterAverageFor(studentName, className, subject, 1, cat, year, opts);
    const s2 = semesterAverageFor(studentName, className, subject, 2, cat, year, opts);
    const yr = yearlyAverageFor(studentName, className, subject, cat, year, opts);
    return {
      subject, p1:g(1), p2:g(2), p3:g(3), e1:g('e1'), s1Avg:s1,
      p4:g(4), p5:g(5), p6:g(6), e2:g('e2'), s2Avg:s2, yearly:yr
    };
  }

  /* ============================================================
     SUBJECTS + CLASSES
     ============================================================ */
  function getSubjects(includeArchived){
    const list = readStore(STORE_KEYS.subjects, []) || [];
    return includeArchived ? list : list.filter(s => !s.archived);
  }
  function subjectByCode(code){
    if(!code) return null;
    const target = String(code).toLowerCase();
    return getSubjects(true).find(s => String(s.code || '').toLowerCase() === target) || null;
  }
  function subjectName(code){
    if(!code) return '';
    const s = subjectByCode(code);
    if(s && s.name) return s.name;
    const lower = String(code).toLowerCase();
    const s2 = getSubjects(true).find(x => String(x.code || '').toLowerCase() === lower);
    if(s2 && s2.name) return s2.name;
    return String(code);
  }
  function normSubject(v){
    if(v === '' || v === null || v === undefined) return '';
    const name = subjectName(v);
    return String(name || v || '').trim().toLowerCase();
  }
  function ensureSubject(nameOrCode, department){
    const list = readStore(STORE_KEYS.subjects, []) || [];
    let s = list.find(x => x.code.toLowerCase() === String(nameOrCode).toLowerCase()
                       || x.name.toLowerCase() === String(nameOrCode).toLowerCase());
    if(s) return s.code;
    const raw = String(nameOrCode).trim();
    const code = (raw.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)) || ('SUB' + String(list.length + 1).padStart(2,'0'));
    list.push({ code, name: raw, department: department || 'Unassigned', archived: false });
    writeStore(STORE_KEYS.subjects, list);
    return code;
  }
  function getClasses(){ return readStore(STORE_KEYS.classes, []) || []; }
  function classByName(name){ return getClasses().find(c => c.name === name) || null; }
  function classCategoryFor(className){
    const rec = classByName(className);
    return rec ? (rec.category || '') : '';
  }
  function isNurseryClass(className){ return isNurseryCategory(classCategoryFor(className)); }

  /* ============================================================
     TEACHERS + ASSIGNMENTS
     ============================================================ */
  function getTeachers(){ return readStore(STORE_KEYS.teachers, []) || []; }
  function getAssignments(filter){
    filter = filter || {};
    const list = readStore(STORE_KEYS.assignments, []) || [];
    return list.filter(a =>
      (!filter.teacherId || a.teacherId === filter.teacherId) &&
      (!filter.className || a.className === filter.className) &&
      (!filter.subject   || a.subject   === filter.subject) &&
      (!filter.semester  || Number(a.semester) === Number(filter.semester)));
  }
  function assignmentsForTeacher(tid){ return getAssignments({ teacherId: tid }); }
  function getSponsors(){ return readStore(STORE_KEYS.sponsors, {}) || {}; }
  function classSponsor(className){
    const tid = getSponsors()[className];
    if(!tid) return null;
    return getTeachers().find(t => t.id === tid) || null;
  }
  function sponsorClassOf(teacherId){
    const entry = Object.entries(getSponsors()).find(([, tid]) => tid === teacherId);
    return entry ? entry[0] : null;
  }
  function setSponsor(className, teacherId){
    const sponsors = getSponsors();
    if(teacherId){
      Object.keys(sponsors).forEach(cls => { if(sponsors[cls] === teacherId && cls !== className) delete sponsors[cls]; });
      sponsors[className] = teacherId;
    } else delete sponsors[className];
    writeStore(STORE_KEYS.sponsors, sponsors);
  }
  function clearSponsor(teacherId){
    const sponsors = getSponsors();
    Object.keys(sponsors).forEach(cls => { if(sponsors[cls] === teacherId) delete sponsors[cls]; });
    writeStore(STORE_KEYS.sponsors, sponsors);
  }
  function currentTeacherId(){
    const u = currentUser();
    if(!u) return null;
    if(u.linkedTeacherId) return u.linkedTeacherId;
    return (getTeachers().find(x => x.name === u.name) || {}).id || null;
  }
  function taughtSubjectsInClass(user, className){
    if(!user || user.role !== 'Teacher') return [];
    const tid = currentTeacherId();
    if(!tid) return [];
    const mine = assignmentsForTeacher(tid).filter(a => a.className === className);
    const names = new Set();
    mine.forEach(a => { if(a.subject){ names.add(subjectName(a.subject)); names.add(a.subject); } });
    return Array.from(names);
  }
  function isSponsorOfClass(user, className){
    if(!user || user.role !== 'Teacher') return false;
    const tid = currentTeacherId();
    return !!(tid && sponsorClassOf(tid) === className);
  }
  function canEditSubject(user, className, subjectNameValue){
    if(!user) return false;
    if(user.role !== 'Teacher') return true;
    const target = normSubject(subjectNameValue);
    const taught = taughtSubjectsInClass(user, className).map(normSubject);
    return taught.indexOf(target) >= 0;
  }

  /* ============================================================
     PARENTS REGISTRY
     ============================================================ */
  function getParents(){ return readStore(STORE_KEYS.parents, []) || []; }
  function parentById(id){ return getParents().find(p => p.id === id) || null; }
  function parentByName(name){
    const n = String(name || '').trim().toLowerCase();
    if(!n) return null;
    return getParents().find(p => String(p.name || '').trim().toLowerCase() === n) || null;
  }
  function addParent(data){
    const list = getParents();
    const name = String(data.name || '').trim();
    if(!name) return { ok:false, error:'Parent name is required.' };
    if(list.some(p => String(p.name||'').trim().toLowerCase() === name.toLowerCase())){
      return { ok:false, error:'A parent with that name already exists.' };
    }
    const u = currentUser();
    const row = {
      id: 'PAR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase(),
      name,
      phone:  String(data.phone  || '').trim(),
      email:  String(data.email  || '').trim(),
      address:String(data.address|| '').trim(),
      occupation: String(data.occupation || '').trim(),
      relationship: String(data.relationship || '').trim(),
      notes:  String(data.notes  || '').trim(),
      createdAt: new Date().toISOString(),
      createdBy: u ? u.username : '',
      updatedAt: new Date().toISOString()
    };
    list.push(row);
    writeStore(STORE_KEYS.parents, list);
    return { ok:true, parent: row };
  }
  function updateParent(id, data){
    const list = getParents();
    const target = list.find(p => p.id === id);
    if(!target) return { ok:false, error:'Parent not found.' };
    const name = String(data.name || '').trim();
    if(!name) return { ok:false, error:'Parent name is required.' };
    if(list.some(p => p.id !== id && String(p.name||'').trim().toLowerCase() === name.toLowerCase())){
      return { ok:false, error:'Another parent already uses that name.' };
    }
    const oldName = target.name;
    target.name = name;
    target.phone  = String(data.phone  || '').trim();
    target.email  = String(data.email  || '').trim();
    target.address= String(data.address|| '').trim();
    target.occupation = String(data.occupation || '').trim();
    target.relationship = String(data.relationship || '').trim();
    target.notes  = String(data.notes  || '').trim();
    target.updatedAt = new Date().toISOString();
    writeStore(STORE_KEYS.parents, list);
    if(oldName !== name){
      const students = readStore(STORE_KEYS.students, []) || [];
      let touched = 0;
      students.forEach(s => {
        if(String(s.guardian || '').trim().toLowerCase() === oldName.toLowerCase()){
          s.guardian = name;
          touched++;
        }
      });
      if(touched) writeStore(STORE_KEYS.students, students);
    }
    return { ok:true, parent: target };
  }
  function deleteParent(id){
    const list = getParents();
    const target = list.find(p => p.id === id);
    if(!target) return { ok:false };
    const students = readStore(STORE_KEYS.students, []) || [];
    const linked = students.filter(s =>
      String(s.guardian || '').trim().toLowerCase() === String(target.name || '').trim().toLowerCase());
    if(linked.length){
      return {
        ok:false,
        error:`${linked.length} student${linked.length === 1 ? ' is' : 's are'} still linked to this parent. Reassign them first.`,
        linkedStudents: linked.map(s => ({ id: s.id, name: s.name, class: s.class }))
      };
    }
    writeStore(STORE_KEYS.parents, list.filter(p => p.id !== id));
    return { ok:true };
  }
  function allGuardianNames(){
    const set = new Set();
    getParents().forEach(p => { if(p.name) set.add(p.name); });
    (readStore(STORE_KEYS.students, []) || []).forEach(s => {
      if(s.guardian && String(s.guardian).trim()) set.add(String(s.guardian).trim());
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  /* ============================================================
     updateLinkedUserProfile
     Writes profile fields (photo, nationality, qualification, …)
     to the user account linked to a teacher / student / parent.
     ============================================================ */
  function updateLinkedUserProfile(role, linkedId, patch){
    const users = readStore(STORE_KEYS.users, []) || [];
    let target = null;

    if(role === 'Teacher'){
      target = users.find(u => u.role === 'Teacher' && u.linkedTeacherId === linkedId);
    } else if(role === 'Student'){
      target = users.find(u => u.role === 'Student' && u.linkedStudentId === linkedId);
    } else if(role === 'Parent'){
      const targetName = String(patch && patch.name || '').trim().toLowerCase();
      if(targetName){
        target = users.find(u => u.role === 'Parent' &&
          String(u.name || '').trim().toLowerCase() === targetName);
      }
    }

    if(!target){
      return { ok:false, reason:'No linked user account.' };
    }

    const allowed = [
      'photo',
      'nationality',
      'countyOfOrigin',
      'ethnicGroup',
      'religion',
      'qualification',
      'passSchool'
    ];

    allowed.forEach(k => {
      if(patch && Object.prototype.hasOwnProperty.call(patch, k)){
        target[k] = String(patch[k] || '').trim();
      }
    });

    target.updatedAt = new Date().toISOString();
    target.updatedBy = (currentUser() || {}).username || 'system';

    writeStore(STORE_KEYS.users, users);
    audit('update', `Linked profile · ${target.username}`, '', 'profile fields updated');
    return { ok:true, user: target };
  }

  function childrenOf(user){
    if(!user || user.role !== 'Parent') return [];
    const students = readStore(STORE_KEYS.students, []) || [];
    if(!students.length) return [];
    const ids = new Set();
    if(Array.isArray(user.linkedStudentIds)) user.linkedStudentIds.filter(Boolean).forEach(id => ids.add(String(id)));
    if(user.linkedStudentId && !ids.has(String(user.linkedStudentId))) ids.add(String(user.linkedStudentId));
    let kids = [];
    if(ids.size) kids = students.filter(s => ids.has(s.id));
    if(!kids.length && ids.size){
      const lower = new Set(Array.from(ids).map(x => x.trim().toLowerCase()));
      kids = students.filter(s => lower.has(String(s.id).trim().toLowerCase()));
    }
    return kids;
  }
  function visibleClassNamesFor(user){
    if(!user) return [];
    const classes = getClasses();
    const students = readStore(STORE_KEYS.students, []) || [];
    if(user.role === 'Student'){
      const s = students.find(x => x.id === user.linkedStudentId);
      return s ? [s.class] : [];
    }
    if(user.role === 'Parent'){
      return Array.from(new Set(childrenOf(user).map(k => k.class).filter(Boolean)));
    }
    if(user.role === 'Teacher'){
      const tid = currentTeacherId();
      if(!tid) return [];
      const asn = assignmentsForTeacher(tid);
      const sponsored = sponsorClassOf(tid);
      const set = new Set(asn.map(a => a.className));
      if(sponsored) set.add(sponsored);
      return Array.from(set);
    }
    return classes.map(c => c.name);
  }
  function visibleStudentsFor(user){
    const students = readStore(STORE_KEYS.students, []) || [];
    if(!user) return [];
    if(user.role === 'Student') return students.filter(s => s.id === user.linkedStudentId);
    if(user.role === 'Parent'){
      const ids = new Set(childrenOf(user).map(k => k.id));
      return students.filter(s => ids.has(s.id));
    }
    if(user.role === 'Teacher'){
      const visible = new Set(visibleClassNamesFor(user));
      return students.filter(s => visible.has(s.class));
    }
    return students;
  }
  function visibleResultsFor(user, opts){
    const results = readResults();
    const approvedOnly = opts && opts.approvedOnly;
    if(!user) return [];
    let list = results;
    if(user.role === 'Student' || user.role === 'Parent'){
      const kids = user.role === 'Student'
        ? (readStore(STORE_KEYS.students, []) || []).filter(s => s.id === user.linkedStudentId)
        : childrenOf(user);
      const names = new Set(kids.map(k => k.name));
      list = results.filter(r => names.has(r.student));
    } else if(user.role === 'Teacher'){
      const tid = currentTeacherId();
      if(!tid) return [];
      const mine = assignmentsForTeacher(tid);
      const sponsored = sponsorClassOf(tid);
      list = results.filter(r => {
        const target = normSubject(r.subject);
        const teachesIt = mine.some(a =>
          a.className === r.class && normSubject(a.subject) === target);
        const isSponsoredClass = sponsored && r.class === sponsored;
        return teachesIt || isSponsoredClass;
      });
    }
    return approvedOnly ? filterResultsByApproval(list, opts) : list;
  }

  function readSemesters(){ return readStore(STORE_KEYS.semesters, {}) || {}; }
  function isSemesterLocked(semester, year){
    const y = year || currentAcademicYear();
    const s = readSemesters()[y + '|S' + Number(semester)];
    return !!(s && s.locked);
  }
  function setSemesterLock(semester, locked, year){
    const y = year || currentAcademicYear();
    const all = readSemesters();
    all[y + '|S' + Number(semester)] = locked
      ? { locked:true,  lockedAt:new Date().toISOString(), lockedBy:(currentUser()||{}).username || '' }
      : { locked:false, unlockedAt:new Date().toISOString(), unlockedBy:(currentUser()||{}).username || '' };
    writeStore(STORE_KEYS.semesters, all);
  }

  /* ============================================================
     FEES ENGINE
     ============================================================ */
  function getClassFees(){ return readStore(STORE_KEYS.classFees, {}) || {}; }
  function setClassFee(className, tuition, extra){
    const all = getClassFees();
    all[className] = { className, tuition: round2(tuition), extra: round2(extra), updatedAt: new Date().toISOString() };
    writeStore(STORE_KEYS.classFees, all);
  }
  function clearClassFee(className){
    const all = getClassFees();
    delete all[className];
    writeStore(STORE_KEYS.classFees, all);
  }
  function classFeeFor(className){ return getClassFees()[className] || null; }
  function classBilledTotal(className){
    const rec = classFeeFor(className);
    if(!rec) return 0;
    return round2(Number(rec.tuition || 0) + Number(rec.extra || 0));
  }
  function getAdjustments(){ return readStore(STORE_KEYS.adjustments, []) || []; }
  function discountFor(studentId){
    return getAdjustments().filter(a => a.studentId === studentId && !a.reversed)
      .reduce((s, a) => s + Number(a.amount || 0), 0);
  }
  function getPayments(){ return readStore(STORE_KEYS.payments, []) || []; }
  function paidFor(studentId){
    return getPayments().filter(p => p.studentId === studentId && !p.reversed)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  function studentFeeSummary(studentId, className){
    const billedBase = classBilledTotal(className);
    const discount   = discountFor(studentId);
    const paid       = paidFor(studentId);
    const netBill    = round2(billedBase - discount);
    const balance    = round2(netBill - paid);
    return { studentId, className, billedBase, discount, netBill, paid, balance,
      status: netBill <= 0 ? 'Paid' : paid >= netBill - 0.005 ? 'Paid' : paid > 0 ? 'Part-paid' : 'Pending' };
  }
  function recordPayment({ studentId, studentName, className, amount, method, date, reference, note }){
    const payments = getPayments();
    const u = currentUser();
    const row = {
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      studentId, studentName, className,
      amount: round2(amount), method: method || 'Cash',
      date: date || todayISO(), reference: reference || '', note: note || '',
      receiptNo: nextReceiptNumber('RCP'),
      receivedBy: u ? u.username : '',
      at: new Date().toISOString(), reversed: false
    };
    payments.push(row);
    writeStore(STORE_KEYS.payments, payments);
    return row;
  }
  function reversePayment(paymentId, reason){
    const list = getPayments();
    const p = list.find(x => x.id === paymentId);
    if(!p || p.reversed) return null;
    p.reversed = true;
    p.reversedAt = new Date().toISOString();
    p.reversedBy = (currentUser() || {}).username || '';
    p.reversalReason = reason || '';
    writeStore(STORE_KEYS.payments, list);
    return p;
  }
  function getReportThreshold(){
    const s = readStore(STORE_KEYS.settingsExtra, {}) || {};
    return { mode: s.thresholdMode || 'percent', value: Number(s.thresholdValue) || 0, enabled: !!s.thresholdEnabled };
  }
  function setReportThreshold(mode, value, enabled){
    const s = readStore(STORE_KEYS.settingsExtra, {}) || {};
    s.thresholdMode = mode; s.thresholdValue = Number(value) || 0; s.thresholdEnabled = !!enabled;
    writeStore(STORE_KEYS.settingsExtra, s);
  }
  function reportAccessFor(studentId, className){
    const t = getReportThreshold();
    if(!t.enabled) return { allowed:true, reason:'Threshold disabled', mode:t.mode, value:t.value, shortfall:0, paid:0, billed:0 };
    const s = studentFeeSummary(studentId, className);
    const required = t.mode === 'percent' ? s.netBill * t.value / 100 : t.value;
    const allowed = s.paid >= required - 0.005;
    return { allowed, required, paid: s.paid, billed: s.netBill, mode: t.mode, value: t.value,
      shortfall: Math.max(0, required - s.paid) };
  }
  function canOpenReportCard(studentId, className){
    const u = currentUser();
    if(!u) return { allowed:false, reason:'Not signed in', shortfall:0 };
    if(u.role === 'Principal' || u.role === 'Registrar' || u.role === 'Teacher'){
      return { allowed:true, staffBypass:true, shortfall:0 };
    }
    return reportAccessFor(studentId, className);
  }
  function viewerGradesheetAccess(){
    const u = currentUser();
    if(!u) return { allowed:false, reason:'Not signed in' };
    if(u.role === 'Principal' || u.role === 'Registrar' || u.role === 'Teacher'){
      return { allowed:true, staffBypass:true };
    }
    const t = getReportThreshold();
    if(!t.enabled) return { allowed:true, reason:'Threshold disabled' };
    const kids = u.role === 'Student'
      ? (readStore(STORE_KEYS.students, []) || []).filter(s => s.id === u.linkedStudentId)
      : childrenOf(u);
    if(!kids.length) return { allowed:true, reason:'No linked students' };
    const blocked = [];
    let totalShortfall = 0;
    kids.forEach(s => {
      const access = reportAccessFor(s.id, s.class);
      if(!access.allowed){
        blocked.push({ student: s, access, owed: access.shortfall });
        totalShortfall += access.shortfall;
      }
    });
    if(!blocked.length) return { allowed:true, checkedStudents: kids.length };
    return { allowed:false, mode: t.mode, value: t.value, blockedStudents: blocked, totalShortfall, checkedStudents: kids.length };
  }
  function renderGradesheetLocked(access, pageLabel){
    const kids = access.blockedStudents || [];
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;
        background:linear-gradient(135deg,#edf4fc,#dfeaf7);
        font-family:Arial,Helvetica,sans-serif;color:#23354d;padding:24px">
        <div style="width:100%;max-width:640px;background:#fff;border-radius:18px;
          box-shadow:0 25px 70px rgba(11,23,51,.18);overflow:hidden">
          <div style="padding:26px 30px;color:#fff;background:linear-gradient(120deg,#102949,#245d9c);border-top:5px solid #d88922">
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:52px;height:52px;border-radius:14px;background:#fff8e6;color:#a86414;display:grid;place-items:center;font-size:26px">🔒</div>
              <div>
                <h1 style="margin:0;font-size:19px;letter-spacing:.3px">${esc(pageLabel || 'Gradesheet')} is locked</h1>
                <p style="margin:5px 0 0;font-size:12px;color:#cfdcf5">Access requires meeting the school's fee threshold.</p>
              </div>
            </div>
          </div>
          <div style="padding:26px 30px">
            <p style="font-size:13px;color:#54637d;line-height:1.7;margin:0 0 16px">
              Your account is not permitted to open the
              <strong>${esc(pageLabel || 'Gradesheet')}</strong> because the payment threshold has not been met for:
            </p>
            ${kids.map(x => {
              const s = x.student, a = x.access;
              const pct = a.billed > 0 ? Math.min(100, Math.round(a.paid / a.billed * 100)) : 0;
              return `<div style="border:1px solid #e8ebf2;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fbfdff">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
                  <div>
                    <div style="font-size:13px;font-weight:800;color:#12315a">${esc(s.name)}</div>
                    <div style="font-size:11px;color:#73849a;margin-top:3px">${esc(s.class)} · ${esc(s.id)}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:10px;color:#73849a;text-transform:uppercase;letter-spacing:.6px;font-weight:800;margin-bottom:3px">Amount owed</div>
                    <div style="font-family:monospace;font-weight:800;color:#d64545;font-size:15px">${money(a.shortfall)}</div>
                  </div>
                </div>
                <div style="height:8px;background:#eef1f7;border-radius:20px;overflow:hidden;margin-top:10px">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#3987ee,#14805e);border-radius:20px"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#73849a;margin-top:6px">
                  <span>Paid ${money(a.paid)} of ${money(a.billed)} · ${pct}%</span>
                  <span>Required: ${a.mode === 'percent' ? a.value + '%' : money(a.value)}</span>
                </div>
              </div>`;
            }).join('')}
            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px">
              <a href="index.html" style="display:inline-block;background:#eef2fb;color:#34415c;padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:700;font-size:12px">← Back to Dashboard</a>
              <a href="fees.html" style="display:inline-block;background:#3987ee;color:#fff;padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:700;font-size:12px">＄ Go to Fees &amp; Payments</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     PAYROLL
     ============================================================ */
  function getSalaryPayments(){ return readStore(STORE_KEYS.salaryPayments, []) || []; }
  function computeSalary({ totalSalary, advance, taxPercent }){
    const total = round2(totalSalary);
    const adv   = round2(advance || 0);
    const pct   = Math.max(0, Math.min(100, Number(taxPercent) || 0));
    const tax   = round2(total * pct / 100);
    const net   = round2(total - adv - tax);
    return { total, advance: adv, taxPercent: pct, taxAmount: tax, netBalance: net };
  }
  function recordSalary({ teacherId, teacherName, totalSalary, advance, taxPercent, method, date, reference, note }){
    const calc = computeSalary({ totalSalary, advance, taxPercent });
    const u = currentUser();
    const list = getSalaryPayments();
    const row = {
      id: 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      teacherId, teacherName,
      totalSalary: calc.total, advance: calc.advance,
      taxPercent: calc.taxPercent, taxAmount: calc.taxAmount, netBalance: calc.netBalance,
      method: method || 'Bank transfer', date: date || todayISO(),
      reference: reference || '', note: note || '',
      receiptNo: nextReceiptNumber('SAL'),
      createdAt: new Date().toISOString(),
      createdBy: u ? u.username : '', reversed: false
    };
    list.push(row);
    writeStore(STORE_KEYS.salaryPayments, list);
    return row;
  }
  function reverseSalary(salaryId, reason){
    const list = getSalaryPayments();
    const s = list.find(x => x.id === salaryId);
    if(!s || s.reversed) return null;
    s.reversed = true;
    s.reversedAt = new Date().toISOString();
    s.reversedBy = (currentUser() || {}).username || '';
    s.reversalReason = reason || '';
    writeStore(STORE_KEYS.salaryPayments, list);
    return s;
  }
  function nextReceiptNumber(prefix){
    const key = 'educoreReceiptSeq_' + (prefix || 'RCP');
    const y = new Date().getFullYear();
    const raw = readStore(key, { year: y, seq: 0 }) || { year: y, seq: 0 };
    if(raw.year !== y){ raw.year = y; raw.seq = 0; }
    raw.seq += 1;
    writeStore(key, raw);
    const p = prefix || 'RCP';
    return `${p}-${y}-${String(raw.seq).padStart(4, '0')}`;
  }

  /* ============================================================
     ANNOUNCEMENTS
     ============================================================ */
  function announcementVisibleTo(a, viewer){
    if(!a) return false;
    const u = viewer || currentUser();
    if(!u) return false;
    if(u.role === 'Principal' || u.role === 'Registrar') return true;
    const aud = String(a.audience || 'All').trim();
    if(aud === 'All') return true;
    if(aud === 'Staff') return u.role === 'Teacher';
    if(aud === 'Students') return u.role === 'Student';
    if(aud === 'Parents') return u.role === 'Parent';
    return false;
  }
  function announcementIsLive(a){
    if(!a) return false;
    if(a.deleted) return false;
    const now = Date.now();
    if(a.publishAt){ const t = new Date(a.publishAt).getTime(); if(Number.isFinite(t) && t > now) return false; }
    if(a.expiresAt){ const t = new Date(a.expiresAt).getTime(); if(Number.isFinite(t) && t < now) return false; }
    return true;
  }
  function getAnnouncementReads(){ return readStore(STORE_KEYS.announcementReads, []) || []; }
  function hasReadAnnouncement(announcementId, userId){
    const u = userId || (currentUser() || {}).id;
    if(!u) return false;
    return getAnnouncementReads().some(r => r.announcementId === announcementId && r.userId === u);
  }
  function markAnnouncementRead(announcementId){
    const u = currentUser();
    if(!u) return null;
    const list = getAnnouncementReads();
    if(list.some(r => r.announcementId === announcementId && r.userId === u.id)) return null;
    const row = {
      id: 'ar-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      announcementId, userId: u.id, username: u.username, readAt: new Date().toISOString()
    };
    list.push(row);
    writeStore(STORE_KEYS.announcementReads, list);
    return row;
  }
  function readCountFor(announcementId){ return getAnnouncementReads().filter(r => r.announcementId === announcementId).length; }
  function getAnnouncementAcks(){ return readStore(STORE_KEYS.announcementAcks, []) || []; }
  function hasAcknowledged(announcementId, userId){
    const u = userId || (currentUser() || {}).id;
    if(!u) return false;
    return getAnnouncementAcks().some(r => r.announcementId === announcementId && r.userId === u);
  }
  function acknowledgeAnnouncement(announcementId, note){
    const u = currentUser();
    if(!u) return null;
    const list = getAnnouncementAcks();
    if(list.some(r => r.announcementId === announcementId && r.userId === u.id)) return null;
    const row = {
      id: 'ak-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      announcementId, userId: u.id, username: u.username,
      name: u.name || u.username, note: note || '', at: new Date().toISOString()
    };
    list.push(row);
    writeStore(STORE_KEYS.announcementAcks, list);
    return row;
  }
  function ackCountFor(announcementId){ return getAnnouncementAcks().filter(r => r.announcementId === announcementId).length; }
  function unreadAnnouncementCount(viewer){
    const u = viewer || currentUser();
    if(!u) return 0;
    const list = readStore(STORE_KEYS.announcements, []) || [];
    const visible = list.filter(a => announcementVisibleTo(a, u) && announcementIsLive(a));
    return visible.filter(a => !hasReadAnnouncement(a.id, u.id)).length;
  }
  function audienceSizeFor(announcement){
    const u = currentUser();
    if(!u) return 0;
    const users = readStore(STORE_KEYS.users, []) || [];
    const aud = announcement.audience || 'All';
    return users.filter(x => {
      if(!x.active) return false;
      if(x.role === 'Principal' || x.role === 'Registrar') return false;
      if(aud === 'All') return ['Teacher','Student','Parent'].includes(x.role);
      if(aud === 'Staff') return x.role === 'Teacher';
      if(aud === 'Students') return x.role === 'Student';
      if(aud === 'Parents') return x.role === 'Parent';
      return false;
    }).length;
  }

  /* ============================================================
     QUIZZES
     ============================================================ */
  const QUESTION_TYPES = [
    { key:'multiple-choice', label:'Multiple choice',  auto:true,  hint:'One correct option' },
    { key:'true-false',      label:'True / False',     auto:true,  hint:'Two options' },
    { key:'numeric',         label:'Numeric',          auto:true,  hint:'Auto-graded against a target value (± tolerance)' },
    { key:'short-answer',    label:'Short answer',     auto:false, hint:'Manually graded by the teacher' },
    { key:'essay',           label:'Essay',            auto:false, hint:'Long-form, manually graded' }
  ];
  function questionTypeMeta(key){ return QUESTION_TYPES.find(t => t.key === key) || QUESTION_TYPES[0]; }
  function getQuizzes(){ return readStore(STORE_KEYS.quizzes, []) || []; }
  function saveQuiz(q){
    const list = getQuizzes();
    const u = currentUser();
    const idx = list.findIndex(x => x.id === q.id);
    if(idx >= 0){
      list[idx] = Object.assign({}, list[idx], q, { updatedAt: new Date().toISOString() });
    } else {
      list.push(Object.assign({
        id: 'qz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
        createdAt: new Date().toISOString(),
        createdBy: u ? u.username : '', published: false, assignedTo: []
      }, q));
    }
    writeStore(STORE_KEYS.quizzes, list);
    return idx >= 0 ? list[idx] : list[list.length - 1];
  }
  function getQuiz(id){ return getQuizzes().find(q => q.id === id) || null; }
  function deleteQuiz(id){
    writeStore(STORE_KEYS.quizzes, getQuizzes().filter(q => q.id !== id));
    writeStore(STORE_KEYS.quizQuestions, getQuizQuestions().filter(q => q.quizId !== id));
    writeStore(STORE_KEYS.quizAttempts, getQuizAttempts().filter(a => a.quizId !== id));
  }
  function getQuizQuestions(){ return readStore(STORE_KEYS.quizQuestions, []) || []; }
  function questionsForQuiz(quizId){
    return getQuizQuestions().filter(q => q.quizId === quizId).sort((a,b) => Number(a.order || 0) - Number(b.order || 0));
  }
  function saveQuestion(q){
    const list = getQuizQuestions();
    const isNew = !q.id || !list.some(x => x.id === q.id);
    const u = currentUser();
    const id = isNew ? ('qq-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6)) : q.id;
    const payload = Object.assign({}, q, { id, updatedAt: new Date().toISOString(), updatedBy: u ? u.username : '' });
    if(isNew){ payload.createdAt = new Date().toISOString(); list.push(payload); }
    else { const idx = list.findIndex(x => x.id === id); list[idx] = Object.assign({}, list[idx], payload); }
    writeStore(STORE_KEYS.quizQuestions, list);
    return list.find(x => x.id === id);
  }
  function deleteQuestion(id){ writeStore(STORE_KEYS.quizQuestions, getQuizQuestions().filter(q => q.id !== id)); }
  function quizTotalMarks(quizId){ return questionsForQuiz(quizId).reduce((s, q) => s + Number(q.points || 0), 0); }
  function quizIsReady(quizId){
    const qs = questionsForQuiz(quizId);
    if(!qs.length) return { ok:false, reason:'No questions yet.' };
    for(const q of qs){
      if(!q.text || !String(q.text).trim()) return { ok:false, reason:'A question is missing its text.' };
      if(q.type === 'multiple-choice'){
        if(!Array.isArray(q.options) || q.options.length < 2) return { ok:false, reason:'A multiple-choice question needs at least 2 options.' };
        if(!q.options.some(o => o.isCorrect)) return { ok:false, reason:'A multiple-choice question has no correct answer marked.' };
      }
      if(q.type === 'numeric' && (q.numericAnswer === '' || q.numericAnswer === null || q.numericAnswer === undefined)){
        return { ok:false, reason:'A numeric question has no target answer.' };
      }
    }
    return { ok:true };
  }
  function getQuizAttempts(){ return readStore(STORE_KEYS.quizAttempts, []) || []; }
  function saveAttempt(a){
    const list = getQuizAttempts();
    const idx = list.findIndex(x => x.id === a.id);
    if(idx >= 0) list[idx] = Object.assign({}, list[idx], a);
    else list.push(a);
    writeStore(STORE_KEYS.quizAttempts, list);
    return a;
  }
  function createAttempt(quiz, student){
    const u = currentUser();
    const attempt = {
      id: 'qa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      quizId: quiz.id, studentId: student.id, studentName: student.name, className: student.class,
      startedAt: new Date().toISOString(), submittedAt: null, score: null,
      totalMarks: quizTotalMarks(quiz.id), percentage: null, status: 'in-progress',
      suspicionEvents: 0, autoSubmitted: false, graded: false,
      gradedBy: null, gradedAt: null, createdBy: u ? u.username : ''
    };
    saveAttempt(attempt);
    return attempt;
  }
  function existingAttemptFor(quizId, studentId){
    return getQuizAttempts().find(a => a.quizId === quizId && a.studentId === studentId && a.status !== 'reset') || null;
  }
  function resetAttempt(attemptId){
    const list = getQuizAttempts();
    const at = list.find(x => x.id === attemptId);
    if(!at) return null;
    at.status = 'reset';
    at.resetAt = new Date().toISOString();
    at.resetBy = (currentUser() || {}).username || '';
    writeStore(STORE_KEYS.quizAttempts, list);
    writeStore(STORE_KEYS.quizResponses, getQuizResponses().filter(r => r.attemptId !== attemptId));
    return at;
  }
  function getQuizResponses(){ return readStore(STORE_KEYS.quizResponses, []) || []; }
  function responsesForAttempt(attemptId){ return getQuizResponses().filter(r => r.attemptId === attemptId); }
  function saveResponse(resp){
    const list = getQuizResponses();
    const idx = list.findIndex(r => r.attemptId === resp.attemptId && r.questionId === resp.questionId);
    const payload = Object.assign({
      id: 'qr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      answeredAt: new Date().toISOString()
    }, resp);
    if(idx >= 0) list[idx] = Object.assign({}, list[idx], resp, { answeredAt: new Date().toISOString() });
    else list.push(payload);
    writeStore(STORE_KEYS.quizResponses, list);
    return payload;
  }
  function gradeResponse(question, resp){
    const q = question;
    const max = Number(q.points || 0);
    if(q.type === 'multiple-choice'){
      const correct = (q.options || []).find(o => o.isCorrect);
      const isCorrect = !!(resp.selectedOptionId && correct && resp.selectedOptionId === correct.id);
      return { isCorrect, awardedPoints: isCorrect ? max : 0 };
    }
    if(q.type === 'true-false'){
      const correct = String(q.tfAnswer || '').toLowerCase();
      const given = String(resp.answerText || '').trim().toLowerCase();
      const isCorrect = correct && given === correct;
      return { isCorrect, awardedPoints: isCorrect ? max : 0 };
    }
    if(q.type === 'numeric'){
      const target = Number(q.numericAnswer);
      const tol = Number(q.tolerance || 0);
      const given = Number(resp.answerText);
      const isCorrect = Number.isFinite(given) && Number.isFinite(target) && Math.abs(given - target) <= tol;
      return { isCorrect, awardedPoints: isCorrect ? max : 0 };
    }
    return { isCorrect: null, awardedPoints: null };
  }
  function computeAttemptScore(attemptId){
    const at = getQuizAttempts().find(a => a.id === attemptId);
    if(!at) return null;
    const qs = questionsForQuiz(at.quizId);
    const responses = responsesForAttempt(attemptId);
    let autoScore = 0, autoMax = 0, manualScore = 0, manualMax = 0, pendingManual = 0;
    qs.forEach(q => {
      const resp = responses.find(r => r.questionId === q.id) || {};
      const max = Number(q.points || 0);
      const meta = questionTypeMeta(q.type);
      if(meta.auto){
        autoMax += max;
        const g = gradeResponse(q, resp);
        autoScore += Number(g.awardedPoints || 0);
      } else {
        manualMax += max;
        if(resp.manualPoints !== undefined && resp.manualPoints !== null) manualScore += Number(resp.manualPoints || 0);
        else pendingManual += 1;
      }
    });
    const total = round2(autoScore + manualScore);
    const max = round2(autoMax + manualMax);
    return { autoScore: round2(autoScore), autoMax: round2(autoMax),
      manualScore: round2(manualScore), manualMax: round2(manualMax),
      pendingManual, total, max, percentage: max > 0 ? round2(total / max * 100) : 0 };
  }
  function submitAttempt(attemptId, auto){
    const at = getQuizAttempts().find(a => a.id === attemptId);
    if(!at) return null;
    const score = computeAttemptScore(attemptId);
    at.submittedAt = new Date().toISOString();
    at.score = score.total;
    at.totalMarks = score.max;
    at.percentage = score.percentage;
    at.autoSubmitted = !!auto;
    at.status = score.pendingManual > 0 ? 'pending-manual' : 'graded';
    at.graded = score.pendingManual === 0;
    saveAttempt(at);
    return at;
  }
  function setManualPoints(attemptId, questionId, points){
    const list = getQuizResponses();
    const idx = list.findIndex(r => r.attemptId === attemptId && r.questionId === questionId);
    const u = currentUser();
    if(idx >= 0){
      list[idx].manualPoints = Number(points);
      list[idx].manualGradedAt = new Date().toISOString();
      list[idx].manualGradedBy = u ? u.username : '';
    } else {
      list.push({ id: 'qr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
        attemptId, questionId, selectedOptionId: null, answerText: '', isCorrect: null, awardedPoints: null,
        manualPoints: Number(points), manualGradedAt: new Date().toISOString(),
        manualGradedBy: u ? u.username : '', answeredAt: new Date().toISOString() });
    }
    writeStore(STORE_KEYS.quizResponses, list);
    const at = getQuizAttempts().find(a => a.id === attemptId);
    if(at){
      const score = computeAttemptScore(attemptId);
      at.score = score.total;
      at.totalMarks = score.max;
      at.percentage = score.percentage;
      at.status = score.pendingManual > 0 ? 'pending-manual' : 'graded';
      at.graded = score.pendingManual === 0;
      at.gradedAt = at.graded ? new Date().toISOString() : at.gradedAt;
      at.gradedBy = at.graded ? (u ? u.username : '') : at.gradedBy;
      saveAttempt(at);
    }
    return true;
  }
  function quizAssignedToStudent(quiz, student){
    if(!quiz || !student) return false;
    if(!Array.isArray(quiz.assignedTo) || !quiz.assignedTo.length) return true;
    return quiz.assignedTo.includes(student.id);
  }
  function canTakeQuiz(quiz, student){
    if(!quiz || !student) return { ok:false, reason:'Missing quiz or student.' };
    if(!quiz.published) return { ok:false, reason:'This quiz has not been published yet.' };
    if(quiz.className && quiz.className !== student.class) return { ok:false, reason:'This quiz is not assigned to your class.' };
    if(!quizAssignedToStudent(quiz, student)) return { ok:false, reason:'This quiz was not assigned to you.' };
    if(quiz.dueDate){
      const due = new Date(quiz.dueDate + 'T23:59:59').getTime();
      if(Date.now() > due) return { ok:false, reason:'This quiz is past its due date.' };
    }
    const ready = quizIsReady(quiz.id);
    if(!ready.ok) return { ok:false, reason:'Quiz is not ready: ' + ready.reason };
    const existing = existingAttemptFor(quiz.id, student.id);
    if(existing){
      if(existing.status === 'in-progress') return { ok:false, reason:'You have an in-progress attempt.', attempt: existing };
      return { ok:false, reason:'You have already taken this quiz.', attempt: existing };
    }
    return { ok:true };
  }
  function quizResultsCSV(quizId, opts){
    opts = opts || {};
    const quiz = getQuiz(quizId);
    if(!quiz) return { ok:false, error:'Quiz not found.' };
    const questions = questionsForQuiz(quizId);
    const attempts = getQuizAttempts()
      .filter(a => a.quizId === quizId && a.status !== 'reset')
      .filter(a => !opts.classId || a.className === opts.classId)
      .sort((a,b) => a.studentName.localeCompare(b.studentName));
    if(!attempts.length) return { ok:false, error:'No attempts to export for this filter.' };
    const headers = ['Student Name','Student ID','Class','Started','Submitted','Auto-submitted',
      'Status','Score','Total Marks','Percentage','Pass/Fail','Tab switches',
      ...questions.map((q, i) => `Q${i+1} (${q.points}m)`),
      ...questions.map((q, i) => `Q${i+1} awarded`),
      'Correct','Incorrect','Pending manual'];
    const passMark = Number(quiz.passMark || 50);
    const rows = attempts.map(a => {
      const responses = responsesForAttempt(a.id);
      const questionCells = questions.map(q => {
        const r = responses.find(x => x.questionId === q.id) || {};
        if(q.type === 'multiple-choice'){ const sel = (q.options || []).find(o => o.id === r.selectedOptionId); return sel ? sel.text : ''; }
        if(q.type === 'true-false') return r.answerText || '';
        return String(r.answerText || '').slice(0, 200);
      });
      const awardedCells = questions.map(q => {
        const r = responses.find(x => x.questionId === q.id) || {};
        const meta = questionTypeMeta(q.type);
        if(meta.auto){ const g = gradeResponse(q, r); return g.awardedPoints ?? ''; }
        return r.manualPoints ?? '';
      });
      const correctCount = questions.filter(q => {
        const r = responses.find(x => x.questionId === q.id) || {};
        if(!questionTypeMeta(q.type).auto) return false;
        return gradeResponse(q, r).isCorrect === true;
      }).length;
      const incorrectCount = questions.filter(q => {
        const r = responses.find(x => x.questionId === q.id) || {};
        if(!questionTypeMeta(q.type).auto) return false;
        return gradeResponse(q, r).isCorrect === false;
      }).length;
      const pending = questions.filter(q => {
        const r = responses.find(x => x.questionId === q.id) || {};
        if(questionTypeMeta(q.type).auto) return false;
        return r.manualPoints === undefined || r.manualPoints === null;
      }).length;
      return [a.studentName, a.studentId, a.className,
        a.startedAt ? new Date(a.startedAt).toISOString() : '',
        a.submittedAt ? new Date(a.submittedAt).toISOString() : '',
        a.autoSubmitted ? 'Yes' : 'No', a.status,
        a.score != null ? a.score : '', a.totalMarks != null ? a.totalMarks : '',
        a.percentage != null ? a.percentage : '',
        a.percentage != null ? (a.percentage >= passMark ? 'Pass' : 'Fail') : '',
        a.suspicionEvents || 0,
        ...questionCells, ...awardedCells,
        correctCount, incorrectCount, pending];
    });
    const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    return { ok:true, csv, count: attempts.length };
  }

  /* ============================================================
     ARCHIVE ENGINE
     ============================================================ */
  function readArchives(){ return readStore(STORE_KEYS.archives, {}) || {}; }
  function writeArchives(obj){ writeStore(STORE_KEYS.archives, obj); }
  function archiveList(){
    return Object.values(readArchives()).sort((a,b) => new Date(b.closedAt) - new Date(a.closedAt));
  }
  function isArchiveEditable(year){
    const ar = readArchives()[year];
    return !!(ar && ar.kind === 'full-year');
  }
  function canEditArchive(){
    const u = currentUser();
    if(!u) return false;
    if(u.role !== 'Principal' && u.role !== 'Registrar') return false;
    return hasPerm('archive.edit');
  }
  function takeSnapshot(){
    return {
      students: readStore(STORE_KEYS.students, []) || [],
      results: readStore(STORE_KEYS.results, []) || [],
      attendance: readStore(STORE_KEYS.attendance, {}) || {},
      classes: readStore(STORE_KEYS.classes, []) || [],
      classFees: readStore(STORE_KEYS.classFees, {}) || {},
      adjustments: readStore(STORE_KEYS.adjustments, []) || [],
      assignments: readStore(STORE_KEYS.assignments, []) || [],
      sponsors: readStore(STORE_KEYS.sponsors, {}) || {},
      payments: readStore(STORE_KEYS.payments, []) || [],
      salaryPayments: readStore(STORE_KEYS.salaryPayments, []) || [],
      quizzes: readStore(STORE_KEYS.quizzes, []) || [],
      quizQuestions: readStore(STORE_KEYS.quizQuestions, []) || [],
      quizAttempts: readStore(STORE_KEYS.quizAttempts, []) || [],
      quizResponses: readStore(STORE_KEYS.quizResponses, []) || [],
      enrollments: readStore(STORE_KEYS.enrollments, []) || [],
      semesters: readStore(STORE_KEYS.semesters, {}) || {},
      terms: readStore(STORE_KEYS.terms, {}) || {},
      timetable: readStore(STORE_KEYS.timetable, null),
      timetableSettings: readStore(STORE_KEYS.timetableSettings, null),
      gradePushes: readStore(STORE_KEYS.gradePushes, []) || []
    };
  }
  function studentYearlyAverage(student, year){
    const y = year || currentAcademicYear();
    const recs = (readStore(STORE_KEYS.results, []) || [])
      .filter(r => r.student === student.name && r.class === student.class && (r.year === y || !r.year));
    const subjects = Array.from(new Set(recs.map(r => subjectName(r.subject) || r.subject)));
    if(!subjects.length) return null;
    const category = classCategoryFor(student.class);
    const avgs = subjects.map(sub => yearlyAverageFor(student.name, student.class, sub, category, y))
      .filter(Boolean).map(x => x.number);
    if(!avgs.length) return null;
    return round2(avgs.reduce((a,b) => a+b, 0) / avgs.length);
  }
  function nextCategory(category){
    const idx = CATEGORY_LIST.indexOf(category);
    if(idx < 0) return null;
    if(idx === CATEGORY_LIST.length - 1) return 'Graduated';
    return CATEGORY_LIST[idx + 1];
  }
  function findClassForCategory(category, currentClassName){
    const classes = getClasses();
    if(category === 'Graduated') return null;
    const sectionMatch = String(currentClassName || '').match(/([A-Za-z])\s*$/);
    const section = sectionMatch ? sectionMatch[1].toUpperCase() : '';
    if(section){
      const match = classes.find(c => c.category === category && new RegExp(section + '\\s*$', 'i').test(c.name));
      if(match) return match.name;
    }
    const fallback = classes.find(c => c.category === category);
    return fallback ? fallback.name : null;
  }
  function endAcademicYear(){
    const u = currentUser();
    const year = currentAcademicYear();
    const archives = readArchives();
    if(archives[year]) return { ok:false, error:`${year} is already archived.` };
    const students = readStore(STORE_KEYS.students, []) || [];
    const summary = { students: students.length, promoted: 0, repeated: 0, graduated: 0, noGrades: 0 };
    const promotionLog = [];
    const snapshot = takeSnapshot();
    const updatedStudents = students.map(s => {
      const avg = studentYearlyAverage(s, year);
      const category = classCategoryFor(s.class);
      const passThreshold = Number((classByName(s.class) || {}).passMark ?? 50);
      if(avg == null){
        summary.noGrades += 1;
        promotionLog.push({ studentId: s.id, name: s.name, from: s.class, to: s.class, avg: null, reason: 'No grades recorded' });
        return s;
      }
      if(avg >= passThreshold){
        const nextCat = nextCategory(category);
        if(nextCat === 'Graduated'){
          summary.graduated += 1;
          promotionLog.push({ studentId: s.id, name: s.name, from: s.class, to: 'Graduated', avg, reason: 'Promoted' });
          return Object.assign({}, s, { class: 'Graduated', status: 'Graduated' });
        }
        const newClass = findClassForCategory(nextCat, s.class);
        if(newClass){
          summary.promoted += 1;
          promotionLog.push({ studentId: s.id, name: s.name, from: s.class, to: newClass, avg, reason: 'Promoted' });
          return Object.assign({}, s, { class: newClass });
        }
        summary.noGrades += 1;
        promotionLog.push({ studentId: s.id, name: s.name, from: s.class, to: s.class, avg, reason: 'No next class found for ' + nextCat });
        return s;
      }
      summary.repeated += 1;
      promotionLog.push({ studentId: s.id, name: s.name, from: s.class, to: s.class, avg, reason: 'Below pass mark — repeating' });
      return s;
    });
    writeStore(STORE_KEYS.students, updatedStudents);
    archives[year] = {
      id: 'ar-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      year, closedAt: new Date().toISOString(),
      closedBy: u ? u.username : 'system',
      kind: 'full-year', summary, promotionLog, snapshot
    };
    writeArchives(archives);
    ['results','attendance','quizAttempts','quizResponses','quizzes','quizQuestions',
     'classFees','assignments','sponsors','semesters','terms','timetable','gradePushes'].forEach(k => {
      writeStore(STORE_KEYS[k], k === 'attendance' || k === 'classFees' || k === 'sponsors' || k === 'semesters' || k === 'terms' ? {} : []);
    });
    const settings = readStore(STORE_KEYS.settings, {}) || {};
    const [startYear, endYear] = year.split('/').map(Number);
    const nextYear = Number.isFinite(startYear) && Number.isFinite(endYear) ? `${startYear + 1}/${endYear + 1}` : year;
    settings.academicYear = nextYear;
    writeStore(STORE_KEYS.settings, settings);
    audit('update', `Archive ${year}`, '', `closed · ${summary.promoted} promoted · ${summary.repeated} repeated · ${summary.graduated} graduated`);
    return { ok:true, year, nextYear, summary, promotionLog };
  }
  function endSemester(semesterNumber){
    const u = currentUser();
    const year = currentAcademicYear();
    const key = `${year}|S${Number(semesterNumber)}`;
    const archives = readArchives();
    if(archives[key]) return { ok:false, error:`${year} · Semester ${semesterNumber} is already archived.` };
    setSemesterLock(semesterNumber, true, year);
    const snapshot = takeSnapshot();
    archives[key] = {
      id: 'ar-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      year, semester: Number(semesterNumber),
      closedAt: new Date().toISOString(), closedBy: u ? u.username : 'system',
      kind: 'semester',
      summary: { students: (readStore(STORE_KEYS.students, []) || []).length, results: (snapshot.results || []).length },
      snapshot
    };
    writeArchives(archives);
    audit('update', `Archive ${year} Sem ${semesterNumber}`, '', 'semester closed');
    return { ok:true, year, semester: semesterNumber };
  }
  function restoreArchive(year){
    const all = readArchives();
    const ar = all[year];
    if(!ar) return { ok:false, error:'Archive not found.' };
    if(ar.kind !== 'full-year') return { ok:false, error:'Only full-year archives can be restored to live.' };
    const snap = ar.snapshot || {};
    const map = {
      students: STORE_KEYS.students, results: STORE_KEYS.results, attendance: STORE_KEYS.attendance,
      classes: STORE_KEYS.classes, classFees: STORE_KEYS.classFees, adjustments: STORE_KEYS.adjustments,
      assignments: STORE_KEYS.assignments, sponsors: STORE_KEYS.sponsors, payments: STORE_KEYS.payments,
      salaryPayments: STORE_KEYS.salaryPayments, quizzes: STORE_KEYS.quizzes,
      quizQuestions: STORE_KEYS.quizQuestions, quizAttempts: STORE_KEYS.quizAttempts,
      quizResponses: STORE_KEYS.quizResponses, enrollments: STORE_KEYS.enrollments,
      semesters: STORE_KEYS.semesters, terms: STORE_KEYS.terms,
      timetable: STORE_KEYS.timetable, timetableSettings: STORE_KEYS.timetableSettings,
      gradePushes: STORE_KEYS.gradePushes
    };
    Object.entries(map).forEach(([k, storeKey]) => {
      if(snap[k] !== undefined) writeStore(storeKey, snap[k]);
    });
    const settings = readStore(STORE_KEYS.settings, {}) || {};
    settings.academicYear = year;
    writeStore(STORE_KEYS.settings, settings);
    audit('update', `Restore archive ${year}`, '', 'restored');
    return { ok:true, year };
  }
  function deleteArchive(key){
    const all = readArchives();
    if(!all[key]) return { ok:false };
    delete all[key];
    writeArchives(all);
    audit('delete', `Archive ${key}`, '', '');
    return { ok:true };
  }
  function getArchive(year){ return readArchives()[year] || null; }
  function updateArchivedResult(archiveYear, payload){
    const { student, className, subject, semester, period, score } = payload || {};
    const all = readArchives();
    const ar = all[archiveYear];
    if(!ar) return { ok:false, error:'Archive not found.' };
    if(ar.kind !== 'full-year') return { ok:false, error:'Only full-year archives can be edited.' };
    if(!ar.snapshot) ar.snapshot = {};
    const clsCategory = classCategoryFor(className);
    const v = validateScore(score, clsCategory);
    if(!v.ok) return { ok:false, error: v.error };
    const list = ar.snapshot.results || [];
    const targetSubj = normSubject(subject);
    const idx = list.findIndex(r =>
      r.student === student && r.class === className &&
      normSubject(r.subject) === targetSubj &&
      String(r.period) === String(period) && Number(r.semester) === Number(semester) &&
      (r.year === archiveYear || !r.year));
    const u = currentUser();
    const row = {
      student, class: className,
      subject: subjectName(subject) || subject,
      year: archiveYear,
      semester: Number(semester), period: period, score: v.normalized,
      updatedAt: new Date().toISOString(), updatedBy: u ? u.username : ''
    };
    if(idx >= 0) list[idx] = Object.assign({}, list[idx], row);
    else {
      if(v.normalized === '') return { ok:true, skipped:true };
      list.push(Object.assign({ id: 'r-arch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6) }, row));
    }
    ar.snapshot.results = list;
    all[archiveYear] = ar;
    writeArchives(all);
    audit('update', `Archive ${archiveYear} result`, '', `${student} · ${subject} · ${period}`);
    return { ok:true };
  }
  function deleteArchivedResult(archiveYear, { student, className, subject, semester, period }){
    const all = readArchives();
    const ar = all[archiveYear];
    if(!ar) return { ok:false };
    if(ar.kind !== 'full-year') return { ok:false, error:'Only full-year archives can be edited.' };
    const list = ar.snapshot.results || [];
    const targetSubj = normSubject(subject);
    ar.snapshot.results = list.filter(r =>
      !(r.student === student && r.class === className &&
        normSubject(r.subject) === targetSubj &&
        String(r.period) === String(period) && Number(r.semester) === Number(semester)));
    all[archiveYear] = ar;
    writeArchives(all);
    audit('delete', `Archive ${archiveYear} result`, `${student} · ${subject}`, '');
    return { ok:true };
  }
  function archivedLedgerRow(archiveYear, student, subject){
    const ar = getArchive(archiveYear);
    if(!ar) return null;
    const cat = classCategoryFor(student.class);
    const targetSubj = normSubject(subject);
    const rows = (ar.snapshot.results || []).filter(r =>
      r.student === student.name && r.class === student.class &&
      normSubject(r.subject) === targetSubj);
    const getScore = (semester, period) => {
      const r = rows.find(x => Number(x.semester) === Number(semester) && String(x.period) === String(period));
      return r ? r.score : '';
    };
    const p1 = getScore(1,1), p2 = getScore(1,2), p3 = getScore(1,3), e1 = getScore(1,'e1');
    const p4 = getScore(2,4), p5 = getScore(2,5), p6 = getScore(2,6), e2 = getScore(2,'e2');
    const w = weightConfig();
    const calcAvg = (periodVals, examVal) => {
      const nonEmpty = periodVals.filter(v => v !== '' && v !== null && v !== undefined);
      const periodMean = nonEmpty.length ? averageScores(nonEmpty, cat).number : null;
      const examNum = (() => {
        if(examVal === '' || examVal === undefined || examVal === null) return null;
        if(typeof examVal === 'string' && /^[A-Fa-f]$/.test(examVal.trim())) return midpointForLetter(examVal, cat);
        const n = Number(examVal);
        return Number.isFinite(n) ? n : null;
      })();
      let mean;
      if(periodMean != null && examNum != null) mean = periodMean * w.periodWeight + examNum * w.examWeight;
      else if(periodMean != null) mean = periodMean;
      else mean = examNum;
      if(mean == null) return null;
      return { letter: gradeFromNumber(mean, cat), number: mean };
    };
    const s1Avg = calcAvg([p1,p2,p3], e1);
    const s2Avg = calcAvg([p4,p5,p6], e2);
    const yearly = (() => {
      if(s1Avg && s2Avg){ const mean = s1Avg.number * w.semesterWeight + s2Avg.number * (1 - w.semesterWeight); return { letter: gradeFromNumber(mean, cat), number: mean }; }
      if(s1Avg) return s1Avg;
      if(s2Avg) return s2Avg;
      return null;
    })();
    return { subject, p1, p2, p3, e1, s1Avg, p4, p5, p6, e2, s2Avg, yearly };
  }
  function archivedResultsForStudent(studentName){
    const all = readArchives();
    const out = [];
    Object.values(all).filter(ar => ar.kind === 'full-year')
      .sort((a,b) => new Date(b.closedAt) - new Date(a.closedAt))
      .forEach(ar => {
        const rows = (ar.snapshot?.results || []).filter(r => r.student === studentName);
        if(rows.length){
          out.push({ year: ar.year, closedAt: ar.closedAt, editable: isArchiveEditable(ar.year),
            results: rows, attendance: (ar.snapshot?.attendance || {}) });
        }
      });
    return out;
  }
  function reportCardSource({ studentId, year, approvedOnly }){
    const y = year || currentAcademicYear();
    const all = readStore(STORE_KEYS.students, []) || [];
    const liveStudent = all.find(s => s.id === studentId);
    const ar = readArchives()[y];
    if(!ar){
      if(!liveStudent) return { ok:false, error:'Student not found.' };
      let results = (readStore(STORE_KEYS.results, []) || [])
        .filter(r => r.student === liveStudent.name && r.class === liveStudent.class && (r.year === y || !r.year));
      if(approvedOnly) results = filterResultsByApproval(results, { approvedOnly:true });
      return { ok:true, source:'live', year: y, student: liveStudent, classAtTime: liveStudent.class,
        results, attendance: readStore(STORE_KEYS.attendance, {}) || {} };
    }
    const snap = ar.snapshot || {};
    let classAtTime = null;
    if(liveStudent && Array.isArray(ar.promotionLog)){
      const entry = ar.promotionLog.find(p => p.studentId === studentId);
      if(entry) classAtTime = entry.from;
    }
    if(!classAtTime){
      const recs = (snap.results || []).filter(r => r.student === (liveStudent?.name || ''));
      if(recs.length) classAtTime = recs[0].class;
    }
    const snapStudent = (snap.students || []).find(s => s.id === studentId);
    const student = snapStudent
      ? Object.assign({}, snapStudent, { class: classAtTime || snapStudent.class })
      : (liveStudent ? Object.assign({}, liveStudent, { class: classAtTime || liveStudent.class }) : null);
    if(!student) return { ok:false, error:'Student not found in archive.' };
    let results = (snap.results || []).filter(r => r.student === student.name && r.class === student.class);
    if(approvedOnly){
      results = results.filter(r => !r.status || r.status === 'approved');
    }
    const attendance = {};
    Object.keys(snap.attendance || {}).forEach(key => {
      const rec = snap.attendance[key] || {};
      if(rec[student.id] !== undefined) attendance[key] = { [student.id]: rec[student.id] };
    });
    return { ok:true, source:'archive', year: y, archivedAt: ar.closedAt,
      student, classAtTime: student.class, results, attendance };
  }

  /* ============================================================
     ENQUIRIES
     ============================================================ */
  function saveEnquiry(data){
    const list = readStore(STORE_KEYS.enquiries, []) || [];
    const name    = String(data.name    || '').trim();
    const email   = String(data.email   || '').trim();
    const message = String(data.message || '').trim();
    if(!name)    return { ok:false, error:'Please enter your name.' };
    if(!email)   return { ok:false, error:'Please enter your email.' };
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return { ok:false, error:'Please enter a valid email address.' };
    }
    if(!message) return { ok:false, error:'Please tell us how we can help.' };
    const row = {
      id: 'enq-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      name, email,
      phone: String(data.phone || '').trim(),
      childClass: String(data.childClass || '').trim(),
      message,
      submittedAt: new Date().toISOString(),
      submittedFrom: 'home.html',
      read: false,
      replies: []
    };
    list.push(row);
    writeStore(STORE_KEYS.enquiries, list);
    return { ok:true, enquiry: row };
  }
  function readEnquiries(){ return readStore(STORE_KEYS.enquiries, []) || []; }
  function markEnquiryRead(id){
    const list = readStore(STORE_KEYS.enquiries, []) || [];
    const row = list.find(e => e.id === id);
    if(!row || row.read) return false;
    row.read = true;
    row.readAt = new Date().toISOString();
    row.readBy = (currentUser() || {}).username || '';
    writeStore(STORE_KEYS.enquiries, list);
    return true;
  }
  function markEnquiryUnread(id){
    const list = readStore(STORE_KEYS.enquiries, []) || [];
    const row = list.find(e => e.id === id);
    if(!row || !row.read) return false;
    row.read = false;
    delete row.readAt;
    delete row.readBy;
    writeStore(STORE_KEYS.enquiries, list);
    return true;
  }
  function deleteEnquiry(id){
    const list = readStore(STORE_KEYS.enquiries, []) || [];
    const row = list.find(e => e.id === id);
    if(!row) return { ok:false, error:'Enquiry not found.' };
    writeStore(STORE_KEYS.enquiries, list.filter(e => e.id !== id));
    audit('delete', `Enquiry ${id}`, row.name, row.email);
    return { ok:true };
  }
  function replyToEnquiry(id, replyText){
    const list = readStore(STORE_KEYS.enquiries, []) || [];
    const row = list.find(e => e.id === id);
    if(!row) return { ok:false, error:'Enquiry not found.' };
    if(!String(replyText || '').trim()){
      return { ok:false, error:'Reply text is required.' };
    }
    if(!Array.isArray(row.replies)) row.replies = [];
    const u = currentUser();
    row.replies.push({
      id: 'rep-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      text: String(replyText).trim(),
      at: new Date().toISOString(),
      by: u ? u.username : 'admin'
    });
    row.repliedAt = new Date().toISOString();
    row.repliedBy = u ? u.username : 'admin';
    row.read = true;
    row.readAt = row.readAt || new Date().toISOString();
    writeStore(STORE_KEYS.enquiries, list);
    audit('update', `Enquiry reply ${id}`, '', row.email);
    return { ok:true, reply: row.replies[row.replies.length - 1] };
  }
  function unreadEnquiryCount(){
    return (readStore(STORE_KEYS.enquiries, []) || []).filter(e => !e.read).length;
  }

  /* ============================================================
     HOME PAGE CMS
     ============================================================ */
  const DEFAULT_HOMEPAGE = {
    hero: {
      kickerText: 'Excellence in Education',
      title: 'Building brighter futures, one student at a time.',
      subtitle: 'A modern K-12 institution dedicated to academic excellence, character, and community.',
      primaryCtaText: 'Enquire Now',
      primaryCtaLink: '#contact',
      secondaryCtaText: 'Sign In',
      secondaryCtaLink: 'index.html',
      showStats: true,
      statsSource: 'auto',
      customStats: []
    },
    carousel: {
      enabled: false,
      autoPlay: true,
      intervalMs: 6000,
      slides: []
    },
    verify: {
      enabled: true,
      heading: 'Verify a Member',
      subheading: 'Confirm whether someone is part of our school community.',
      note: 'This lookup shows limited public info only — no fees, grades, or contact details.'
    },
    ticker: { enabled: false },
    welcome: {
      enabled: true,
      headName: '',
      headTitle: 'Principal',
      headPhoto: '',
      message: '',
      ctaText: '',
      ctaLink: ''
    },
    quickFacts: {
      enabled: true,
      statsSource: 'auto',
      items: []
    },
    programs: {
      enabled: true,
      heading: 'Our Programs',
      subheading: 'Structured progression from early years through secondary school.',
      tiers: [
        { icon:'🧸', name:'Nursery', range:'Ages 3–5 · Play-based foundation',
          pillLabel:'Letter Grading', pillColor:'nursery',
          bullets:['Early literacy and numeracy','Creative expression and play','Social and emotional growth'] },
        { icon:'📚', name:'Primary School', range:'K-1 to Grade 6 · Building the basics',
          pillLabel:'Numeric Grading', pillColor:'primary',
          bullets:['Language, Mathematics, Science','Social Studies and citizenship','Introduction to ICT'] },
        { icon:'🎓', name:'Secondary School', range:'Grades 7–12 · Preparing for tomorrow',
          pillLabel:'Numeric Grading', pillColor:'secondary',
          bullets:['Sciences, Humanities, Mathematics','ICT and digital literacy','Exam preparation'] }
      ]
    },
    whyChooseUs: {
      enabled: true,
      heading: 'Why Choose EduCore?',
      tiles: [
        { icon:'🎓', title:'Academic Excellence', text:'Rigorous curriculum, small class sizes, and measurable outcomes.' },
        { icon:'🏫', title:'Modern Campus', text:'Safe, well-equipped facilities designed for hands-on learning.' },
        { icon:'👩‍🏫', title:'Qualified Staff', text:'Experienced educators committed to every learner\'s growth.' },
        { icon:'🌍', title:'Global Standards', text:'International best practices adapted for our local context.' }
      ]
    },
    gallery: { enabled: false, heading: 'Life at EduCore', subheading: '', photos: [] },
    leadership: {
      enabled: true,
      heading: 'Leadership & Administration',
      members: []
    },
    hiring: { enabled: true, heading: "We're Hiring", subheading: 'Join our team. Open positions:' },
    contact: {
      enabled: true,
      heading: 'Get in touch',
      subheading: 'We\'d love to hear from you. Call us, email us, or fill out the enquiry form.',
      address: '',
      phone: '',
      email: '',
      hours: 'Mon–Fri · 7:30 AM – 4:00 PM',
      showEnquiryForm: true,
      enquiryHeading: 'Send us a message'
    },
    footer: {
      tagline: 'Nurturing future leaders through academic excellence, character, and community.',
      socials: [],
      quickLinks: []
    },
    sectionOrder: ['hero','carousel','ticker','welcome','quickFacts','programs','whyChooseUs','gallery','leadership','hiring','verify','contact'],
    updatedAt: null,
    updatedBy: null
  };

  function getHomepageLive(){ return readStore(STORE_KEYS.homepageLive, null); }
  function getHomepageDraft(){ return readStore(STORE_KEYS.homepage, null); }
  function getHomepage(){
    return getHomepageLive() || getHomepageDraft() || JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE));
  }
  function saveHomepageDraft(config){
    function clean(v){
      if(v === null || v === undefined) return '';
      if(Array.isArray(v)) return v.map(clean);
      if(typeof v === 'object'){
        const out = {};
        Object.keys(v).forEach(k => { out[k] = clean(v[k]); });
        return out;
      }
      return v;
    }
    const next = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE)), clean(config), {
      updatedAt: new Date().toISOString(),
      updatedBy: (currentUser() || {}).username || 'admin'
    });
    writeStore(STORE_KEYS.homepage, next);
    audit('update', 'Home page draft', '', 'saved');
    return { ok:true, config: next };
  }
  function publishHomepage(config){
    const u = currentUser();
    const next = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE)), config, {
      updatedAt: new Date().toISOString(),
      updatedBy: u ? u.username : 'admin'
    });
    writeStore(STORE_KEYS.homepage, next);
    writeStore(STORE_KEYS.homepageLive, next);
    audit('update', 'Home page published', '', 'live');
    return { ok:true, config: next };
  }
  function resetHomepage(){
    const fresh = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE));
    writeStore(STORE_KEYS.homepage, fresh);
    audit('update', 'Home page reset', '', 'defaults');
    return { ok:true, config: fresh };
  }

  /* ============================================================
     VERIFY MEMBER
     ============================================================ */
  function verifyMember(query){
    const q = String(query || '').trim();
    if(!q) return { ok:false, error:'Enter a value to search.' };
    if(q.length < 3) return { ok:false, error:'Enter at least 3 characters.' };

    const lower = q.toLowerCase();
    const students = readStore(STORE_KEYS.students, []) || [];
    const teachers = readStore(STORE_KEYS.teachers, []) || [];
    const users    = readStore(STORE_KEYS.users, []) || [];
    const year = currentAcademicYear();
    const trim = s => String(s || '').trim().toLowerCase();
    const normName = s => trim(s).replace(/\s+/g, ' ');

    const hiddenStudentIds = new Set();
    const hiddenStudentNames = new Set();
    const hiddenTeacherIds = new Set();
    const hiddenTeacherNames = new Set();

    users.forEach(u => {
      if(u.showInPublicVerify === false){
        if(u.linkedStudentId){
          hiddenStudentIds.add(String(u.linkedStudentId));
          const s = students.find(x => String(x.id) === String(u.linkedStudentId));
          if(s) hiddenStudentNames.add(normName(s.name));
        }
        if(u.linkedTeacherId){
          hiddenTeacherIds.add(String(u.linkedTeacherId));
          const t = teachers.find(x => String(x.id) === String(u.linkedTeacherId));
          if(t) hiddenTeacherNames.add(normName(t.name));
        }
      }
    });

    const studentVisible = s =>
      !hiddenStudentIds.has(String(s.id)) &&
      !hiddenStudentNames.has(normName(s.name));

    const teacherVisible = t =>
      !hiddenTeacherIds.has(String(t.id)) &&
      !hiddenTeacherNames.has(normName(t.name));

    const studentMatch =
      students.find(s => studentVisible(s) && trim(s.id) === lower) ||
      students.find(s => studentVisible(s) && s.email && trim(s.email) === lower) ||
      students.find(s => studentVisible(s) && s.phone && trim(s.phone) === lower) ||
      students.find(s => studentVisible(s) && normName(s.name) === normName(q));

    if(studentMatch){
      return {
        ok:true, match:true,
        member:{
          name: studentMatch.name,
          role: 'Student',
          class: studentMatch.class,
          status: studentMatch.status || 'Active',
          year
        },
        verifiedAt: new Date().toISOString()
      };
    }

    const teacherMatch =
      teachers.find(t => teacherVisible(t) && trim(t.id) === lower) ||
      teachers.find(t => teacherVisible(t) && t.email && trim(t.email) === lower) ||
      teachers.find(t => teacherVisible(t) && t.phone && trim(t.phone) === lower) ||
      teachers.find(t => teacherVisible(t) && normName(t.name) === normName(q));

    if(teacherMatch){
      return {
        ok:true, match:true,
        member:{
          name: teacherMatch.name,
          role: 'Teacher',
          department: teacherMatch.department || 'Unassigned',
          status: teacherMatch.status || 'Full-time',
          year
        },
        verifiedAt: new Date().toISOString()
      };
    }

    const userMatch = users.find(u =>
      u.active &&
      u.showInPublicVerify !== false &&
      u.role !== 'Student' &&
      u.role !== 'Teacher' &&
      (trim(u.username) === lower ||
       (u.email && trim(u.email) === lower) ||
       normName(u.name) === normName(q))
    );
    if(userMatch){
      return {
        ok:true, match:true,
        member:{
          name: userMatch.name || userMatch.username,
          role: userMatch.role,
          status: 'Active',
          year
        },
        verifiedAt: new Date().toISOString()
      };
    }

    return {
      ok:true, match:false,
      message:'No member found. Check the spelling or use your official ID.'
    };
  }

  /* ============================================================
     HIRING ENGINE
     ============================================================ */
  function readHiringForms(){ return readStore(STORE_KEYS.hiringForms, []) || []; }
  function writeHiringForms(list){ writeStore(STORE_KEYS.hiringForms, list); }
  function getHiringForm(id){ return readHiringForms().find(f => f.id === id) || null; }

  function computeHiringStatus(form){
    if(!form) return 'draft';
    if(form.status === 'archived') return 'archived';
    if(!form.formPublished) return 'draft';
    const now = Date.now();
    const open = form.publishAt ? new Date(form.publishAt).getTime() : null;
    const close = form.closeAt ? new Date(form.closeAt).getTime() : null;
    if(open != null && now < open) return 'scheduled';
    if(close != null && now > close) return 'closed';
    return 'open';
  }

  function saveHiringForm(form){
    const list = readHiringForms();
    const u = currentUser();
    const idx = list.findIndex(x => x.id === form.id);
    const row = Object.assign({}, form, {
      updatedAt: new Date().toISOString(),
      updatedBy: u ? u.username : 'admin'
    });
    if(idx >= 0) list[idx] = row;
    else {
      row.id = row.id || ('hf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6));
      row.createdAt = row.createdAt || new Date().toISOString();
      row.createdBy = u ? u.username : 'admin';
      list.push(row);
    }
    writeHiringForms(list);
    return { ok:true, form: row };
  }

  function deleteHiringForm(id){
    writeHiringForms(readHiringForms().filter(f => f.id !== id));
    writeStore(STORE_KEYS.hiringApplications,
      readHiringApplications().filter(a => a.formId !== id));
    audit('delete', `Hiring position ${id}`, '', '');
    return { ok:true };
  }

  function listOpenHiringForms(){
    return readHiringForms()
      .filter(f => computeHiringStatus(f) === 'open')
      .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function readHiringApplications(){ return readStore(STORE_KEYS.hiringApplications, []) || []; }
  function writeHiringApplications(list){ writeStore(STORE_KEYS.hiringApplications, list); }

  function generateVerifyCode(){
    const year = new Date().getFullYear();
    let rand;
    try{
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      rand = Array.from(buf).map(b => b.toString(36).padStart(2,'0')).join('').slice(0, 12).toUpperCase();
    }catch(e){
      rand = (Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase();
    }
    return `HIR-${year}-${rand}`;
  }

  function submitHiringApplication({ formId, answers, applicantName, applicantEmail, isPreview }){
    if(isPreview){
      return { ok:false, error:'Submissions are disabled in preview mode.' };
    }

    const forms = readHiringForms();
    const form = forms.find(f => f.id === formId);
    if(!form) return { ok:false, error:'Position not found.' };
    const status = computeHiringStatus(form);
    if(status === 'draft')     return { ok:false, error:'This position is not yet available.' };
    if(status === 'scheduled') return { ok:false, error:'Applications have not opened yet.' };
    if(status === 'closed')    return { ok:false, error:'Applications are closed.' };
    if(status === 'archived')  return { ok:false, error:'This position has been archived.' };

    const emailClean = String(applicantEmail || '').trim().toLowerCase();
    if(emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)){
      return { ok:false, error:'Enter a valid email address.' };
    }

    const apps = readHiringApplications();
    if(emailClean && apps.some(a =>
        a.formId === formId &&
        a.applicantEmail &&
        a.applicantEmail.toLowerCase() === emailClean)){
      return { ok:false, error:'You already applied for this position. Use your verify code to check status.' };
    }

    const verifyCode = generateVerifyCode();
    const row = {
      id: 'app-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      formId, verifyCode,
      submittedAt: new Date().toISOString(),
      answers: answers || {},
      applicantName: applicantName || '',
      applicantEmail: emailClean,
      status: 'pending',
      reviewedAt: null, reviewedBy: null, reviewNote: '',
      resultsPublished: false
    };
    apps.push(row);
    writeHiringApplications(apps);
    audit('create', `Hiring application ${row.id}`, '', form.title);
    return { ok:true, application: row };
  }

  function reviewHiringApplication(appId, newStatus, note){
    const apps = readHiringApplications();
    const a = apps.find(x => x.id === appId);
    if(!a) return { ok:false, error:'Application not found.' };
    if(!['pending','shortlisted','accepted','rejected'].includes(newStatus)){
      return { ok:false, error:'Invalid status.' };
    }
    a.status = newStatus;
    a.reviewedAt = new Date().toISOString();
    a.reviewedBy = (currentUser() || {}).username || '';
    a.reviewNote = note || '';
    writeHiringApplications(apps);
    audit('update', `Hiring application ${appId}`, '', newStatus);
    return { ok:true };
  }

  function publishHiringResults(formId){
    const forms = readHiringForms();
    const f = forms.find(x => x.id === formId);
    if(!f) return { ok:false, error:'Position not found.' };
    f.showResultsAt = new Date().toISOString();
    writeHiringForms(forms);

    const apps = readHiringApplications();
    let touched = 0;
    apps.forEach(a => {
      if(a.formId === formId && !a.resultsPublished){
        a.resultsPublished = true;
        touched++;
      }
    });
    if(touched) writeHiringApplications(apps);
    audit('update', `Hiring results published`, f.title, `${touched} applications`);
    return { ok:true, touched };
  }

  function checkHiringStatus(verifyCode){
    const code = String(verifyCode || '').trim().toUpperCase();
    if(!code) return { ok:false, error:'Enter your verify code.' };
    const apps = readHiringApplications();
    const app = apps.find(a => String(a.verifyCode || '').toUpperCase() === code);
    if(!app) return { ok:true, found:false, message:'No application found with that code.' };

    const form = getHiringForm(app.formId);
    if(!form) return { ok:true, found:false, message:'Position no longer exists.' };

    const resultsOut = !!form.showResultsAt;
    if(!resultsOut){
      return {
        ok:true, found:true, resultsOut:false,
        message:'Results for this position are not yet out. Please check back later.',
        position: form.title
      };
    }

    const map = {
      pending: 'Your application is still being reviewed.',
      shortlisted: 'You have been shortlisted. The school will contact you.',
      accepted: 'Congratulations — your application was accepted.',
      rejected: 'Thank you for applying. Unfortunately, your application was not successful.'
    };

    return {
      ok:true, found:true, resultsOut:true,
      status: app.status,
      message: map[app.status] || 'Application received.',
      position: form.title,
      applicantName: app.applicantName
    };
  }

  /* ============================================================
     TIMETABLE ENGINE
     ============================================================ */
  const DAY_KEYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  function getTimetableSettings(){
    const defaults = {
      year: currentAcademicYear(), dayStart: '08:00', dayEnd: '15:30',
      periodMinutes: 45, days: ['Mon','Tue','Wed','Thu','Fri'],
      breaks: [{ afterPeriod: 3, minutes: 20, label: 'Recess' }]
    };
    const raw = readStore(STORE_KEYS.timetableSettings, null) || {};
    const merged = Object.assign({}, defaults, raw);
    if(!Array.isArray(merged.days) || !merged.days.length) merged.days = defaults.days;
    if(!Array.isArray(merged.breaks)) merged.breaks = defaults.breaks;
    return merged;
  }
  function saveTimetableSettings(s){
    const y = currentAcademicYear();
    const value = Object.assign({}, s, { year: y });
    writeStore(STORE_KEYS.timetableSettings, value);
    return value;
  }
  function computePeriodsPerDay(settings){
    const s = settings || getTimetableSettings();
    const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const totalMin = toMin(s.dayEnd) - toMin(s.dayStart);
    if(totalMin <= 0) return 0;
    const breakMin = (s.breaks || []).reduce((sum, b) => sum + (Number(b.minutes) || 0), 0);
    const usable = totalMin - breakMin;
    if(usable <= 0) return 0;
    return Math.floor(usable / Number(s.periodMinutes || 45));
  }
  function buildPeriodGrid(settings){
    const s = settings || getTimetableSettings();
    const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const toHHMM = min => { const h = Math.floor(min / 60); const m = min % 60; return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0'); };
    const breaksByAfter = {};
    (s.breaks || []).forEach(b => { const k = Number(b.afterPeriod); if(k > 0) breaksByAfter[k] = (breaksByAfter[k] || 0) + (Number(b.minutes) || 0); });
    const periods = [];
    let cursor = toMin(s.dayStart);
    const per = Number(s.periodMinutes || 45);
    let idx = 1;
    const total = computePeriodsPerDay(s);
    for(let i = 1; i <= total; i++){
      periods.push({ index: idx, start: toHHMM(cursor), end: toHHMM(cursor + per), isBreak: false });
      cursor += per;
      if(breaksByAfter[idx]){
        periods.push({ index: null, start: toHHMM(cursor), end: toHHMM(cursor + breaksByAfter[idx]), isBreak: true });
        cursor += breaksByAfter[idx];
      }
      idx++;
    }
    return periods;
  }
  function getTeacherAvailability(teacherId){
    const t = getTeachers().find(x => x.id === teacherId);
    if(!t) return { availableDays: ['Mon','Tue','Wed','Thu','Fri'], unavailablePeriods: [] };
    const s = getTimetableSettings();
    const defaultDays = t.status === 'Part-time' ? ['Mon','Wed','Fri'] : s.days;
    return {
      availableDays: Array.isArray(t.availableDays) && t.availableDays.length ? t.availableDays : defaultDays,
      unavailablePeriods: Array.isArray(t.unavailablePeriods) ? t.unavailablePeriods : []
    };
  }
  function saveTeacherAvailability(teacherId, avail){
    const teachers = getTeachers();
    const t = teachers.find(x => x.id === teacherId);
    if(!t) return false;
    t.availableDays = Array.isArray(avail.availableDays) ? avail.availableDays.slice() : undefined;
    t.unavailablePeriods = Array.isArray(avail.unavailablePeriods) ? avail.unavailablePeriods.slice() : [];
    writeStore(STORE_KEYS.teachers, teachers);
    return true;
  }
  function getTimetable(){
    const raw = readStore(STORE_KEYS.timetable, null);
    if(raw) return raw;
    return { year: currentAcademicYear(), status: 'draft', generatedAt: null, lessons: [], unplaced: [] };
  }
  function writeTimetable(tt){ writeStore(STORE_KEYS.timetable, tt); }
  function clearTimetable(){
    const tt = { year: currentAcademicYear(), status: 'draft', generatedAt: null, lessons: [], unplaced: [] };
    writeTimetable(tt);
    return tt;
  }
  function publishTimetable(){
    const tt = getTimetable();
    tt.status = 'published';
    tt.publishedAt = new Date().toISOString();
    tt.publishedBy = (currentUser() || {}).username || '';
    writeTimetable(tt);
    audit('update', 'Timetable published', '', `${tt.lessons.length} lessons`);
    return tt;
  }
  function isTimetablePublished(){ return getTimetable().status === 'published'; }
  function generateTimetable({ timeLimitMs = 5000 } = {}){
    const settings = getTimetableSettings();
    const days = settings.days.slice();
    const periodsPerDay = computePeriodsPerDay(settings);
    const totalSlots = days.length * periodsPerDay;
    if(!days.length || periodsPerDay <= 0) return { ok: false, error: 'Time grid is invalid. Set school start/end times and period length first.' };
    const classes = getClasses();
    const assignments = getAssignments();
    const teachers = getTeachers();
    const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));
    const demand = [];
    const classProblems = [];
    classes.forEach(c => {
      const myAsn = assignments.filter(a => a.className === c.name);
      const weekly = myAsn.reduce((sum, a) => sum + Number(a.periodsPerWeek || 0), 0);
      if(weekly > totalSlots){ classProblems.push({ className: c.name, reason: `Requires ${weekly} periods but only ${totalSlots} available.` }); return; }
      myAsn.forEach(a => {
        const t = teacherById[a.teacherId];
        const name = t ? t.name : a.teacherName || a.teacherId;
        const n = Number(a.periodsPerWeek || 0);
        for(let i = 0; i < n; i++) demand.push({ className: c.name, subject: a.subject, teacherId: a.teacherId, teacherName: name });
      });
    });
    if(classProblems.length) return { ok: false, error: 'Some classes require more periods than are available.', classProblems };
    if(!demand.length) return { ok: false, error: 'Nothing to schedule. Add class assignments first.' };
    const teacherAvail = {};
    teachers.forEach(t => {
      const a = getTeacherAvailability(t.id);
      teacherAvail[t.id] = { daySet: new Set(a.availableDays), blockedSet: new Set((a.unavailablePeriods || []).map(x => `${x.day}|${x.period}`)) };
    });
    const teacherLoadCount = {};
    demand.forEach(d => { teacherLoadCount[d.teacherId] = (teacherLoadCount[d.teacherId] || 0) + 1; });
    demand.sort((a, b) => {
      const da = teacherAvail[a.teacherId]?.daySet.size || 5;
      const db = teacherAvail[b.teacherId]?.daySet.size || 5;
      if(da !== db) return da - db;
      const la = teacherLoadCount[a.teacherId] || 0;
      const lb = teacherLoadCount[b.teacherId] || 0;
      if(la !== lb) return lb - la;
      if(a.className !== b.className) return a.className.localeCompare(b.className);
      return a.subject.localeCompare(b.subject);
    });
    const classBusy = {}, teacherBusy = {};
    const slotKey = (day, p) => `${day}|${p}`;
    const lessons = [];
    const startTime = Date.now();
    let timedOut = false;
    function canPlace(lesson, day, period){
      const k = slotKey(day, period);
      if(classBusy[`${lesson.className}|${k}`]) return false;
      if(teacherBusy[`${lesson.teacherId}|${k}`]) return false;
      const av = teacherAvail[lesson.teacherId];
      if(av){ if(!av.daySet.has(day)) return false; if(av.blockedSet.has(k)) return false; }
      return true;
    }
    function placeAt(lesson, day, period){
      const k = slotKey(day, period);
      classBusy[`${lesson.className}|${k}`] = true;
      teacherBusy[`${lesson.teacherId}|${k}`] = true;
      lessons.push({ id: 'L-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
        className: lesson.className, subject: lesson.subject,
        teacherId: lesson.teacherId, teacherName: lesson.teacherName, day, period });
    }
    function tryPlace(idx){
      if(idx >= demand.length) return true;
      if(Date.now() - startTime > timeLimitMs){ timedOut = true; return false; }
      const lesson = demand[idx];
      const candidates = [];
      for(let di = 0; di < days.length; di++) for(let p = 1; p <= periodsPerDay; p++)
        if(canPlace(lesson, days[di], p)) candidates.push({ day: days[di], period: p, di });
      candidates.sort((a, b) => {
        const sameDayA = lessons.some(L => L.className === lesson.className && L.subject === lesson.subject && L.day === a.day);
        const sameDayB = lessons.some(L => L.className === lesson.className && L.subject === lesson.subject && L.day === b.day);
        if(sameDayA !== sameDayB) return sameDayA ? 1 : -1;
        return a.di - b.di;
      });
      for(const c of candidates){
        placeAt(lesson, c.day, c.period);
        if(tryPlace(idx + 1)) return true;
        lessons.pop();
        const k = slotKey(c.day, c.period);
        delete classBusy[`${lesson.className}|${k}`];
        delete teacherBusy[`${lesson.teacherId}|${k}`];
        if(timedOut) return false;
      }
      return false;
    }
    tryPlace(0);
    const placedCount = lessons.length;
    const unplaced = demand.slice(placedCount).map(d => ({
      className: d.className, subject: d.subject, teacherId: d.teacherId, teacherName: d.teacherName,
      reason: timedOut ? 'Time limit reached' : 'No free slot'
    }));
    audit('create', 'Timetable generated', '', `${lessons.length} placed · ${unplaced.length} unplaced${timedOut ? ' · timed out' : ''}`);
    return { ok: true, lessons, unplaced, timedOut, totalDemand: demand.length };
  }
  function saveGeneratedTimetable(result){
    if(!result || !result.ok) return false;
    writeTimetable({
      year: currentAcademicYear(), status: 'draft',
      generatedAt: new Date().toISOString(),
      generatedBy: (currentUser() || {}).username || '',
      lessons: result.lessons || [], unplaced: result.unplaced || []
    });
    return true;
  }
  function deleteLesson(lessonId){
    const tt = getTimetable();
    tt.lessons = (tt.lessons || []).filter(l => l.id !== lessonId);
    writeTimetable(tt);
    return true;
  }
  function updateLesson(lessonId, patch){
    const tt = getTimetable();
    const l = (tt.lessons || []).find(x => x.id === lessonId);
    if(!l) return { ok:false, error:'Lesson not found.' };
    Object.assign(l, patch);
    writeTimetable(tt);
    return { ok:true };
  }
  function checkLessonConflict(patch, ignoreId){
    const tt = getTimetable();
    for(const l of (tt.lessons || [])){
      if(l.id === ignoreId) continue;
      if(l.day !== patch.day || l.period !== patch.period) continue;
      if(patch.className && l.className === patch.className) return { ok:false, error:`${patch.className} already has ${l.subject} at ${patch.day} P${patch.period}.` };
      if(patch.teacherId && l.teacherId === patch.teacherId) return { ok:false, error:`${l.teacherName} is already teaching ${l.className} at ${patch.day} P${patch.period}.` };
    }
    return { ok:true };
  }
  function lessonsForClass(className){ return (getTimetable().lessons || []).filter(l => l.className === className); }
  function lessonsForTeacher(teacherId){ return (getTimetable().lessons || []).filter(l => l.teacherId === teacherId); }
  function lessonsForStudent(student){ return student ? lessonsForClass(student.class) : []; }
  function buildTimetableGrid(lessons){
    const settings = getTimetableSettings();
    const days = settings.days;
    const perDay = computePeriodsPerDay(settings);
    const grid = {};
    days.forEach(d => { for(let p = 1; p <= perDay; p++) grid[`${d}|${p}`] = null; });
    (lessons || []).forEach(l => {
      const k = `${l.day}|${l.period}`;
      if(Object.prototype.hasOwnProperty.call(grid, k)) grid[k] = l;
    });
    return { days, perDay, grid };
  }

  /* ============================================================
     TOAST / MODAL
     ============================================================ */
  function ensureToast(){
    let t = document.getElementById('educoreToast');
    if(!t){
      t = document.createElement('div');
      t.id = 'educoreToast';
      t.setAttribute('role','status');
      t.setAttribute('aria-live','polite');
      document.body.appendChild(t);
      if(!document.getElementById('educoreToastStyle')){
        const s = document.createElement('style');
        s.id = 'educoreToastStyle';
        s.textContent = `
          #educoreToast{position:fixed;right:22px;bottom:22px;background:#152744;color:#fff;
            padding:14px 18px;border-radius:10px;font-size:12px;z-index:9999;display:none;
            box-shadow:0 8px 24px rgba(24,42,78,.25);max-width:340px}
          #educoreToast.show{display:block;animation:eceduFade .2s}
          @keyframes eceduFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
        document.head.appendChild(s);
      }
    }
    return t;
  }
  function toast(msg){
    const t = ensureToast();
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__eduToastTimer);
    window.__eduToastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function trapFocus(container){
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),' +
                'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(container.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
    if(!nodes.length) return () => {};
    const first = nodes[0], last = nodes[nodes.length - 1];
    const handler = e => {
      if(e.key !== 'Tab') return;
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', handler);
    setTimeout(() => { try{ first.focus(); }catch(e){} }, 30);
    return () => container.removeEventListener('keydown', handler);
  }
  function ensureModal(){
    let back = document.getElementById('educoreModalBackdrop');
    if(!back){
      back = document.createElement('div');
      back.id = 'educoreModalBackdrop';
      back.innerHTML = `<div class="educore-modal" role="dialog" aria-modal="true">
        <div class="educore-modal-head"><h3 id="educoreModalTitle">Form</h3>
          <button class="educore-modal-close" id="educoreModalClose" aria-label="Close">×</button></div>
        <form class="educore-modal-form" id="educoreModalForm"></form></div>`;
      document.body.appendChild(back);
      if(!document.getElementById('educoreModalStyle')){
        const s = document.createElement('style');
        s.id = 'educoreModalStyle';
        s.textContent = `
          #educoreModalBackdrop{display:none;position:fixed;inset:0;background:rgba(14,24,44,.55);z-index:9998;align-items:center;justify-content:center;padding:18px}
          #educoreModalBackdrop.show{display:flex}
          .educore-modal{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 25px 70px rgba(11,23,51,.25)}
          .educore-modal.wide{max-width:860px}
          .educore-modal-head{display:flex;justify-content:space-between;align-items:center;padding:20px 22px;border-bottom:1px solid #e8ebf2;position:sticky;top:0;background:#fff;z-index:2}
          .educore-modal-head h3{margin:0;font-size:17px;color:#14213d}
          .educore-modal-close{border:0;background:#f2f4f8;border-radius:8px;width:31px;height:31px;font-size:18px;cursor:pointer;color:#34415c}
          .educore-modal-form{padding:22px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
          .educore-modal-form .full{grid-column:1/-1}
          .educore-modal-form label{display:block;font-size:11px;color:#657089;font-weight:bold;margin-bottom:6px}
          .educore-modal-form input,.educore-modal-form select,.educore-modal-form textarea{width:100%;border:1px solid #dfe4ee;border-radius:8px;padding:11px;font-size:12px;outline:none;background:#fff;font-family:inherit}
          .educore-modal-form input:focus,.educore-modal-form select:focus,.educore-modal-form textarea:focus{border-color:#5575e5}
          .educore-modal-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px;margin-top:8px}
          .ecedu-btn{border:0;border-radius:9px;padding:11px 15px;background:#4169e1;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
          .ecedu-btn.outline{background:#fff;color:#34415c;border:1px solid #e8ebf2}
          .ecedu-btn.danger{background:#d64545}
          .ecedu-btn:disabled{opacity:.5;cursor:not-allowed}
          @media(max-width:650px){.educore-modal-form{grid-template-columns:1fr}.educore-modal-actions{grid-column:1}}`;
        document.head.appendChild(s);
      }
      back.addEventListener('click', e => { if(e.target.id === 'educoreModalBackdrop') closeModal(); });
      document.getElementById('educoreModalClose').addEventListener('click', closeModal);
      document.addEventListener('keydown', e => {
        if(e.key === 'Escape' && document.getElementById('educoreModalBackdrop').classList.contains('show')){
          closeModal();
        }
      });
    }
    return back;
  }
  let __modalSubmit = null;
  let __modalReturnFocus = null;
  let __modalUntrap = null;
  function openModal(title, html, submitText, onSubmit, wide){
    __modalReturnFocus = document.activeElement;
    ensureModal();
    document.getElementById('educoreModalTitle').textContent = title;
    const form = document.getElementById('educoreModalForm');
    form.className = 'educore-modal-form' + (wide ? ' wide' : '');
    form.innerHTML = html + `<div class="educore-modal-actions">
      <button type="button" class="ecedu-btn outline" id="educoreModalCancel">Cancel</button>
      ${submitText ? `<button type="submit" class="ecedu-btn">${esc(submitText)}</button>` : ''}
    </div>`;
    const back = document.getElementById('educoreModalBackdrop');
    back.classList.add('show');
    document.getElementById('educoreModalCancel').onclick = closeModal;
    __modalSubmit = onSubmit || null;
    form.onsubmit = e => {
      e.preventDefault();
      if(__modalSubmit) __modalSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()));
    };
    const modalEl = document.querySelector('.educore-modal');
    if(modalEl) modalEl.scrollTop = 0;
    if(__modalUntrap){ __modalUntrap(); __modalUntrap = null; }
    if(modalEl) __modalUntrap = trapFocus(modalEl);
    return form;
  }
  function closeModal(){
    document.getElementById('educoreModalBackdrop')?.classList.remove('show');
    const f = document.getElementById('educoreModalForm');
    if(f) f.innerHTML = '';
    if(__modalUntrap){ __modalUntrap(); __modalUntrap = null; }
    if(__modalReturnFocus && document.body.contains(__modalReturnFocus)){
      try{ __modalReturnFocus.focus(); }catch(e){}
    }
    __modalReturnFocus = null;
  }
  function confirmModal({ title, message, submitText, danger }){
    return new Promise(resolve => {
      const html = `<div class="full" style="font-size:13px;line-height:1.7;color:#3b4a63">${message}</div>`;
      openModal(title || 'Confirm', html, submitText || 'Confirm',
        () => { closeModal(); resolve(true); });
      if(danger){
        setTimeout(() => {
          const btn = document.querySelector('.educore-modal-actions .ecedu-btn:not(.outline)');
          if(btn){ btn.classList.add('danger'); }
        }, 0);
      }
      const cancel = document.getElementById('educoreModalCancel');
      if(cancel){
        const orig = cancel.onclick;
        cancel.onclick = () => { if(orig) orig(); resolve(false); };
      }
    });
  }
  function showDenied(label){
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#202a3b;padding:24px">
        <div style="max-width:420px;text-align:center;background:#fff;border:1px solid #e8ebf2;border-radius:16px;padding:40px 30px;box-shadow:0 12px 40px rgba(24,42,78,.08)">
          <div style="font-size:44px;margin-bottom:14px">🔒</div>
          <h1 style="font-size:20px;margin:0 0 8px;color:#14213d">Not authorised</h1>
          <p style="margin:0 0 22px;font-size:13px;color:#7a8498;line-height:1.6">Your account doesn't have permission to open <strong>${esc(label)}</strong>.</p>
          <a href="index.html" style="display:inline-block;background:#4169e1;color:#fff;padding:12px 20px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px">← Back to Dashboard</a>
        </div>
      </div>`;
  }
  function injectBackPill(){
    if(document.getElementById('educoreBackPill')) return;
    const a = document.createElement('a');
    a.id = 'educoreBackPill';
    a.href = 'index.html';
    a.textContent = '← Back to Dashboard';
    a.style.cssText = `position:fixed;top:14px;left:14px;z-index:9997;background:#14213d;color:#fff;text-decoration:none;padding:9px 14px;border-radius:20px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:.2px;box-shadow:0 6px 18px rgba(20,33,61,.25);display:inline-flex;align-items:center;gap:6px;`;
    document.body.appendChild(a);
  }
  function confirmTyped(message, expected, onConfirm){
    const typed = window.prompt(`${message}\n\nType "${expected}" to confirm:`);
    if(typed !== expected){ toast('Confirmation did not match.'); return false; }
    onConfirm?.();
    return true;
  }

  /* ============================================================
     PERMISSIONS
     ============================================================ */
  const PERMISSION_GROUPS = [
    { title:'Dashboard', items:[{ key:'dashboard', label:'Dashboard', desc:'Overview and leaderboards' }] },
    { title:'Analytics', items:[{ key:'analytics', label:'Analytics', desc:'School-wide analytics dashboard', subFeatures:[
      { key:'view', label:'View analytics', desc:'Open the analytics dashboard' },
      { key:'enrolment', label:'Enrolment section', desc:'Student enrolment statistics' },
      { key:'academic', label:'Academic section', desc:'Performance and grade distribution' },
      { key:'attendance', label:'Attendance section', desc:'Attendance analysis' },
      { key:'financial', label:'Financial section', desc:'Fees, payments, payroll' },
      { key:'quizzes', label:'Quiz section', desc:'Assessment analytics' },
      { key:'staff', label:'Staff section', desc:'Teacher overview' },
      { key:'timetable', label:'Timetable health', desc:'Scheduling completeness' },
      { key:'dataHealth', label:'Data health', desc:'Configuration gaps' },
      { key:'export', label:'Export reports', desc:'Download CSVs' }
    ]}]},
    { title:'Academic', items:[
      { key:'students', label:'Students', desc:'Manage student records', subFeatures:[
        { key:'add', label:'Add student', desc:'Create new student records' },
        { key:'edit', label:'Edit student', desc:'Modify student details' },
        { key:'delete', label:'Delete student', desc:'Remove students and their data' },
        { key:'report', label:'Open report card', desc:'Launch a report card for a student' },
        { key:'export', label:'Export CSV', desc:'Download the student list' }
      ]},
      { key:'parents', label:'Parents', desc:'Parent/guardian registry', subFeatures:[
        { key:'add', label:'Add parent', desc:'Create new parent records' },
        { key:'edit', label:'Edit parent', desc:'Modify parent details' },
        { key:'delete', label:'Delete parent', desc:'Remove parents (blocked if linked to students)' },
        { key:'export', label:'Export CSV', desc:'Download the parent list' }
      ]},
      { key:'teachers', label:'Teachers', desc:'Manage teaching staff', subFeatures:[
        { key:'add', label:'Add teacher', desc:'Create new teacher records' },
        { key:'edit', label:'Edit teacher', desc:'Modify teacher details' },
        { key:'delete', label:'Delete teacher', desc:'Remove teachers and their data' },
        { key:'assignments', label:'Manage assignments', desc:'Assign subjects and classes' },
        { key:'sponsorship', label:'Manage sponsorship', desc:'Assign a class to sponsor' }
      ]},
      { key:'classes', label:'Classes', desc:'Class registry, sections, sponsors', subFeatures:[
        { key:'add', label:'Add / edit', desc:'Create and edit subjects & classes' },
        { key:'delete', label:'Delete', desc:'Remove subjects and classes' },
        { key:'archive', label:'Archive subject', desc:'Archive or restore subjects' },
        { key:'manage_subjects', label:'Manage class subjects', desc:'Choose which subjects a class offers' },
        { key:'promote', label:'Promote students', desc:'Move students to the next class' }
      ]},
      { key:'timetable', label:'Timetable', desc:'School timetable / scheduler', subFeatures:[
        { key:'settings', label:'Configure settings', desc:'School day, periods, breaks, teacher availability' },
        { key:'generate', label:'Generate schedule', desc:'Run the scheduler' },
        { key:'edit', label:'Edit lessons', desc:'Manually adjust generated lessons' },
        { key:'publish', label:'Publish', desc:'Make the timetable visible' },
        { key:'view', label:'View', desc:'See the published timetable' }
      ]},
      { key:'attendance', label:'Attendance', desc:'Daily attendance register', subFeatures:[
        { key:'save', label:'Save attendance', desc:'Record attendance for a class and date' },
        { key:'clear_day', label:'Clear day', desc:"Erase a day's attendance" },
        { key:'mark_all', label:'Bulk mark', desc:'Mark everyone Present in one click' }
      ]},
      { key:'exams', label:'Gradesheet', desc:'Push periods, enter, approve, publish', subFeatures:[
        { key:'view_pushes', label:'View pushes', desc:'See push list (teachers see their own)' },
        { key:'push', label:'Create push', desc:'Push a period to teachers (bulk wizard)' },
        { key:'approve', label:'Approve', desc:'Approve all or selected rows' },
        { key:'return', label:'Return / hide', desc:'Return for revision or hide from parents' },
        { key:'reopen', label:'Reopen', desc:'Reopen a locked or returned push' },
        { key:'bypass', label:'Admin direct entry', desc:'Enter scores without a push' },
        { key:'add', label:'Add result', desc:'Enter a new result row' },
        { key:'edit', label:'Edit result', desc:'Modify an existing score' },
        { key:'delete', label:'Delete result', desc:'Remove a result row' }
      ]},
      { key:'reportcard', label:'Report Card', desc:'Print and manage report cards', subFeatures:[
        { key:'open', label:'Open single', desc:"View a single student's report card" },
        { key:'batch_print', label:'Batch print', desc:'Print report cards for multiple students' },
        { key:'lock_term', label:'Lock semester', desc:'Prevent further score edits' },
        { key:'unlock_term', label:'Unlock semester', desc:'Re-enable score edits for a semester' },
        { key:'copy_prev_term', label:'Copy previous term', desc:'Bring subject list forward from the last term' }
      ]},
      { key:'quizzes', label:'Quizzes', desc:'Create, assign, and take online quizzes', subFeatures:[
        { key:'create', label:'Create quiz', desc:'Build a new quiz' },
        { key:'edit', label:'Edit quiz', desc:'Modify an existing quiz' },
        { key:'delete', label:'Delete quiz', desc:'Remove a quiz and its attempts' },
        { key:'publish', label:'Publish', desc:'Make a quiz visible to students' },
        { key:'grade', label:'Grade attempts', desc:'Manually grade essay / short-answer questions' },
        { key:'view_all', label:'View all results', desc:"See every student's attempt" },
        { key:'reset', label:'Reset attempt', desc:'Allow a student to retake a quiz' },
        { key:'assign', label:'Assign to student', desc:'Assign a quiz to one specific student' },
        { key:'export', label:'Export results', desc:'Download quiz results as CSV' }
      ]}
    ]},
    { title:'Administration', items:[
      { key:'fees', label:'Fees', desc:'Tuition per class, student payments, teacher salaries', subFeatures:[
        { key:'class_fees', label:'Set class tuition', desc:'Set tuition + extra fees per class' },
        { key:'record_payment', label:'Record student payment', desc:'Add a payment to a student account' },
        { key:'reverse_payment', label:'Reverse student payment', desc:'Undo a previously recorded payment' },
        { key:'view_history', label:'View history', desc:'See every payment on an account' },
        { key:'salary', label:'Record salary', desc:'Disburse a salary to a teacher' },
        { key:'reverse_salary', label:'Reverse salary', desc:'Undo a previously recorded salary' },
        { key:'export', label:'Export CSV', desc:'Download the fee or salary list' }
      ]},
      { key:'announcements', label:'Announcements', desc:'Publish and read school announcements', subFeatures:[
        { key:'publish', label:'Publish', desc:'Create a new announcement' },
        { key:'edit', label:'Edit', desc:'Modify an existing announcement' },
        { key:'delete', label:'Delete', desc:'Remove an announcement' },
        { key:'pin', label:'Pin', desc:'Pin an announcement to the top' }
      ]},
      { key:'enquiries', label:'Enquiries', desc:'Visitor messages from the public contact form', subFeatures:[
        { key:'view', label:'View', desc:'Open the enquiries inbox' },
        { key:'read', label:'Mark read', desc:'Mark messages as read' },
        { key:'delete', label:'Delete', desc:'Delete messages' },
        { key:'export', label:'Export', desc:'Download messages as CSV' },
        { key:'reply', label:'Reply', desc:'Reply to a message' }
      ]},
      { key:'homepage', label:'Home Page', desc:'Edit the public landing page content', subFeatures:[
        { key:'view', label:'View', desc:'Open the home page editor' },
        { key:'edit', label:'Edit content', desc:'Change hero, programs, gallery, carousel, etc.' },
        { key:'publish', label:'Publish', desc:'Push changes live to the public page' },
        { key:'upload', label:'Upload images', desc:'Add photos, logos, carousel slides' },
        { key:'reset', label:'Reset to defaults', desc:'Restore default content' }
      ]},
      { key:'hiring', label:'Hiring', desc:'Build application forms, review applications, publish results', subFeatures:[
        { key:'create', label:'Create position', desc:'Build a new hiring form' },
        { key:'edit', label:'Edit position', desc:'Change form fields, schedule, description' },
        { key:'delete', label:'Delete position', desc:'Remove a position and its applications' },
        { key:'publish', label:'Publish position', desc:'Make the position visible on the home page' },
        { key:'schedule', label:'Set schedule', desc:'Choose open and close dates' },
        { key:'review', label:'Review applications', desc:'Accept, shortlist, or reject applicants' },
        { key:'results', label:'Publish results', desc:'Release results to applicants' },
        { key:'export', label:'Export applications', desc:'Download applications as CSV' }
      ]},
      { key:'promotions', label:'Promotions', desc:'Promote classes, students, whole school' },
      { key:'termLock', label:'Semester lock / unlock', desc:'Lock a semester from further score edits' },
      { key:'settings', label:'School settings', desc:'School name, logo, principal signature' }
    ]},
    { title:'Requests', items:[
      { key:'transfers', label:'Transfers', desc:'Transfer students out or between classes', subFeatures:[
        { key:'create', label:'Create transfer', desc:'Request a transfer record' },
        { key:'issue', label:'Issue', desc:'Mark a transfer as issued' },
        { key:'reject', label:'Reject', desc:'Reject a pending transfer' },
        { key:'delete', label:'Delete', desc:'Remove a transfer record' },
        { key:'print', label:'Print letter', desc:'Open the transfer letter for printing' }
      ]},
      { key:'transcripts', label:'Transcripts', desc:'Request, approve, issue transcripts', subFeatures:[
        { key:'request', label:'Request', desc:'Submit a new transcript request' },
        { key:'approve', label:'Approve', desc:'Approve a pending request' },
        { key:'reject', label:'Reject', desc:'Reject a pending request' },
        { key:'issue', label:'Issue', desc:'Issue and open the transcript' },
        { key:'print', label:'Print', desc:'Reopen an issued transcript' },
        { key:'delete', label:'Delete', desc:'Delete a transcript request' }
      ]},
      { key:'recommendations', label:'Recommendations', desc:'Request, approve, issue letters', subFeatures:[
        { key:'request', label:'Request', desc:'Submit a new recommendation request' },
        { key:'approve', label:'Approve', desc:'Approve a pending request' },
        { key:'reject', label:'Reject', desc:'Reject a pending request' },
        { key:'issue', label:'Issue', desc:'Issue and open the letter' },
        { key:'print', label:'Print', desc:'Reopen an issued letter' },
        { key:'delete', label:'Delete', desc:'Delete a request' }
      ]},
      { key:'idcards', label:'ID Cards', desc:'Design and print student ID cards', subFeatures:[
        { key:'upload_photo', label:'Upload photo', desc:'Attach a photo to a student' },
        { key:'remove_photo', label:'Remove photo', desc:'Delete a student photo' },
        { key:'print_single', label:'Print single card', desc:"Print one student's ID card" },
        { key:'print_batch',  label:'Print batch', desc:'Print ID cards for multiple students' }
      ]}
    ]},
    { title:'Family', items:[
      { key:'children', label:'My Children', desc:'Linked students and their quick summaries', subFeatures:[
        { key:'report', label:'Open report card', desc:"Launch a child's report card" },
        { key:'fees', label:'View fees', desc:"See a child's fee account" },
        { key:'id_card', label:'Open ID card', desc:"Print a child's ID card" }
      ]}
    ]},
    { title:'System', items:[
      { key:'audit', label:'Audit Log', desc:'View every action taken in the system', subFeatures:[
        { key:'view', label:'View', desc:'Open the audit log' },
        { key:'clear', label:'Clear', desc:'Wipe the entire log' },
        { key:'export', label:'Export', desc:'Download the log as CSV' }
      ]},
      { key:'archive', label:'Archive', desc:'Close and browse past academic years', subFeatures:[
        { key:'view', label:'View archives', desc:'Browse past years and preview their data' },
        { key:'edit', label:'Edit archive records', desc:'Fix scores inside any archived year' },
        { key:'end_sem', label:'End semester', desc:'Lock and snapshot the current semester' },
        { key:'end_year', label:'End academic year', desc:'Promote students, reset fees, start a new year' },
        { key:'restore', label:'Restore as live', desc:'Restore an archive back into the live system' },
        { key:'delete', label:'Delete archive', desc:'Permanently remove an archive' }
      ]},
      { key:'userManagement', label:'User Management', desc:'Create, edit, disable users', subFeatures:[
        { key:'create', label:'Create user', desc:'Add a new user account' },
        { key:'edit', label:'Edit user', desc:'Change user details and permissions' },
        { key:'disable', label:'Disable', desc:'Block or restore sign-in' },
        { key:'reset_password', label:'Reset password', desc:'Assign a new password' },
        { key:'delete', label:'Delete user', desc:'Permanently remove a user' }
      ]}
    ]}
  ];

  const ALL_PERMISSION_KEYS = Array.from(new Set(PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key))));
  const ALL_SUB_FEATURE_KEYS = Array.from(new Set(PERMISSION_GROUPS.flatMap(g =>
    g.items.flatMap(i => (i.subFeatures || []).map(sf => i.key + '.' + sf.key)))));
  const ALL_KEYS = Array.from(new Set([...ALL_PERMISSION_KEYS, ...ALL_SUB_FEATURE_KEYS]));

  function renderedPermissionToggleCount(){
    let count = 0;
    PERMISSION_GROUPS.forEach(g => g.items.forEach(it => { count += 1; count += (it.subFeatures || []).length; }));
    return count;
  }
  function subFeaturesFor(menuKey){
    for(const g of PERMISSION_GROUPS){
      const it = g.items.find(x => x.key === menuKey);
      if(it) return (it.subFeatures || []).map(sf => ({ ...sf, full: menuKey + '.' + sf.key }));
    }
    return [];
  }

  function buildPreset(role){
    const p = {};
    ALL_KEYS.forEach(k => { p[k] = false; });
    const on = keys => keys.forEach(k => { p[k] = true; });
    switch(role){
      case 'Principal':
        ALL_KEYS.forEach(k => { p[k] = true; });
        break;
      case 'Registrar':
        on([
          'dashboard',
          'analytics','analytics.view','analytics.enrolment','analytics.attendance',
          'analytics.staff','analytics.timetable','analytics.dataHealth','analytics.export',
          'students','students.add','students.edit','students.delete','students.report','students.export',
          'parents','parents.add','parents.edit','parents.delete','parents.export',
          'teachers','teachers.add','teachers.edit','teachers.delete','teachers.assignments','teachers.sponsorship',
          'classes','classes.add','classes.delete','classes.archive','classes.manage_subjects','classes.promote',
          'timetable','timetable.settings','timetable.generate','timetable.edit','timetable.publish','timetable.view',
          'attendance','attendance.save','attendance.clear_day','attendance.mark_all',
          'exams','exams.view_pushes','exams.push','exams.approve','exams.return','exams.reopen','exams.bypass','exams.add','exams.edit','exams.delete',
          'reportcard','reportcard.open','reportcard.batch_print','reportcard.copy_prev_term',
          'quizzes','quizzes.create','quizzes.edit','quizzes.delete','quizzes.publish','quizzes.grade','quizzes.view_all','quizzes.reset','quizzes.assign','quizzes.export',
          'fees','fees.class_fees','fees.record_payment','fees.reverse_payment','fees.view_history','fees.export',
          'announcements','announcements.publish','announcements.edit','announcements.delete','announcements.pin',
          'enquiries','enquiries.view','enquiries.read','enquiries.delete','enquiries.export','enquiries.reply',
          'homepage','homepage.view','homepage.edit','homepage.upload',
          'hiring','hiring.create','hiring.edit','hiring.review','hiring.export',
          'transfers','transfers.create','transfers.issue','transfers.reject','transfers.delete','transfers.print',
          'transcripts','transcripts.request','transcripts.issue','transcripts.print','transcripts.delete',
          'recommendations','recommendations.request','recommendations.issue','recommendations.print','recommendations.delete',
          'idcards','idcards.upload_photo','idcards.remove_photo','idcards.print_single','idcards.print_batch',
          'audit','audit.view','audit.export',
          'archive','archive.view','archive.edit','archive.end_sem','archive.end_year',
          'settings'
        ]);
        break;
      case 'Teacher':
        on([
          'dashboard',
          'students','students.report',
          'classes',
          'timetable','timetable.view',
          'attendance','attendance.save','attendance.mark_all',
          'exams','exams.view_pushes','exams.add','exams.edit',
          'reportcard','reportcard.open',
          'quizzes','quizzes.create','quizzes.edit','quizzes.publish','quizzes.grade','quizzes.view_all','quizzes.reset','quizzes.assign','quizzes.export',
          'announcements',
          'recommendations','recommendations.request',
          'idcards','idcards.print_single'
        ]);
        break;
      case 'Student':
        on([
          'dashboard','reportcard','reportcard.open','quizzes','fees','fees.view_history',
          'announcements','timetable','timetable.view','transcripts','transcripts.request',
          'recommendations','recommendations.request','idcards','idcards.print_single'
        ]);
        break;
      case 'Parent':
        on([
          'dashboard','reportcard','reportcard.open','fees','fees.view_history',
          'announcements','timetable','timetable.view','transcripts','transcripts.request',
          'recommendations','recommendations.request','idcards','idcards.print_single',
          'children','children.report','children.fees','children.id_card'
        ]);
        break;
    }
    return p;
  }

  const ROLE_PRESETS = {
    Principal: buildPreset('Principal'),
    Registrar: buildPreset('Registrar'),
    Teacher:   buildPreset('Teacher'),
    Student:   buildPreset('Student'),
    Parent:    buildPreset('Parent')
  };

  const ROLE_CONSTRAINTS = {
    Principal: { requiredLink: null, forbidden: [], label: 'Principal / Head Teacher' },
    Registrar: { requiredLink: null, forbidden: ['userManagement'], label: 'Registrar' },
    Teacher: { requiredLink: 'linkedTeacherId', forbidden: ['userManagement','settings','parents','analytics'], label: 'Teacher' },
    Student: {
      requiredLink: 'linkedStudentId',
      forbidden: [
        'userManagement','settings','fees','teachers','classes','students','parents',
        'audit','archive','attendance','exams','reportcard','announcements','transfers','transcripts',
        'recommendations','idcards','promotions','termLock','timetable','analytics','homepage','hiring','enquiries'
      ],
      label: 'Student'
    },
    Parent: {
      requiredLink: 'linkedStudentIds',
      forbidden: [
        'userManagement','settings','parents','analytics','homepage','hiring','enquiries',
        'fees.class_fees','fees.record_payment','fees.reverse_payment','fees.salary','fees.reverse_salary',
        'teachers','classes','students','audit','archive','attendance','exams',
        'exams.add','exams.edit','exams.delete','exams.push','exams.approve','exams.return','exams.reopen','exams.bypass',
        'reportcard.batch_print','reportcard.lock_term','reportcard.unlock_term','reportcard.copy_prev_term',
        'quizzes.create','quizzes.edit','quizzes.delete','quizzes.publish','quizzes.grade','quizzes.view_all','quizzes.reset','quizzes.assign',
        'announcements.publish','announcements.edit','announcements.delete','announcements.pin',
        'timetable.settings','timetable.generate','timetable.edit','timetable.publish'
      ],
      label: 'Parent / Guardian'
    }
  };

  function roleForbids(role, key){
    const c = ROLE_CONSTRAINTS[role];
    if(!c) return false;
    return c.forbidden.some(f => key === f || key.startsWith(f + '.'));
  }

  function validateUserRecord(record, allUsers, selfId){
    const errors = [], warnings = [];
    const c = ROLE_CONSTRAINTS[record.role];
    if(!c) errors.push('Unknown role: ' + record.role);
    if(c && c.requiredLink){
      const val = record[c.requiredLink];
      const empty = Array.isArray(val) ? !val.length : !val;
      if(empty){
        const noun = c.requiredLink === 'linkedStudentIds' ? 'child'
                  : c.requiredLink === 'linkedStudentId' ? 'student' : 'teacher';
        errors.push(`${c.label} accounts must be linked to a ${noun} record.`);
      }
    }
    Object.keys(record.permissions || {}).forEach(k => {
      if(record.permissions[k] && roleForbids(record.role, k)){
        warnings.push(`Override: the ${c ? c.label : record.role} role normally cannot have "${k}".`);
      }
    });
    if(allUsers){
      const clash = allUsers.find(u => u.id !== selfId && String(u.username||'').toLowerCase() === String(record.username||'').toLowerCase());
      if(clash) errors.push('Username already in use.');
    }
    if(allUsers && selfId){
      const others = allUsers.filter(u => u.id !== selfId && u.role === 'Principal' && u.active);
      if(others.length === 0 && record.role !== 'Principal') errors.push('This is the only active Principal. You cannot change its role.');
      if(others.length === 0 && record.active === false) errors.push('This is the only active Principal. It cannot be disabled.');
    }
    if(record.role === 'Teacher' && !record.linkedTeacherId) warnings.push('No linked teacher record — class scope will be empty.');
    return { ok: errors.length === 0, errors, warnings };
  }
  function canAssignRole(role){
    const u = currentUser();
    if(!u) return false;
    return u.role === 'Principal';
  }

  const PAGE_REGISTRY = [
    { key:'dashboard',       label:'Dashboard',         icon:'▦', group:'Main menu',      perm:'dashboard',  file:null },
    { key:'analytics',       label:'Analytics',         icon:'📊', group:'Main menu',     perm:'analytics',  file:'analytics.html' },
    { key:'children',        label:'My Children',       icon:'👨‍👩‍👧', group:'Family',      perm:'children',   file:'children.html' },
    { key:'students',        label:'Students',          icon:'♙', group:'Main menu',      perm:'students',   file:'students.html' },
    { key:'parents',         label:'Parents',           icon:'👪', group:'Main menu',      perm:'parents',    file:'parents.html' },
    { key:'teachers',        label:'Teachers',          icon:'♧', group:'Main menu',      perm:'teachers',   file:'teachers.html' },
    { key:'subjects',        label:'Subjects',          icon:'📚', group:'Academic',      perm:'classes',    file:'subjects.html' },
    { key:'classes',         label:'Classes',           icon:'▤', group:'Academic',      perm:'classes',    file:'classes.html' },
    { key:'timetable',       label:'Timetable',         icon:'📅', group:'Academic',      perm:'timetable',  file:'timetable.html' },
    { key:'attendance',      label:'Attendance',        icon:'✓', group:'Academic',      perm:'attendance', file:'attendance.html' },
    { key:'gradesheet',      label:'Gradesheet',        icon:'✎', group:'Academic',      perm:'exams',      file:'gradesheet.html' },
    { key:'ledger',          label:'Gradesheet Ledger', icon:'▦', group:'Academic',      perm:'reportcard', file:'report-card-ledger.html' },
    { key:'quizzes',         label:'Quizzes',           icon:'📝', group:'Academic',     perm:'quizzes',    file:'quizzes.html' },
    { key:'fees',            label:'Fees',              icon:'＄', group:'Administration',perm:'fees',       file:'fees.html' },
    { key:'announcements',   label:'Announcements',     icon:'◉', group:'Administration',perm:'announcements',file:'announcements.html' },
    { key:'enquiries',       label:'Enquiries',         icon:'✉', group:'Administration',perm:'enquiries',  file:'enquiries.html' },
    { key:'homepage',        label:'Home Page',         icon:'🏠', group:'Administration',perm:'homepage',   file:'homepage-admin.html' },
    { key:'hiring',          label:'Hiring',            icon:'💼', group:'Administration',perm:'hiring',     file:'hiring-admin.html' },
    { key:'settings',        label:'Settings',          icon:'⚙', group:'Administration',perm:'settings',   file:'settings.html' },
    { key:'transfers',       label:'Transfers',         icon:'⇄', group:'Requests',      perm:'transfers',  file:'transfers.html' },
    { key:'transcripts',     label:'Transcripts',       icon:'🎓', group:'Requests',     perm:'transcripts',file:'transcripts.html' },
    { key:'recommendations', label:'Recommendations',   icon:'✉', group:'Requests',      perm:'recommendations', file:'recommendations.html' },
    { key:'idcards',         label:'ID Cards',          icon:'🪪', group:'Requests',     perm:'idcards',    file:'id-cards.html' },
    { key:'audit',           label:'Audit Log',         icon:'🗒', group:'System',       perm:'audit',      file:'audit.html' },
    { key:'archive',         label:'Archive',           icon:'📦', group:'System',       perm:'archive',    file:'archive.html' },
    { key:'users',           label:'User Management',   icon:'👥', group:'System',       perm:'userManagement', file:'users.html' },
    { key:'principals',      label:'Principals',        icon:'👑', group:'System',       perm:'userManagement', file:'principals.html' },
    { key:'registrars',      label:'Registrars',        icon:'📋', group:'System',       perm:'userManagement', file:'registrars.html' }
  ];

  /* ============================================================
     MIGRATIONS
     ============================================================ */
  (function migrateClassCategories(){
    if(readStore(STORE_KEYS.migratedCategories, false)) return;
    const classes = readStore(STORE_KEYS.classes, []) || [];
    let changed = false;
    classes.forEach(c => {
      if(!c.category){
        const name = String(c.name || '').trim();
        if(/^nursery/i.test(name)) c.category = 'Nursery';
        else if(/^k-?\s*1/i.test(name)) c.category = 'K-1';
        else if(/^k-?\s*2/i.test(name)) c.category = 'K-2';
        else { const m = name.match(/(\d+)/); if(m){ const n = Number(m[1]); if(n >= 1 && n <= 12) c.category = 'Grade ' + n; } }
        changed = true;
      }
    });
    if(changed) writeStore(STORE_KEYS.classes, classes);
    writeStore(STORE_KEYS.migratedCategories, true);
  })();
  (function migrateResultsToPeriods(){
    if(readStore(STORE_KEYS.migratedResults, false)) return;
    const list = readStore(STORE_KEYS.results, []) || [];
    const map = { 'First Term':{semester:1,period:1}, 'Second Term':{semester:1,period:2}, 'Third Term':{semester:2,period:4}, 'Annual Report':{semester:2,period:5} };
    let changed = false;
    list.forEach(r => {
      if(r.semester && r.period) return;
      const m = map[r.term] || { semester:1, period:1 };
      r.semester = m.semester; r.period = m.period;
      if(!r.year) r.year = currentAcademicYear();
      delete r.term;
      changed = true;
    });
    if(changed) writeStore(STORE_KEYS.results, list);
    writeStore(STORE_KEYS.migratedResults, true);
  })();
  (function migrateResultStatus(){
    if(readStore(STORE_KEYS.migratedResultStatus, false)) return;
    const list = readStore(STORE_KEYS.results, []) || [];
    let changed = false;
    list.forEach(r => {
      if(!r.status){ r.status = 'approved'; r.approvedAt = r.updatedAt || r.createdAt || new Date().toISOString(); r.approvedBy = r.updatedBy || 'system'; changed = true; }
      if(!r.studentId){
        const s = (readStore(STORE_KEYS.students, []) || []).find(x => x.name === r.student && x.class === r.class);
        if(s){ r.studentId = s.id; changed = true; }
      }
    });
    if(changed) writeStore(STORE_KEYS.results, list);
    writeStore(STORE_KEYS.migratedResultStatus, true);
  })();
  (function migrateFees(){
    if(readStore(STORE_KEYS.migratedFees, false)) return;
    const classFees = getClassFees();
    const oldPlans = readStore('educoreFeePlans', {}) || {};
    Object.keys(oldPlans).forEach(className => {
      if(classFees[className]) return;
      const plan = oldPlans[className];
      const items = plan && Array.isArray(plan.items) ? plan.items : [];
      const tuition = items.filter(i => /tuition/i.test(i.label || '') || /tuition/i.test(i.code || '')).reduce((a,i) => a + Number(i.amount || 0), 0);
      const extras = items.filter(i => !(/tuition/i.test(i.label || '') || /tuition/i.test(i.code || ''))).reduce((a,i) => a + Number(i.amount || 0), 0);
      if(items.length){
        classFees[className] = { className, tuition: round2(tuition || items.reduce((a,i) => a + Number(i.amount || 0), 0)), extra: round2(extras), updatedAt: new Date().toISOString(), migrated: true };
      }
    });
    writeStore(STORE_KEYS.classFees, classFees);
    const payments = readStore(STORE_KEYS.payments, []) || [];
    let changed = false;
    payments.forEach(p => { if(p.reversed === undefined){ p.reversed = false; changed = true; } });
    if(changed) writeStore(STORE_KEYS.payments, payments);
    writeStore(STORE_KEYS.migratedFees, true);
  })();
  (function seedParentsFromGuardians(){
    const KEY = 'educoreParentsSeededFromGuardians';
    if(readStore(KEY, false)) return;
    const existing = getParents();
    if(existing.length){ writeStore(KEY, true); return; }
    const students = readStore(STORE_KEYS.students, []) || [];
    const seen = new Set();
    const seeded = [];
    students.forEach(s => {
      const g = String(s.guardian || '').trim();
      if(!g) return;
      const key = g.toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      seeded.push({
        id: 'PAR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase(),
        name: g, phone: String(s.phone || '').trim(), email: '',
        address: String(s.address || '').trim(), occupation: '', relationship: '',
        notes: 'Imported from existing student guardian records.',
        createdAt: new Date().toISOString(), createdBy: 'system', updatedAt: new Date().toISOString()
      });
    });
    if(seeded.length) writeStore(STORE_KEYS.parents, seeded);
    writeStore(KEY, true);
  })();
  (function backfillResultStudentIds(){
    if(readStore(STORE_KEYS.migratedResultStudentIds, false)) return;
    const results = readStore(STORE_KEYS.results, []) || [];
    const students = readStore(STORE_KEYS.students, []) || [];
    let changed = 0;
    results.forEach(r => {
      if(r.studentId) return;
      const s = students.find(x => x.name === r.student && x.class === r.class);
      if(s){ r.studentId = s.id; changed++; }
    });
    if(changed){
      writeStore(STORE_KEYS.results, results);
      audit('update', 'Backfill result.studentId', '', `${changed} rows`);
    }
    writeStore(STORE_KEYS.migratedResultStudentIds, true);
  })();
  (function backfillSubmittedPushIds(){
    if(readStore(STORE_KEYS.migratedSubmittedPushIds, false)) return;
    const results = readStore(STORE_KEYS.results, []) || [];
    const pushes = readStore(STORE_KEYS.gradePushes, []) || [];
    let changed = 0;
    results.forEach(r => {
      if(r.pushId) return;
      if(r.status !== 'submitted' && r.status !== 'draft') return;
      const p = pushes.find(x =>
        x.className === r.class &&
        normSubject(x.subject) === normSubject(r.subject) &&
        Number(x.semester) === Number(r.semester) &&
        String(x.period) === String(r.period) &&
        x.year === r.year
      );
      if(p){ r.pushId = p.id; changed++; }
    });
    if(changed){
      writeStore(STORE_KEYS.results, results);
      const pushesNow = readStore(STORE_KEYS.gradePushes, []) || [];
      pushesNow.forEach(p => refreshPushRollupInto(p));
      writeStore(STORE_KEYS.gradePushes, pushesNow);
      audit('update', 'Backfill result.pushId', '', `${changed} rows`);
    }
    writeStore(STORE_KEYS.migratedSubmittedPushIds, true);
  })();
  (function autoSeedSubjectNames(){
    if(readStore(STORE_KEYS.migratedAutoSeedSubjects, false)) return;
    const subjects = readStore(STORE_KEYS.subjects, []) || [];
    const knownCodes = new Set(subjects.map(s => String(s.code || '').toUpperCase()));
    const codes = new Set();
    (readStore(STORE_KEYS.classes, []) || []).forEach(c => {
      (c.subjects || []).forEach(code => { if(code) codes.add(String(code).toUpperCase()); });
    });
    (readStore(STORE_KEYS.assignments, []) || []).forEach(a => {
      if(a.subject) codes.add(String(a.subject).toUpperCase());
    });
    (readStore(STORE_KEYS.results, []) || []).forEach(r => {
      if(r.subject){
        const raw = String(r.subject);
        if(/^[A-Z0-9]{2,8}$/.test(raw)) codes.add(raw);
      }
    });
    (readStore(STORE_KEYS.quizzes, []) || []).forEach(q => {
      if(q.subject){
        const raw = String(q.subject);
        if(/^[A-Z0-9]{2,8}$/.test(raw)) codes.add(raw);
      }
    });
    let added = 0;
    codes.forEach(code => {
      if(knownCodes.has(code)) return;
      subjects.push({
        code,
        name: code,
        department: 'Unassigned',
        archived: false,
        autoSeeded: true,
        seededAt: new Date().toISOString()
      });
      added++;
    });
    if(added){
      writeStore(STORE_KEYS.subjects, subjects);
      audit('create', 'Subjects auto-seeded', '', `${added} codes added from class/assignment references`);
    }
    writeStore(STORE_KEYS.migratedAutoSeedSubjects, true);
  })();
  (function stripExamsFromStudentsAndParents(){
    if(readStore(STORE_KEYS.migratedStripExams, false)) return;
    const users = readStore(STORE_KEYS.users, []) || [];
    let changed = 0;
    users.forEach(u => {
      if(u.role !== 'Student' && u.role !== 'Parent') return;
      if(!u.permissions) return;
      let touched = false;
      if(u.permissions.exams){ u.permissions.exams = false; touched = true; }
      Object.keys(u.permissions).forEach(k => {
        if(k.startsWith('exams.') && u.permissions[k]){
          u.permissions[k] = false;
          touched = true;
        }
      });
      if(touched) changed++;
    });
    if(changed){
      writeStore(STORE_KEYS.users, users);
      audit('update', 'Strip exams from non-staff users', '', `${changed} users updated`);
    }
    writeStore(STORE_KEYS.migratedStripExams, true);
  })();
  (function canonicalizeSubjects(){
    if(readStore(STORE_KEYS.migratedSubjectCanonical, false)) return;
    const subjects = readStore(STORE_KEYS.subjects, []) || [];
    const nameFor = v => {
      if(!v) return '';
      const found = subjects.find(s =>
        String(s.code || '').toLowerCase() === String(v).toLowerCase() ||
        String(s.name || '').toLowerCase() === String(v).toLowerCase()
      );
      return found ? found.name : v;
    };
    let touched = 0;

    const results = readStore(STORE_KEYS.results, []) || [];
    results.forEach(r => {
      if(!r.subject) return;
      const canonical = nameFor(r.subject);
      if(canonical && canonical !== r.subject){ r.subject = canonical; touched++; }
    });
    if(touched) writeStore(STORE_KEYS.results, results);

    const pushes = readStore(STORE_KEYS.gradePushes, []) || [];
    let pushTouched = 0;
    pushes.forEach(p => {
      if(!p.subject) return;
      const canonical = nameFor(p.subject);
      if(canonical && canonical !== p.subject){ p.subject = canonical; pushTouched++; }
    });
    if(pushTouched) writeStore(STORE_KEYS.gradePushes, pushes);

    const archives = readStore(STORE_KEYS.archives, {}) || {};
    let archiveTouched = 0;
    Object.values(archives).forEach(ar => {
      const list = ar.snapshot?.results || [];
      list.forEach(r => {
        if(!r.subject) return;
        const canonical = nameFor(r.subject);
        if(canonical && canonical !== r.subject){ r.subject = canonical; archiveTouched++; }
      });
    });
    if(archiveTouched) writeStore(STORE_KEYS.archives, archives);

    if(touched || pushTouched || archiveTouched){
      audit('update', 'Subject canonicalization', '',
        `${touched} results · ${pushTouched} pushes · ${archiveTouched} archived rows normalized`);
    }
    writeStore(STORE_KEYS.migratedSubjectCanonical, true);
  })();
  (function migratePublicVerifyFlag(){
    if(readStore(STORE_KEYS.migratedPublicVerify, false)) return;
    const users = readStore(STORE_KEYS.users, []) || [];
    let changed = 0;
    users.forEach(u => {
      if(typeof u.showInPublicVerify === 'undefined'){
        u.showInPublicVerify = (u.role === 'Student' || u.role === 'Teacher');
        changed++;
      }
    });
    if(changed) writeStore(STORE_KEYS.users, users);
    writeStore(STORE_KEYS.migratedPublicVerify, true);
  })();

  /* ============================================================
     migrateUserProfileFields() — now includes qualification
     ============================================================ */
  (function migrateUserProfileFields(){
    const KEY = 'educoreMigratedUserProfileFields';
    if(readStore(KEY, false)) return;
    const users = readStore(STORE_KEYS.users, []) || [];
    let changed = 0;
    const newFields = ['photo','nationality','ethnicGroup','religion','countyOfOrigin','passSchool','qualification'];
    users.forEach(u => {
      newFields.forEach(k => {
        if(typeof u[k] === 'undefined'){ u[k] = ''; changed++; }
      });
    });
    if(changed){
      writeStore(STORE_KEYS.users, users);
      audit('update', 'User profile fields', '', `${changed} fields defaulted across ${users.length} users`);
    }
    writeStore(KEY, true);
  })();

  /* ============================================================
     EXPORTS
     ============================================================ */
  global.EduCore = {
    STORE_KEYS, readStore, writeStore, removeStore, storageAvailable,
    DEVICE_ID, SESSION_TTL_MIN,
    currentUser, hasPerm, can, requireLogin, requirePerm, logout,
    readAudit, writeAudit, audit,
    $, $$, esc, initials, money, todayISO, fmtDate, fmtDateTime, round2,
    toast, openModal, closeModal, confirmModal, showDenied, injectBackPill, confirmTyped,
    NURSERY_SCALE, DEFAULT_NUMERIC_SCALE, numericScale,
    CATEGORY_LIST, isNurseryCategory,
    resolveGradingScale, gradeFromNumber, gradeFromNurseryNumber,
    gradeFromScore, grade, remarkForGrade, midpointForLetter,
    validateScore, averageScores,
    SEMESTER_1_PERIODS, SEMESTER_2_PERIODS, ALL_PERIODS,
    periodsForSemester, periodMeta, currentAcademicYear, weightConfig,
    readGradePushes, writeGradePushes, getGradePush,
    createGradePushes, markPushOpened,
    submitGradePush, approveGradePush, returnGradePush, hideGradePush, reopenGradePush,
    autoLockExpiredPushes, ensureFreshGradePushStates,
    refreshPushRollup, refreshPushRollupInto,
    findPush, findPushForStudentView,
    isScoreApproved, pushProgress, pushStatusLabel,
    pendingPushCountForTeacher, pendingApprovalCount,
    readResults, writeResults, filterResultsByApproval,
    periodResultsFor, scoreFor, saveScore,
    semesterAverageFor, yearlyAverageFor, subjectLedgerRow,
    getSubjects, subjectByCode, subjectName, ensureSubject, normSubject,
    getClasses, classByName, classCategoryFor, isNurseryClass,
    getTeachers, getAssignments, assignmentsForTeacher,
    getSponsors, classSponsor, sponsorClassOf, setSponsor, clearSponsor,
    currentTeacherId, childrenOf,
    taughtSubjectsInClass, isSponsorOfClass, canEditSubject,
    visibleClassNamesFor, visibleStudentsFor, visibleResultsFor,
    getParents, parentById, parentByName, addParent, updateParent, deleteParent,
    allGuardianNames,
    updateLinkedUserProfile,
    readSemesters, isSemesterLocked, setSemesterLock,
    getClassFees, setClassFee, clearClassFee, classFeeFor, classBilledTotal,
    getAdjustments, discountFor,
    getPayments, paidFor,
    studentFeeSummary, recordPayment, reversePayment,
    getReportThreshold, setReportThreshold, reportAccessFor, canOpenReportCard,
    viewerGradesheetAccess, renderGradesheetLocked, nextReceiptNumber,
    getSalaryPayments, computeSalary, recordSalary, reverseSalary,
    announcementVisibleTo, announcementIsLive,
    getAnnouncementReads, hasReadAnnouncement, markAnnouncementRead,
    readCountFor, getAnnouncementAcks, hasAcknowledged, acknowledgeAnnouncement,
    ackCountFor, unreadAnnouncementCount, audienceSizeFor,
    QUESTION_TYPES, questionTypeMeta,
    getQuizzes, saveQuiz, getQuiz, deleteQuiz,
    getQuizQuestions, questionsForQuiz, saveQuestion, deleteQuestion,
    quizTotalMarks, quizIsReady,
    getQuizAttempts, saveAttempt, createAttempt, existingAttemptFor, resetAttempt,
    getQuizResponses, responsesForAttempt, saveResponse,
    gradeResponse, computeAttemptScore, submitAttempt,
    setManualPoints, canTakeQuiz, quizAssignedToStudent, quizResultsCSV,
    readArchives, writeArchives, archiveList, isArchiveEditable, canEditArchive,
    takeSnapshot, studentYearlyAverage, nextCategory, findClassForCategory,
    endAcademicYear, endSemester, restoreArchive, deleteArchive,
    archivedResultsForStudent, getArchive, updateArchivedResult, deleteArchivedResult,
    archivedLedgerRow, reportCardSource,
    saveEnquiry, readEnquiries,
    markEnquiryRead, markEnquiryUnread, deleteEnquiry,
    replyToEnquiry, unreadEnquiryCount,
    DEFAULT_HOMEPAGE, getHomepage, getHomepageLive, getHomepageDraft,
    saveHomepageDraft, publishHomepage, resetHomepage,
    verifyMember,
    readHiringForms, writeHiringForms, getHiringForm,
    computeHiringStatus, saveHiringForm, deleteHiringForm, listOpenHiringForms,
    readHiringApplications, writeHiringApplications,
    generateVerifyCode, submitHiringApplication, reviewHiringApplication,
    publishHiringResults, checkHiringStatus,
    DAY_KEYS, getTimetableSettings, saveTimetableSettings,
    computePeriodsPerDay, buildPeriodGrid,
    getTeacherAvailability, saveTeacherAvailability,
    getTimetable, writeTimetable, clearTimetable,
    publishTimetable, isTimetablePublished,
    generateTimetable, saveGeneratedTimetable,
    deleteLesson, updateLesson, checkLessonConflict,
    lessonsForClass, lessonsForTeacher, lessonsForStudent, buildTimetableGrid,
    PERMISSION_GROUPS, ALL_PERMISSION_KEYS, ALL_SUB_FEATURE_KEYS, ALL_KEYS,
    renderedPermissionToggleCount, ROLE_PRESETS, ROLE_CONSTRAINTS,
    roleForbids, validateUserRecord, canAssignRole, PAGE_REGISTRY, subFeaturesFor
  };
})(window);