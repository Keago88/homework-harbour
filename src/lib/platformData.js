/**
 * Platform data layer: schools, classes, roster, parent-child links, grades.
 * Uses localStorage for demo (dev only); Firestore when configured. Production blocks localStorage.
 */
import { db, auth } from './firebase';
import { storageGet, storageSet } from './storage';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';

const KEYS = {
  SCHOOLS: 'hwc_schools',
  USERS: 'hwc_users_ext',
  PARENT_LINKS: 'hwc_parent_links',
  RISK_HISTORY: 'hwc_risk_history',
  ALERTS: 'hwc_alerts',
  INTERVENTIONS: 'hwc_interventions',
};

const get = (key) => {
  try {
    return JSON.parse(storageGet(key) || 'null');
  } catch { return null; }
};

const set = (key, value) => {
  try {
    storageSet(key, JSON.stringify(value));
  } catch {}
};

export const getSchools = () => get(KEYS.SCHOOLS) || [];
export const saveSchools = (schools) => {
  set(KEYS.SCHOOLS, schools);
  if (useFirestore()) saveSchoolsToFirestore(schools).catch(() => {});
};

export const getUsersExt = () => get(KEYS.USERS) || [];
export const saveUsersExt = (users) => set(KEYS.USERS, users);

export const getParentLinks = () => get(KEYS.PARENT_LINKS) || [];
export const saveParentLinks = (links) => set(KEYS.PARENT_LINKS, links);

export const getRiskHistory = () => get(KEYS.RISK_HISTORY) || [];
export const saveRiskHistory = (history) => set(KEYS.RISK_HISTORY, history);

export const getAlerts = () => get(KEYS.ALERTS) || [];
export const saveAlerts = (alerts) => set(KEYS.ALERTS, alerts);

export const getInterventions = () => get(KEYS.INTERVENTIONS) || [];
export const saveInterventions = (interventions) => set(KEYS.INTERVENTIONS, interventions);

// --- Schools & roster ---
export const createSchool = (name, adminEmail, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const id = `school_${Date.now()}`;
  const updated = [...schools, {
    id,
    name,
    adminEmail,
    teachers: [],
    classes: [],
    riskThresholds: { low: 80, moderate: 60, high: 40 },
    createdAt: new Date().toISOString(),
  }];
  saveSchools(updated);
  return id;
};

export const addTeacherToSchool = (schoolId, teacherEmail, teacherName, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const s = schools.find(x => x.id === schoolId);
  if (!s) return;
  if (!s.teachers.some(t => t.email === teacherEmail)) {
    const updated = schools.map(x => x.id === schoolId ? { ...x, teachers: [...(x.teachers || []), { email: teacherEmail, name: teacherName }] } : x);
    saveSchools(updated);
  }
};

export const addClassToSchool = (schoolId, className, teacherEmail, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const s = schools.find(x => x.id === schoolId);
  if (!s) return null;
  const id = `class_${Date.now()}`;
  const updated = schools.map(x => x.id === schoolId ? { ...x, classes: [...(x.classes || []), { id, name: className, teacherEmail, studentEmails: [] }] } : x);
  saveSchools(updated);
  return id;
};

export const removeStudentFromClass = (schoolId, classId, studentEmail, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const s = schools.find(x => x.id === schoolId);
  if (!s) return;
  const c = s.classes.find(x => x.id === classId);
  if (!c) return;
  const updated = schools.map(x => {
    if (x.id !== schoolId) return x;
    const classes = x.classes.map(cl => cl.id === classId ? { ...cl, studentEmails: (cl.studentEmails || []).filter(e => e.email !== studentEmail) } : cl);
    return { ...x, classes };
  });
  saveSchools(updated);
};

export const removeClassFromSchool = (schoolId, classId, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const updated = schools.map(x => x.id === schoolId ? { ...x, classes: (x.classes || []).filter(c => c.id !== classId) } : x);
  saveSchools(updated);
};

export const removeTeacherFromSchool = (schoolId, teacherEmail, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const s = schools.find(x => x.id === schoolId);
  if (!s) return;
  const updated = schools.map(x => x.id === schoolId ? { ...x, teachers: (x.teachers || []).filter(t => t.email !== teacherEmail) } : x);
  saveSchools(updated);
};

export const removeSchool = (schoolId, currentSchools) => {
  const schools = (currentSchools ?? getSchools()).filter(x => x.id !== schoolId);
  saveSchools(schools);
};

export const addStudentToClass = (schoolId, classId, studentEmail, studentName, currentSchools) => {
  const schools = currentSchools ?? getSchools();
  const s = schools.find(x => x.id === schoolId);
  if (!s) return;
  const c = s.classes.find(x => x.id === classId);
  if (!c) return;
  if (!c.studentEmails.some(e => e.email === studentEmail)) {
    const updated = schools.map(x => {
      if (x.id !== schoolId) return x;
      const classes = x.classes.map(cl => cl.id === classId ? { ...cl, studentEmails: [...(cl.studentEmails || []), { email: studentEmail, name: studentName }] } : cl);
      return { ...x, classes };
    });
    saveSchools(updated);
  }
};

// --- Parent-child linking (Firestore when db available, else localStorage) ---
const PARENT_LINKS_COLLECTION = 'parent_links';

const toDocId = (email) => btoa(encodeURIComponent((email || '').toLowerCase())).replace(/[/+=]/g, '_');

const useFirestore = () => !!db && !!auth?.currentUser;

const generatePairingCodeLocal = (studentEmail) => {
  const code = `${(studentEmail || '').slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const links = getParentLinks();
  const existing = links.find(l => l.studentEmail === studentEmail);
  const entry = { studentEmail, code, parentEmails: existing?.parentEmails || [] };
  const rest = links.filter(l => l.studentEmail !== studentEmail);
  saveParentLinks([...rest, entry]);
  return code;
};

const linkParentToStudentLocal = (code, parentEmail) => {
  const links = getParentLinks();
  const link = links.find(l => l.code === code.toUpperCase().replace(/\s/g, ''));
  if (!link) return { ok: false, error: 'Code not found' };
  if (!link.parentEmails.includes(parentEmail)) {
    link.parentEmails = [...(link.parentEmails || []), parentEmail];
    saveParentLinks(links.map(l => (l.studentEmail === link.studentEmail ? link : l)));
  }
  return { ok: true, studentEmail: link.studentEmail };
};

const getLinkedStudentsForParentLocal = (parentEmail) => {
  return getParentLinks().filter(l => l.parentEmails?.includes(parentEmail)).map(l => l.studentEmail);
};

const getPairingCodeForStudentLocal = (studentEmail) => {
  return getParentLinks().find(l => l.studentEmail === studentEmail)?.code;
};

export const generatePairingCode = async (studentEmail) => {
  const code = `${(studentEmail || '').slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  if (useFirestore()) {
    const docRef = doc(db, PARENT_LINKS_COLLECTION, toDocId(studentEmail));
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : null;
    await setDoc(docRef, {
      studentEmail,
      code,
      parentEmails: existing?.parentEmails || [],
    });
    return code;
  }
  return generatePairingCodeLocal(studentEmail);
};

export const linkParentToStudent = async (code, parentEmail) => {
  const normalizedCode = code.toUpperCase().replace(/\s/g, '');
  if (useFirestore()) {
    const q = query(collection(db, PARENT_LINKS_COLLECTION), where('code', '==', normalizedCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { ok: false, error: 'Code not found' };
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    const parentEmails = data.parentEmails || [];
    if (!parentEmails.includes(parentEmail)) {
      parentEmails.push(parentEmail);
      await setDoc(docSnap.ref, { ...data, parentEmails });
    }
    return { ok: true, studentEmail: data.studentEmail };
  }
  return linkParentToStudentLocal(code, parentEmail);
};

export const getLinkedStudentsForParent = async (parentEmail) => {
  if (useFirestore()) {
    const q = query(collection(db, PARENT_LINKS_COLLECTION), where('parentEmails', 'array-contains', parentEmail));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().studentEmail).filter(Boolean);
  }
  return getLinkedStudentsForParentLocal(parentEmail);
};

export const getPairingCodeForStudent = async (studentEmail) => {
  if (useFirestore()) {
    const docRef = doc(db, PARENT_LINKS_COLLECTION, toDocId(studentEmail));
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().code : null;
  }
  return getPairingCodeForStudentLocal(studentEmail);
};

// --- User subjects (Firestore when db available, else localStorage per user) ---
const USER_SETTINGS_COLLECTION = 'user_settings';
const SUBJECTS_LOCAL_PREFIX = 'hwc_subjects_';

export const getSubjects = async (userId) => {
  if (!userId) return null;
  if (useFirestore() && !userId.includes('@')) {
    const docRef = doc(db, USER_SETTINGS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : null;
    return data?.subjects && Array.isArray(data.subjects) ? data.subjects : null;
  }
  try {
    const v = storageGet(SUBJECTS_LOCAL_PREFIX + userId);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};

export const saveSubjects = async (userId, subjects) => {
  if (!userId || !Array.isArray(subjects)) return;
  if (useFirestore() && !userId.includes('@')) {
    const docRef = doc(db, USER_SETTINGS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(docRef, { ...existing, subjects });
  } else {
    try {
      storageSet(SUBJECTS_LOCAL_PREFIX + userId, JSON.stringify(subjects));
    } catch {}
  }
};

// --- User data (assignments, profile, completion history, risk history) ---
const USER_DATA_COLLECTION = 'user_data';
const PLATFORM_COLLECTION = 'platform';

export const getUserData = async (userId) => {
  if (!userId || !useFirestore() || userId.includes('@')) return null;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
};

export const getAssignments = async (userId) => {
  if (!userId || !useFirestore() || userId.includes('@')) return null;
  const data = await getUserData(userId);
  return data?.assignments && Array.isArray(data.assignments) ? data.assignments : null;
};

export const saveAssignments = async (userId, assignments) => {
  if (!userId || !Array.isArray(assignments) || !useFirestore() || userId.includes('@')) return;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(docRef, { ...existing, assignments });
  } catch (e) { console.warn('saveAssignments failed:', e); }
};

export const getProfile = async (userId) => {
  if (!userId || !useFirestore() || userId.includes('@')) return null;
  const data = await getUserData(userId);
  return data?.profile || null;
};

export const saveProfile = async (userId, profile) => {
  if (!userId || !profile || !useFirestore() || userId.includes('@')) return;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(docRef, { ...existing, profile });
  } catch (e) { console.warn('saveProfile failed:', e); }
};

export const getCompletionHistoryFromFirestore = async (userId) => {
  if (!userId || !useFirestore() || userId.includes('@')) return [];
  const data = await getUserData(userId);
  const byKey = data?.completionHistory || {};
  const comp = byKey?.completions ?? [];
  return Array.isArray(comp) ? comp : [];
};

export const logCompletionToFirestore = async (userId, assignment) => {
  if (!userId || !assignment || !useFirestore() || userId.includes('@')) return;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    const byKey = existing.completionHistory || { completions: [] };
    const completions = byKey.completions || [];
    const today = new Date().toISOString().split('T')[0];
    const entry = { date: today, subject: assignment.subject || 'Other', title: assignment.title };
    byKey.completions = [...completions, entry].slice(-500);
    await setDoc(docRef, { ...existing, completionHistory: byKey });
  } catch (e) { console.warn('logCompletion failed:', e); }
};

export const saveCompletionHistoryToFirestore = async (userId, completions) => {
  if (!userId || !Array.isArray(completions) || !useFirestore() || userId.includes('@')) return;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(docRef, { ...existing, completionHistory: { completions: completions.slice(-500) } });
  } catch (e) { console.warn('saveCompletionHistory failed:', e); }
};

export const getRiskHistoryFromFirestore = async (userId) => {
  if (!userId || !useFirestore() || userId.includes('@')) return null;
  const data = await getUserData(userId);
  return data?.riskHistory && Array.isArray(data.riskHistory) ? data.riskHistory : null;
};

export const saveRiskHistoryToFirestore = async (userId, history) => {
  if (!userId || !Array.isArray(history) || !useFirestore() || userId.includes('@')) return;
  try {
    const docRef = doc(db, USER_DATA_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(docRef, { ...existing, riskHistory: history });
  } catch (e) { console.warn('saveRiskHistory failed:', e); }
};

// --- Platform data (schools, alerts, interventions) ---
const PLATFORM_SCHOOLS = 'schools';
const PLATFORM_ALERTS = 'alerts';
const PLATFORM_INTERVENTIONS = 'interventions';

export const getSchoolsFromFirestore = async () => {
  if (!useFirestore()) return null;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_SCHOOLS);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : null;
    return data?.schools && Array.isArray(data.schools) ? data.schools : null;
  } catch { return null; }
};

export const saveSchoolsToFirestore = async (schools) => {
  if (!Array.isArray(schools) || !useFirestore()) return;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_SCHOOLS);
    await setDoc(docRef, { schools });
  } catch (e) { console.warn('saveSchools failed:', e); }
};

export const getAlertsFromFirestore = async () => {
  if (!useFirestore()) return null;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_ALERTS);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : null;
    return data?.alerts && Array.isArray(data.alerts) ? data.alerts : null;
  } catch { return null; }
};

export const saveAlertsToFirestore = async (alerts) => {
  if (!Array.isArray(alerts) || !useFirestore()) return;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_ALERTS);
    await setDoc(docRef, { alerts });
  } catch (e) { console.warn('saveAlerts failed:', e); }
};

export const getInterventionsFromFirestore = async () => {
  if (!useFirestore()) return null;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_INTERVENTIONS);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : null;
    return data?.interventions && Array.isArray(data.interventions) ? data.interventions : null;
  } catch { return null; }
};

export const saveInterventionsToFirestore = async (interventions) => {
  if (!Array.isArray(interventions) || !useFirestore()) return;
  try {
    const docRef = doc(db, PLATFORM_COLLECTION, PLATFORM_INTERVENTIONS);
    await setDoc(docRef, { interventions });
  } catch (e) { console.warn('saveInterventions failed:', e); }
};
