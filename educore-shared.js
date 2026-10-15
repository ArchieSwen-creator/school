/* ============================================================
   EduCore Shared Helpers
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
    teachers: 'educoreTeachers',
    announcements: 'educoreAnnouncements',
    subjects: 'educoreSubjects',
    assignments: 'educoreAssignments',
    sponsors: 'educoreSponsors',
    enrollments: 'educoreEnrollments',
    archives: 'educoreArchives',
    salaryPayments: 'educoreSalaryPayments',
    migratedCategories: 'educoreMigratedCategoriesV2',
    migratedResults: 'educoreMigratedResultsToPeriodsV1',
    migratedFees: 'educoreMigratedFeesV3'
  };

  function readStore(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }catch(e){ return fallback; }
  }
  function writeStore(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
  }
  function removeStore(key){
    try{ localStorage.removeItem(key); }catch(e){}
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

  function currentUser(){
    const session = readStore(STORE_KEYS.session, null);
    if(!session) return null;
    const users = readStore(STORE_KEYS.users, []) || [];
    const u = users.find(x => x.id === session.userId);
    return (u && u.active) ? u : null;
  }
  function hasPerm(perm){
    const u = currentUser();
    return !!(u && u.permissions && u.permissions[perm]);
  }
  function can(key){
    const u = currentUser();
    if(!u || !u.permissions) return false;
    if(Object.prototype.hasOwnProperty.call(u.permissions, key)){
      return !!u.permissions[key];
    }
    if(key.indexOf('.') === -1) return !!u.permissions[key];
    const parentMenu = key.split('.')[0];
    return !!u.permissions[parentMenu];
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
    if(!hasPerm(perm)){
      showDenied(pageLabel || perm);
      return null;
    }
    return u;
  }
  function logout(){
    const u = currentUser();
    if(u) audit('logout', 'User ' + u.username, '', '');
    writeStore(STORE_KEYS.session, null);
    window.location.href = 'index.html';
  }

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
    return isNurseryCategory(c)
      ? { type:'letter',  scale: NURSERY_SCALE }
      : { type:'numeric', scale: numericScale() };
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
      if(typeof raw === 'string' && /^[A-Fa-f]$/.test(raw.trim())){
        return { ok:true, normalized: raw.trim().toUpperCase() };
      }
      const n = Number(raw);
      if(!Number.isFinite(n) || n < 0 || n > 100){
        return { ok:false, error:'Nursery scores must be a letter A–F or a number 0–100.' };
      }
      return { ok:true, normalized: gradeFromNumber(n, category) };
    }
    const n = Number(raw);
    if(!Number.isFinite(n) || n < 0 || n > 100){
      return { ok:false, error:'Enter a score between 0 and 100.' };
    }
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
    { key: 1,    label:'P1', short:'P1', semester:1, isExam:false },
    { key: 2,    label:'P2', short:'P2', semester:1, isExam:false },
    { key: 3,    label:'P3', short:'P3', semester:1, isExam:false },
    { key:'e1',  label:'Exam', short:'S1 Exam', semester:1, isExam:true }
  ];
  const SEMESTER_2_PERIODS = [
    { key: 4,    label:'P4', short:'P4', semester:2, isExam:false },
    { key: 5,    label:'P5', short:'P5', semester:2, isExam:false },
    { key: 6,    label:'P6', short:'P6', semester:2, isExam:false },
    { key:'e2',  label:'Exam', short:'S2 Exam', semester:2, isExam:true }
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
  function periodResultsFor(studentName, className, subject, year){
    const y = year || currentAcademicYear();
    return readResults().filter(r =>
      r.student === studentName && r.class === className && r.subject === subject &&
      (r.year === y || !r.year)
    );
  }
  function scoreFor(studentName, className, subject, semester, period, year){
    const rows = periodResultsFor(studentName, className, subject, year);
    const row = rows.find(r =>
      Number(r.semester) === Number(semester) &&
      String(r.period) === String(period));
    return row ? row.score : '';
  }
  function saveScore({ student, className, subject, semester, period, score, year }){
    const clsCategory = classCategoryFor(className);
    const v = validateScore(score, clsCategory);
    if(!v.ok) return { ok:false, error: v.error };
    const y = year || currentAcademicYear();
    const list = readResults();
    const idx = list.findIndex(r =>
      r.student === student && r.class === className && r.subject === subject &&
      String(r.period) === String(period) && Number(r.semester) === Number(semester) &&
      (r.year === y || !r.year)
    );
    const u = currentUser();
    const payload = {
      student, class: className, subject, year: y,
      semester: Number(semester), period: period,
      score: v.normalized,
      updatedAt: new Date().toISOString(),
      updatedBy: u ? u.username : ''
    };
    if(idx >= 0){
      list[idx] = Object.assign({}, list[idx], payload);
    } else {
      if(v.normalized === '') return { ok:true, skipped:true };
      list.push(Object.assign({ id: 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6) }, payload));
    }
    writeStore(STORE_KEYS.results, list);
    return { ok:true };
  }

  /* ============================================================
     AVERAGES
     ============================================================ */
  function semesterAverageFor(studentName, className, subject, semester, category, year){
    const cat = category || classCategoryFor(className);
    const periods = periodsForSemester(semester);
    const nonExam = periods.filter(p => !p.isExam);
    const exam = periods.find(p => p.isExam);
    const nonExamVals = nonExam
      .map(p => scoreFor(studentName, className, subject, semester, p.key, year))
      .filter(v => v !== '' && v !== null && v !== undefined);
    const examVal = exam ? scoreFor(studentName, className, subject, semester, exam.key, year) : '';
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
  function yearlyAverageFor(studentName, className, subject, category, year){
    const cat = category || classCategoryFor(className);
    const s1 = semesterAverageFor(studentName, className, subject, 1, cat, year);
    const s2 = semesterAverageFor(studentName, className, subject, 2, cat, year);
    const w = weightConfig();
    if(s1 && s2){
      const mean = s1.number * w.semesterWeight + s2.number * (1 - w.semesterWeight);
      return { letter: gradeFromNumber(mean, cat), number: mean };
    }
    if(s1) return s1;
    if(s2) return s2;
    return null;
  }
  function subjectLedgerRow(studentName, className, subject, year){
    const cat = classCategoryFor(className);
    const g = k => scoreFor(studentName, className, subject,
      (Number(k) >= 4 || k === 'e2') ? 2 : 1, k, year);
    const s1 = semesterAverageFor(studentName, className, subject, 1, cat, year);
    const s2 = semesterAverageFor(studentName, className, subject, 2, cat, year);
    const yr = yearlyAverageFor(studentName, className, subject, cat, year);
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
  function subjectByCode(code){ return getSubjects(true).find(s => s.code === code); }
  function subjectName(code){ const s = subjectByCode(code); return s ? s.name : code; }
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
     TEACHERS + ASSIGNMENTS + SPONSOR
     ============================================================ */
  function getTeachers(){ return readStore(STORE_KEYS.teachers, []) || []; }
  function getAssignments(filter){
    filter = filter || {};
    const list = readStore(STORE_KEYS.assignments, []) || [];
    return list.filter(a =>
      (!filter.teacherId || a.teacherId === filter.teacherId) &&
      (!filter.className || a.className === filter.className) &&
      (!filter.subject   || a.subject   === filter.subject) &&
      (!filter.semester  || Number(a.semester) === Number(filter.semester))
    );
  }
  function assignmentsForTeacher(tid){ return getAssignments({ teacherId: tid }); }
  function getSponsors(){ return readStore(STORE_KEYS.sponsors, {}) || {}; }
  function classSponsor(className){
    const tid = getSponsors()[className];
    if(!tid) return null;
    const teachers = getTeachers();
    return teachers.find(t => t.id === tid) || null;
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
    const teachers = getTeachers();
    const t = teachers.find(x => x.name === u.name);
    return t ? t.id : null;
  }

  function taughtSubjectsInClass(user, className){
    if(!user || user.role !== 'Teacher') return [];
    const tid = currentTeacherId();
    if(!tid) return [];
    const mine = assignmentsForTeacher(tid).filter(a => a.className === className);
    const names = new Set();
    mine.forEach(a => {
      if(!a.subject) return;
      names.add(subjectName(a.subject));
      names.add(a.subject);
    });
    return Array.from(names);
  }
  function isSponsorOfClass(user, className){
    if(!user || user.role !== 'Teacher') return false;
    const tid = currentTeacherId();
    if(!tid) return false;
    return sponsorClassOf(tid) === className;
  }
  function canEditSubject(user, className, subjectNameValue){
    if(!user) return false;
    if(user.role !== 'Teacher') return true;
    const taught = taughtSubjectsInClass(user, className);
    if(!taught.length) return false;
    return taught.includes(subjectNameValue);
  }

  /* ============================================================
     PARENT CHILDREN
     ============================================================ */
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

  /* ============================================================
     VISIBILITY
     ============================================================ */
  function visibleClassNamesFor(user){
    if(!user) return [];
    const classes = getClasses();
    const students = readStore(STORE_KEYS.students, []) || [];
    if(user.role === 'Student'){
      const s = students.find(x => x.id === user.linkedStudentId);
      return s ? [s.class] : [];
    }
    if(user.role === 'Parent'){
      const kids = childrenOf(user);
      return Array.from(new Set(kids.map(k => k.class).filter(Boolean)));
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
  function visibleResultsFor(user){
    const results = readResults();
    if(!user) return [];
    if(user.role === 'Student' || user.role === 'Parent'){
      const kids = user.role === 'Student'
        ? (readStore(STORE_KEYS.students, []) || []).filter(s => s.id === user.linkedStudentId)
        : childrenOf(user);
      const names = new Set(kids.map(k => k.name));
      return results.filter(r => names.has(r.student));
    }
    if(user.role === 'Teacher'){
      const tid = currentTeacherId();
      if(!tid) return [];
      const mine = assignmentsForTeacher(tid);
      const sponsored = sponsorClassOf(tid);
      return results.filter(r => {
        const teachesIt = mine.some(a =>
          a.className === r.class &&
          (subjectName(a.subject) === r.subject || a.subject === r.subject));
        const isSponsoredClass = sponsored && r.class === sponsored;
        return teachesIt || isSponsoredClass;
      });
    }
    return results;
  }

  /* ============================================================
     SEMESTER LOCKS + ARCHIVE
     ============================================================ */
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
  function readArchives(){ return readStore(STORE_KEYS.archives, {}) || {}; }
  function writeArchives(obj){ writeStore(STORE_KEYS.archives, obj); }
  function archivedTermKeys(){ return Object.keys(readArchives()); }
  function isTermArchived(termKey){ return !!readArchives()[termKey]; }

  /* ============================================================
     FEES ENGINE
     ============================================================ */
  function getClassFees(){ return readStore(STORE_KEYS.classFees, {}) || {}; }
  function setClassFee(className, tuition, extra){
    const all = getClassFees();
    all[className] = {
      className,
      tuition: round2(tuition),
      extra: round2(extra),
      updatedAt: new Date().toISOString()
    };
    writeStore(STORE_KEYS.classFees, all);
  }
  function clearClassFee(className){
    const all = getClassFees();
    delete all[className];
    writeStore(STORE_KEYS.classFees, all);
  }
  function classFeeFor(className){
    const all = getClassFees();
    return all[className] || null;
  }
  function classBilledTotal(className){
    const rec = classFeeFor(className);
    if(!rec) return 0;
    return round2(Number(rec.tuition || 0) + Number(rec.extra || 0));
  }
  function getAdjustments(){ return readStore(STORE_KEYS.adjustments, []) || []; }
  function discountFor(studentId){
    return getAdjustments()
      .filter(a => a.studentId === studentId && !a.reversed)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }
  function getPayments(){ return readStore(STORE_KEYS.payments, []) || []; }
  function paidFor(studentId){
    return getPayments()
      .filter(p => p.studentId === studentId && !p.reversed)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  function studentFeeSummary(studentId, className){
    const billedBase = classBilledTotal(className);
    const discount   = discountFor(studentId);
    const paid       = paidFor(studentId);
    const netBill    = round2(billedBase - discount);
    const balance    = round2(netBill - paid);
    return {
      studentId, className,
      billedBase,
      discount,
      netBill,
      paid,
      balance,
      status: netBill <= 0
        ? 'Paid'
        : paid >= netBill - 0.005
          ? 'Paid'
          : paid > 0
            ? 'Part-paid'
            : 'Pending'
    };
  }
  function recordPayment({ studentId, studentName, className, amount, method, date, reference, note }){
    const payments = getPayments();
    const u = currentUser();
    const row = {
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      studentId, studentName, className,
      amount: round2(amount),
      method: method || 'Cash',
      date: date || todayISO(),
      reference: reference || '',
      note: note || '',
      receiptNo: nextReceiptNumber('RCP'),
      receivedBy: u ? u.username : '',
      at: new Date().toISOString(),
      reversed: false
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

  /* ---------- Report card threshold ---------- */
  function getReportThreshold(){
    const s = readStore(STORE_KEYS.settingsExtra, {}) || {};
    return {
      mode: s.thresholdMode || 'percent',
      value: Number(s.thresholdValue) || 0,
      enabled: !!s.thresholdEnabled
    };
  }
  function setReportThreshold(mode, value, enabled){
    const s = readStore(STORE_KEYS.settingsExtra, {}) || {};
    s.thresholdMode = mode;
    s.thresholdValue = Number(value) || 0;
    s.thresholdEnabled = !!enabled;
    writeStore(STORE_KEYS.settingsExtra, s);
  }
  function reportAccessFor(studentId, className){
    const t = getReportThreshold();
    if(!t.enabled) return { allowed:true, reason:'Threshold disabled', mode:t.mode, value:t.value, shortfall:0, paid:0, billed:0 };
    const s = studentFeeSummary(studentId, className);
    const required = t.mode === 'percent' ? s.netBill * t.value / 100 : t.value;
    const allowed = s.paid >= required - 0.005;
    return {
      allowed, required, paid: s.paid, billed: s.netBill,
      mode: t.mode, value: t.value,
      shortfall: Math.max(0, required - s.paid)
    };
  }
  function canOpenReportCard(studentId, className){
    const u = currentUser();
    if(!u) return { allowed:false, reason:'Not signed in', shortfall:0 };
    if(u.role === 'Principal' || u.role === 'Registrar' || u.role === 'Teacher'){
      return { allowed:true, staffBypass:true, shortfall:0 };
    }
    return reportAccessFor(studentId, className);
  }

  /* ============================================================
     VIEWER-LEVEL GRADESHEET ACCESS
     Returns:
       { allowed:true }                          for staff
       { allowed:false, reason:'threshold_off' } ? no — off means allowed
       { allowed:false, blockedStudents:[...], totalShortfall }  for student/parent when owed
     Behaviour:
       - Staff (Principal/Registrar/Teacher): always allowed
       - Student: allowed if own balance meets threshold
       - Parent:  allowed only if ALL children meet the threshold
  -------------------------------------------------------------- */
  function viewerGradesheetAccess(){
    const u = currentUser();
    if(!u) return { allowed:false, reason:'Not signed in' };
    if(u.role === 'Principal' || u.role === 'Registrar' || u.role === 'Teacher'){
      return { allowed:true, staffBypass:true };
    }
    const t = getReportThreshold();
    if(!t.enabled){
      return { allowed:true, reason:'Threshold disabled' };
    }
    const kids = u.role === 'Student'
      ? (readStore(STORE_KEYS.students, []) || []).filter(s => s.id === u.linkedStudentId)
      : childrenOf(u);

    if(!kids.length){
      /* No linked students — allow (nothing to owe) */
      return { allowed:true, reason:'No linked students' };
    }

    const blocked = [];
    let totalShortfall = 0;
    kids.forEach(s => {
      const access = reportAccessFor(s.id, s.class);
      if(!access.allowed){
        blocked.push({
          student: s,
          access,
          owed: access.shortfall
        });
        totalShortfall += access.shortfall;
      }
    });

    if(!blocked.length){
      return { allowed:true, checkedStudents: kids.length };
    }
    return {
      allowed: false,
      mode: t.mode,
      value: t.value,
      blockedStudents: blocked,
      totalShortfall,
      checkedStudents: kids.length
    };
  }

  /* ============================================================
     RENDER — Payment-locked page for Gradesheet / Ledger
     ============================================================ */
  function renderGradesheetLocked(access, pageLabel){
    const u = currentUser();
    const kids = access.blockedStudents || [];
    const body = document.body;
    body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;
        background:linear-gradient(135deg,#edf4fc,#dfeaf7);
        font-family:Arial,Helvetica,sans-serif;color:#23354d;padding:24px">
        <div style="width:100%;max-width:640px;background:#fff;border-radius:18px;
          box-shadow:0 25px 70px rgba(11,23,51,.18);overflow:hidden">
          <div style="padding:26px 30px;color:#fff;
            background:linear-gradient(120deg,#102949,#245d9c);
            border-top:5px solid #d88922">
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:52px;height:52px;border-radius:14px;background:#fff8e6;
                color:#a86414;display:grid;place-items:center;font-size:26px">🔒</div>
              <div>
                <h1 style="margin:0;font-size:19px;letter-spacing:.3px">${esc(pageLabel || 'Gradesheet')} is locked</h1>
                <p style="margin:5px 0 0;font-size:12px;color:#cfdcf5">
                  Access requires meeting the school's fee threshold.
                </p>
              </div>
            </div>
          </div>

          <div style="padding:26px 30px">
            <p style="font-size:13px;color:#54637d;line-height:1.7;margin:0 0 16px">
              Your account is not permitted to open the
              <strong>${esc(pageLabel || 'Gradesheet')}</strong> because the payment threshold
              has not been met for:
            </p>

            ${kids.map(x => {
              const s = x.student;
              const a = x.access;
              const pct = a.billed > 0 ? Math.min(100, Math.round(a.paid / a.billed * 100)) : 0;
              return `
                <div style="border:1px solid #e8ebf2;border-radius:12px;padding:14px 16px;
                  margin-bottom:10px;background:#fbfdff">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;
                    gap:12px;flex-wrap:wrap">
                    <div>
                      <div style="font-size:13px;font-weight:800;color:#12315a">${esc(s.name)}</div>
                      <div style="font-size:11px;color:#73849a;margin-top:3px">
                        ${esc(s.class)} · ${esc(s.id)}
                      </div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:10px;color:#73849a;text-transform:uppercase;
                        letter-spacing:.6px;font-weight:800;margin-bottom:3px">Amount owed</div>
                      <div style="font-family:monospace;font-weight:800;color:#d64545;font-size:15px">
                        ${money(a.shortfall)}
                      </div>
                    </div>
                  </div>
                  <div style="height:8px;background:#eef1f7;border-radius:20px;overflow:hidden;margin-top:10px">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#3987ee,#14805e);border-radius:20px"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:10.5px;
                    color:#73849a;margin-top:6px">
                    <span>Paid ${money(a.paid)} of ${money(a.billed)} · ${pct}%</span>
                    <span>Required: ${a.mode === 'percent' ? a.value + '%' : money(a.value)}</span>
                  </div>
                </div>`;
            }).join('')}

            <div style="display:flex;justify-content:space-between;padding:12px 16px;
              background:#fff8e6;border:1px solid #f3d999;border-radius:10px;
              font-size:12px;color:#8a6a1a;margin-top:16px">
              <span><strong>Total outstanding</strong></span>
              <strong style="font-family:monospace;font-size:14px">${money(access.totalShortfall)}</strong>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px">
              <a href="index.html" style="display:inline-block;background:#eef2fb;color:#34415c;
                padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:700;font-size:12px">
                ← Back to Dashboard
              </a>
              <a href="fees.html" style="display:inline-block;background:#3987ee;color:#fff;
                padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:700;font-size:12px">
                ＄ Go to Fees &amp; Payments
              </a>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     PAYROLL
     ============================================================ */
  function getSalaryPayments(){
    return readStore(STORE_KEYS.salaryPayments, []) || [];
  }
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
      totalSalary: calc.total,
      advance: calc.advance,
      taxPercent: calc.taxPercent,
      taxAmount: calc.taxAmount,
      netBalance: calc.netBalance,
      method: method || 'Bank transfer',
      date: date || todayISO(),
      reference: reference || '',
      note: note || '',
      receiptNo: nextReceiptNumber('SAL'),
      createdAt: new Date().toISOString(),
      createdBy: u ? u.username : '',
      reversed: false
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
     TOAST / MODAL / DENIED
     ============================================================ */
  function ensureToast(){
    let t = document.getElementById('educoreToast');
    if(!t){
      t = document.createElement('div');
      t.id = 'educoreToast';
      t.setAttribute('role','status');
      document.body.appendChild(t);
      if(!document.getElementById('educoreToastStyle')){
        const s = document.createElement('style');
        s.id = 'educoreToastStyle';
        s.textContent = `
          #educoreToast{position:fixed;right:22px;bottom:22px;background:#152744;color:#fff;
            padding:14px 18px;border-radius:10px;font-size:12px;z-index:9999;display:none;
            box-shadow:0 8px 24px rgba(24,42,78,.25);max-width:340px}
          #educoreToast.show{display:block;animation:eceduFade .2s}
          @keyframes eceduFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        `;
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

  function ensureModal(){
    let back = document.getElementById('educoreModalBackdrop');
    if(!back){
      back = document.createElement('div');
      back.id = 'educoreModalBackdrop';
      back.innerHTML = `
        <div class="educore-modal" role="dialog" aria-modal="true">
          <div class="educore-modal-head">
            <h3 id="educoreModalTitle">Form</h3>
            <button class="educore-modal-close" id="educoreModalClose" aria-label="Close">×</button>
          </div>
          <form class="educore-modal-form" id="educoreModalForm"></form>
        </div>`;
      document.body.appendChild(back);
      if(!document.getElementById('educoreModalStyle')){
        const s = document.createElement('style');
        s.id = 'educoreModalStyle';
        s.textContent = `
          #educoreModalBackdrop{display:none;position:fixed;inset:0;background:rgba(14,24,44,.55);
            z-index:9998;align-items:center;justify-content:center;padding:18px}
          #educoreModalBackdrop.show{display:flex}
          .educore-modal{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#fff;
            border-radius:16px;box-shadow:0 25px 70px rgba(11,23,51,.25)}
          .educore-modal.wide{max-width:820px}
          .educore-modal-head{display:flex;justify-content:space-between;align-items:center;
            padding:20px 22px;border-bottom:1px solid #e8ebf2;position:sticky;top:0;background:#fff;z-index:2}
          .educore-modal-head h3{margin:0;font-size:17px;color:#14213d}
          .educore-modal-close{border:0;background:#f2f4f8;border-radius:8px;width:31px;height:31px;
            font-size:18px;cursor:pointer;color:#34415c}
          .educore-modal-form{padding:22px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
          .educore-modal-form .full{grid-column:1/-1}
          .educore-modal-form label{display:block;font-size:11px;color:#657089;font-weight:bold;margin-bottom:6px}
          .educore-modal-form input,.educore-modal-form select,.educore-modal-form textarea{
            width:100%;border:1px solid #dfe4ee;border-radius:8px;padding:11px;font-size:12px;
            outline:none;background:#fff;font-family:inherit}
          .educore-modal-form input:focus,.educore-modal-form select:focus,.educore-modal-form textarea:focus{
            border-color:#5575e5}
          .educore-modal-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px;margin-top:8px}
          .ecedu-btn{border:0;border-radius:9px;padding:11px 15px;background:#4169e1;color:#fff;
            font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
          .ecedu-btn.outline{background:#fff;color:#34415c;border:1px solid #e8ebf2}
          @media(max-width:650px){.educore-modal-form{grid-template-columns:1fr}.educore-modal-actions{grid-column:1}}
        `;
        document.head.appendChild(s);
      }
      back.addEventListener('click', e => { if(e.target.id === 'educoreModalBackdrop') closeModal(); });
      document.getElementById('educoreModalClose').addEventListener('click', closeModal);
      document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
    }
    return back;
  }
  let __modalSubmit = null;
  function openModal(title, html, submitText, onSubmit, wide){
    ensureModal();
    document.getElementById('educoreModalTitle').textContent = title;
    const form = document.getElementById('educoreModalForm');
    form.className = 'educore-modal-form' + (wide ? ' wide' : '');
    form.innerHTML = html + `<div class="educore-modal-actions">
      <button type="button" class="ecedu-btn outline" id="educoreModalCancel">Cancel</button>
      ${submitText ? `<button type="submit" class="ecedu-btn">${esc(submitText)}</button>` : ''}
    </div>`;
    document.getElementById('educoreModalBackdrop').classList.add('show');
    document.getElementById('educoreModalCancel').onclick = closeModal;
    __modalSubmit = onSubmit || null;
    form.onsubmit = e => {
      e.preventDefault();
      if(__modalSubmit) __modalSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()));
    };
    return form;
  }
  function closeModal(){
    document.getElementById('educoreModalBackdrop')?.classList.remove('show');
    const f = document.getElementById('educoreModalForm');
    if(f) f.innerHTML = '';
  }

  function showDenied(label){
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;background:#f5f7fb;
        font-family:Arial,Helvetica,sans-serif;color:#202a3b;padding:24px">
        <div style="max-width:420px;text-align:center;background:#fff;border:1px solid #e8ebf2;
          border-radius:16px;padding:40px 30px;box-shadow:0 12px 40px rgba(24,42,78,.08)">
          <div style="font-size:44px;margin-bottom:14px">🔒</div>
          <h1 style="font-size:20px;margin:0 0 8px;color:#14213d">Not authorised</h1>
          <p style="margin:0 0 22px;font-size:13px;color:#7a8498;line-height:1.6">
            Your account doesn't have permission to open <strong>${esc(label)}</strong>.
          </p>
          <a href="index.html" style="display:inline-block;background:#4169e1;color:#fff;
            padding:12px 20px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px">
            ← Back to Dashboard
          </a>
        </div>
      </div>`;
  }

  function injectBackPill(){
    if(document.getElementById('educoreBackPill')) return;
    const a = document.createElement('a');
    a.id = 'educoreBackPill';
    a.href = 'index.html';
    a.textContent = '← Back to Dashboard';
    a.style.cssText = `
      position:fixed;top:14px;left:14px;z-index:9997;background:#14213d;color:#fff;
      text-decoration:none;padding:9px 14px;border-radius:20px;font-size:11px;font-weight:700;
      font-family:Arial,Helvetica,sans-serif;letter-spacing:.2px;
      box-shadow:0 6px 18px rgba(20,33,61,.25);display:inline-flex;align-items:center;gap:6px;`;
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
    { title:'Dashboard', items:[
      { key:'dashboard', label:'Dashboard', desc:'Overview and leaderboards' }
    ]},
    { title:'Academic', items:[
      { key:'students', label:'Students', desc:'Manage student records', subFeatures:[
        { key:'add',    label:'Add student',     desc:'Create new student records' },
        { key:'edit',   label:'Edit student',    desc:'Modify student details' },
        { key:'delete', label:'Delete student',  desc:'Remove students and their data' },
        { key:'report', label:'Open report card',desc:'Launch a report card for a student' },
        { key:'export', label:'Export CSV',      desc:'Download the student list' }
      ]},
      { key:'teachers', label:'Teachers', desc:'Manage teaching staff', subFeatures:[
        { key:'add',          label:'Add teacher',           desc:'Create new teacher records' },
        { key:'edit',         label:'Edit teacher',          desc:'Modify teacher details' },
        { key:'delete',       label:'Delete teacher',        desc:'Remove teachers and their data' },
        { key:'assignments',  label:'Manage assignments',    desc:'Assign subjects and classes' },
        { key:'sponsorship',  label:'Manage sponsorship',    desc:'Assign a class to sponsor' }
      ]},
      { key:'classes', label:'Classes', desc:'Class registry, sections, sponsors', subFeatures:[
        { key:'add',              label:'Add / edit',           desc:'Create and edit subjects & classes' },
        { key:'delete',           label:'Delete',               desc:'Remove subjects and classes' },
        { key:'archive',          label:'Archive subject',      desc:'Archive or restore subjects' },
        { key:'manage_subjects',  label:'Manage class subjects',desc:'Choose which subjects a class offers' },
        { key:'promote',          label:'Promote students',     desc:'Move students to the next class' }
      ]},
      { key:'attendance', label:'Attendance', desc:'Daily attendance register', subFeatures:[
        { key:'save',      label:'Save attendance', desc:'Record attendance for a class and date' },
        { key:'clear_day', label:'Clear day',       desc:'Erase a day\'s attendance' },
        { key:'mark_all',  label:'Bulk mark',       desc:'Mark everyone Present in one click' }
      ]},
      { key:'exams', label:'Gradesheet', desc:'Enter and view examination scores', subFeatures:[
        { key:'add',    label:'Add result',    desc:'Enter a new examination result' },
        { key:'edit',   label:'Edit result',   desc:'Modify an existing score' },
        { key:'delete', label:'Delete result', desc:'Remove a result row' }
      ]},
      { key:'reportcard', label:'Report Card', desc:'Print and manage report cards', subFeatures:[
        { key:'open',            label:'Open single',       desc:'View a single student\'s report card' },
        { key:'batch_print',     label:'Batch print',       desc:'Print report cards for multiple students' },
        { key:'lock_term',       label:'Lock semester',     desc:'Prevent further score edits' },
        { key:'unlock_term',     label:'Unlock semester',   desc:'Re-enable score edits for a semester' },
        { key:'copy_prev_term',  label:'Copy previous term',desc:'Bring subject list forward from the last term' }
      ]}
    ]},
    { title:'Administration', items:[
      { key:'fees', label:'Fees', desc:'Tuition per class, student payments, teacher salaries', subFeatures:[
        { key:'class_fees',      label:'Set class tuition',   desc:'Set tuition + extra fees per class' },
        { key:'record_payment',  label:'Record student payment', desc:'Add a payment to a student account' },
        { key:'reverse_payment', label:'Reverse student payment', desc:'Undo a previously recorded payment' },
        { key:'view_history',    label:'View history',        desc:'See every payment on an account' },
        { key:'salary',          label:'Record salary',       desc:'Disburse a salary to a teacher' },
        { key:'reverse_salary',  label:'Reverse salary',      desc:'Undo a previously recorded salary' },
        { key:'export',          label:'Export CSV',          desc:'Download the fee or salary list' }
      ]},
      { key:'announcements', label:'Announcements', desc:'Publish and read school announcements', subFeatures:[
        { key:'publish', label:'Publish',  desc:'Create a new announcement' },
        { key:'edit',    label:'Edit',     desc:'Modify an existing announcement' },
        { key:'delete',  label:'Delete',   desc:'Remove an announcement' },
        { key:'pin',     label:'Pin',      desc:'Pin an announcement to the top' }
      ]},
      { key:'promotions', label:'Promotions', desc:'Promote classes, students, whole school' },
      { key:'termLock',   label:'Semester lock / unlock', desc:'Lock a semester from further score edits' },
      { key:'settings',   label:'School settings',    desc:'School name, logo, principal signature' }
    ]},
    { title:'Requests', items:[
      { key:'transfers', label:'Transfers', desc:'Transfer students out or between classes', subFeatures:[
        { key:'create', label:'Create transfer', desc:'Request a transfer record' },
        { key:'issue',  label:'Issue',           desc:'Mark a transfer as issued' },
        { key:'reject', label:'Reject',          desc:'Reject a pending transfer' },
        { key:'delete', label:'Delete',          desc:'Remove a transfer record' },
        { key:'print',  label:'Print letter',    desc:'Open the transfer letter for printing' }
      ]},
      { key:'transcripts', label:'Transcripts', desc:'Request, approve, issue transcripts', subFeatures:[
        { key:'request', label:'Request',    desc:'Submit a new transcript request' },
        { key:'approve', label:'Approve',    desc:'Approve a pending request' },
        { key:'reject',  label:'Reject',     desc:'Reject a pending request' },
        { key:'issue',   label:'Issue',      desc:'Issue and open the transcript' },
        { key:'print',   label:'Print',      desc:'Reopen an issued transcript' },
        { key:'delete',  label:'Delete',     desc:'Delete a transcript request' }
      ]},
      { key:'recommendations', label:'Recommendations', desc:'Request, approve, issue letters', subFeatures:[
        { key:'request', label:'Request',    desc:'Submit a new recommendation request' },
        { key:'approve', label:'Approve',    desc:'Approve a pending request' },
        { key:'reject',  label:'Reject',     desc:'Reject a pending request' },
        { key:'issue',   label:'Issue',      desc:'Issue and open the letter' },
        { key:'print',   label:'Print',      desc:'Reopen an issued letter' },
        { key:'delete',  label:'Delete',     desc:'Delete a request' }
      ]},
      { key:'idcards', label:'ID Cards', desc:'Design and print student ID cards', subFeatures:[
        { key:'upload_photo', label:'Upload photo',     desc:'Attach a photo to a student' },
        { key:'remove_photo', label:'Remove photo',     desc:'Delete a student photo' },
        { key:'print_single', label:'Print single card',desc:'Print one student\'s ID card' },
        { key:'print_batch',  label:'Print batch',      desc:'Print ID cards for multiple students' }
      ]}
    ]},
    { title:'Family', items:[
      { key:'children', label:'My Children', desc:'Linked students and their quick summaries', subFeatures:[
        { key:'report',  label:'Open report card', desc:'Launch a child\'s report card' },
        { key:'fees',    label:'View fees',        desc:'See a child\'s fee account' },
        { key:'id_card', label:'Open ID card',     desc:'Print a child\'s ID card' }
      ]}
    ]},
    { title:'System', items:[
      { key:'audit', label:'Audit Log', desc:'View every action taken in the system', subFeatures:[
        { key:'view',   label:'View',   desc:'Open the audit log' },
        { key:'clear',  label:'Clear',  desc:'Wipe the entire log' },
        { key:'export', label:'Export', desc:'Download the log as CSV' }
      ]},
      { key:'userManagement', label:'User Management', desc:'Create, edit, disable users', subFeatures:[
        { key:'create',         label:'Create user',  desc:'Add a new user account' },
        { key:'edit',           label:'Edit user',    desc:'Change user details and permissions' },
        { key:'disable',        label:'Disable',      desc:'Block or restore sign-in' },
        { key:'reset_password', label:'Reset password',desc:'Assign a new password' },
        { key:'delete',         label:'Delete user',  desc:'Permanently remove a user' }
      ]}
    ]}
  ];

  const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));
  const ALL_SUB_FEATURE_KEYS = PERMISSION_GROUPS.flatMap(g =>
    g.items.flatMap(i => (i.subFeatures || []).map(sf => i.key + '.' + sf.key))
  );
  const ALL_KEYS = [...ALL_PERMISSION_KEYS, ...ALL_SUB_FEATURE_KEYS];

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
          'students','students.add','students.edit','students.delete','students.report','students.export',
          'teachers','teachers.add','teachers.edit','teachers.delete','teachers.assignments','teachers.sponsorship',
          'classes','classes.add','classes.delete','classes.archive','classes.manage_subjects','classes.promote',
          'attendance','attendance.save','attendance.clear_day','attendance.mark_all',
          'exams','exams.add','exams.edit','exams.delete',
          'reportcard','reportcard.open','reportcard.batch_print','reportcard.copy_prev_term',
          'fees','fees.class_fees','fees.record_payment','fees.reverse_payment','fees.view_history','fees.export',
          'announcements','announcements.publish','announcements.edit','announcements.delete','announcements.pin',
          'transfers','transfers.create','transfers.issue','transfers.reject','transfers.delete','transfers.print',
          'transcripts','transcripts.request','transcripts.issue','transcripts.print','transcripts.delete',
          'recommendations','recommendations.request','recommendations.issue','recommendations.print','recommendations.delete',
          'idcards','idcards.upload_photo','idcards.remove_photo','idcards.print_single','idcards.print_batch',
          'audit','audit.view','audit.export'
        ]);
        break;
      case 'Teacher':
        on([
          'dashboard',
          'students','students.report',
          'classes',
          'attendance','attendance.save','attendance.mark_all',
          'exams','exams.add','exams.edit',
          'reportcard','reportcard.open',
          'announcements',
          'recommendations','recommendations.request',
          'idcards','idcards.print_single'
        ]);
        break;
      case 'Student':
        on([
          'dashboard',
          'reportcard','reportcard.open',
          'exams',
          'fees','fees.view_history',
          'announcements',
          'transcripts','transcripts.request',
          'recommendations','recommendations.request',
          'idcards','idcards.print_single'
        ]);
        break;
      case 'Parent':
        on([
          'dashboard',
          'reportcard','reportcard.open',
          'exams',
          'fees','fees.view_history',
          'announcements',
          'transcripts','transcripts.request',
          'recommendations','recommendations.request',
          'idcards','idcards.print_single',
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

  /* ============================================================
     PAGE REGISTRY — Report Cards menu removed
     ============================================================ */
  const PAGE_REGISTRY = [
    { key:'dashboard',       label:'Dashboard',         icon:'▦', group:'Main menu',      perm:'dashboard',  file:null },
    { key:'children',        label:'My Children',       icon:'👨‍👩‍👧', group:'Family',      perm:'children',   file:'children.html' },
    { key:'students',        label:'Students',          icon:'♙', group:'Main menu',      perm:'students',   file:'students.html' },
    { key:'teachers',        label:'Teachers',          icon:'♧', group:'Main menu',      perm:'teachers',   file:'teachers.html' },
    { key:'subjects',        label:'Subjects',          icon:'📚', group:'Academic',      perm:'classes',    file:'subjects.html' },
    { key:'classes',         label:'Classes',           icon:'▤', group:'Academic',      perm:'classes',    file:'classes.html' },
    { key:'attendance',      label:'Attendance',        icon:'✓', group:'Academic',      perm:'attendance', file:'attendance.html' },
    { key:'gradesheet',      label:'Gradesheet',        icon:'✎', group:'Academic',      perm:'exams',      file:'gradesheet.html' },
    { key:'ledger',          label:'Gradesheet Ledger', icon:'▦', group:'Academic',      perm:'reportcard', file:'report-card-ledger.html' },
    { key:'fees',            label:'Fees',              icon:'＄', group:'Administration',perm:'fees',       file:'fees.html' },
    { key:'announcements',   label:'Announcements',     icon:'◉', group:'Administration',perm:'announcements',file:'announcements.html' },
    { key:'transfers',       label:'Transfers',         icon:'⇄', group:'Requests',      perm:'transfers',  file:'transfers.html' },
    { key:'transcripts',     label:'Transcripts',       icon:'🎓', group:'Requests',     perm:'transcripts',file:'transcripts.html' },
    { key:'recommendations', label:'Recommendations',   icon:'✉', group:'Requests',      perm:'recommendations', file:'recommendations.html' },
    { key:'idcards',         label:'ID Cards',          icon:'🪪', group:'Requests',     perm:'idcards',    file:'id-cards.html' },
    { key:'audit',           label:'Audit Log',         icon:'🗒', group:'System',       perm:'audit',      file:'audit.html' },
    { key:'users',           label:'User Management',   icon:'👥', group:'System',       perm:'userManagement', file:'users.html' }
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
        else {
          const m = name.match(/(\d+)/);
          if(m){ const n = Number(m[1]); if(n >= 1 && n <= 12) c.category = 'Grade ' + n; }
        }
        changed = true;
      }
    });
    if(changed) writeStore(STORE_KEYS.classes, classes);
    writeStore(STORE_KEYS.migratedCategories, true);
  })();

  (function migrateResultsToPeriods(){
    if(readStore(STORE_KEYS.migratedResults, false)) return;
    const list = readStore(STORE_KEYS.results, []) || [];
    const map = {
      'First Term':   { semester:1, period:1 },
      'Second Term':  { semester:1, period:2 },
      'Third Term':   { semester:2, period:4 },
      'Annual Report':{ semester:2, period:5 }
    };
    let changed = false;
    list.forEach(r => {
      if(r.semester && r.period) return;
      const m = map[r.term] || { semester:1, period:1 };
      r.semester = m.semester;
      r.period   = m.period;
      if(!r.year) r.year = currentAcademicYear();
      delete r.term;
      changed = true;
    });
    if(changed) writeStore(STORE_KEYS.results, list);
    writeStore(STORE_KEYS.migratedResults, true);
  })();

  (function migrateFees(){
    if(readStore(STORE_KEYS.migratedFees, false)) return;
    const classFees = getClassFees();
    const oldPlans = readStore('educoreFeePlans', {}) || {};
    Object.keys(oldPlans).forEach(className => {
      if(classFees[className]) return;
      const plan = oldPlans[className];
      const items = plan && Array.isArray(plan.items) ? plan.items : [];
      const tuition = items
        .filter(i => /tuition/i.test(i.label || '') || /tuition/i.test(i.code || ''))
        .reduce((a,i) => a + Number(i.amount || 0), 0);
      const extras = items
        .filter(i => !(/tuition/i.test(i.label || '') || /tuition/i.test(i.code || '')))
        .reduce((a,i) => a + Number(i.amount || 0), 0);
      if(items.length){
        classFees[className] = {
          className,
          tuition: round2(tuition || items.reduce((a,i) => a + Number(i.amount || 0), 0)),
          extra: round2(extras),
          updatedAt: new Date().toISOString(),
          migrated: true
        };
      }
    });
    writeStore(STORE_KEYS.classFees, classFees);
    const payments = readStore(STORE_KEYS.payments, []) || [];
    let changed = false;
    payments.forEach(p => { if(p.reversed === undefined){ p.reversed = false; changed = true; } });
    if(changed) writeStore(STORE_KEYS.payments, payments);
    writeStore(STORE_KEYS.migratedFees, true);
  })();

  /* ============================================================
     PUBLIC API
     ============================================================ */
  global.EduCore = {
    STORE_KEYS, readStore, writeStore, removeStore,
    DEVICE_ID, currentUser, hasPerm, can, requireLogin, requirePerm, logout,
    readAudit, writeAudit, audit,

    $, $$, esc, initials, money, todayISO, fmtDate, fmtDateTime, round2,
    toast, openModal, closeModal, showDenied, injectBackPill, confirmTyped,

    NURSERY_SCALE, DEFAULT_NUMERIC_SCALE, numericScale,
    CATEGORY_LIST, isNurseryCategory,
    resolveGradingScale, gradeFromNumber, gradeFromNurseryNumber,
    gradeFromScore, grade, remarkForGrade, midpointForLetter,
    validateScore, averageScores,

    SEMESTER_1_PERIODS, SEMESTER_2_PERIODS, ALL_PERIODS,
    periodsForSemester, periodMeta, currentAcademicYear, weightConfig,

    readResults, periodResultsFor, scoreFor, saveScore,
    semesterAverageFor, yearlyAverageFor, subjectLedgerRow,

    getSubjects, subjectByCode, subjectName, ensureSubject,
    getClasses, classByName, classCategoryFor, isNurseryClass,

    getTeachers, getAssignments, assignmentsForTeacher,
    getSponsors, classSponsor, sponsorClassOf, setSponsor, clearSponsor,
    currentTeacherId, childrenOf,
    taughtSubjectsInClass, isSponsorOfClass, canEditSubject,
    visibleClassNamesFor, visibleStudentsFor, visibleResultsFor,

    readSemesters, isSemesterLocked, setSemesterLock,
    readArchives, writeArchives, archivedTermKeys, isTermArchived,

    /* FEES */
    getClassFees, setClassFee, clearClassFee, classFeeFor, classBilledTotal,
    getAdjustments, discountFor,
    getPayments, paidFor,
    studentFeeSummary, recordPayment, reversePayment,
    getReportThreshold, setReportThreshold, reportAccessFor, canOpenReportCard,
    viewerGradesheetAccess, renderGradesheetLocked,
    nextReceiptNumber,

    /* PAYROLL */
    getSalaryPayments, computeSalary, recordSalary, reverseSalary,

    PERMISSION_GROUPS, ALL_PERMISSION_KEYS, ALL_SUB_FEATURE_KEYS, ALL_KEYS,
    ROLE_PRESETS, PAGE_REGISTRY, subFeaturesFor
  };
})(window);