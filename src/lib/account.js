/**
 * Auth/session and homework-access helpers shared by App and tests.
 * Keep these pure so role restore and persist keys can be unit-tested.
 */

export const ROLES = {
  STUDENT: 'Student',
  PARENT: 'Parent',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
};

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * Resolve the in-app identity after Firebase (or demo) auth.
 * Preference: stored demo user → remote Firestore account → Firebase profile → fallbacks.
 */
export function resolveSessionUser({
  firebaseUser,
  storedUser,
  remoteAccount,
  fallbackRole = ROLES.STUDENT,
} = {}) {
  const email = normalizeEmail(
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    storedUser?.email ||
    remoteAccount?.email ||
    remoteAccount?.profile?.email ||
    ''
  );
  const role =
    storedUser?.role ||
    remoteAccount?.role ||
    remoteAccount?.profile?.role ||
    fallbackRole;
  const name =
    firebaseUser?.displayName ||
    storedUser?.name ||
    remoteAccount?.profile?.name ||
    remoteAccount?.name ||
    (email ? email.split('@')[0] : '') ||
    'User';
  return { email, role, name };
}

export function canMutateAssignments(role) {
  return role !== ROLES.PARENT;
}

/** Who the current assignments list belongs to (self vs selected student). */
export function assignmentPersistKey({ role, ownKey, selectedStudentEmail }) {
  if ((role === ROLES.TEACHER || role === ROLES.PARENT) && selectedStudentEmail) {
    return selectedStudentEmail;
  }
  return ownKey;
}

export function isViewingStudent(role, selectedStudentEmail) {
  if (role === ROLES.PARENT) return Boolean(selectedStudentEmail);
  if (role === ROLES.TEACHER) return Boolean(selectedStudentEmail);
  return false;
}

export function mergeAssignmentLists(primary = [], secondary = []) {
  const map = new Map();
  for (const item of secondary || []) {
    if (item && item.id != null) map.set(String(item.id), item);
  }
  for (const item of primary || []) {
    if (item && item.id != null) map.set(String(item.id), item);
  }
  return [...map.values()];
}

export function studentsFromSchools(teacherEmail, schools = []) {
  const needle = normalizeEmail(teacherEmail);
  if (!needle) return [];
  const seen = new Set();
  const emails = [];
  for (const school of schools || []) {
    for (const cls of school.classes || []) {
      if (normalizeEmail(cls.teacherEmail) !== needle) continue;
      for (const student of cls.studentEmails || []) {
        const email = typeof student === 'string' ? student : student?.email;
        const key = normalizeEmail(email);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        emails.push(email);
      }
    }
  }
  return emails;
}
