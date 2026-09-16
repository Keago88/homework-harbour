import { describe, it, expect } from 'vitest';
import {
  ROLES,
  resolveSessionUser,
  canMutateAssignments,
  assignmentPersistKey,
  isViewingStudent,
  mergeAssignmentLists,
  studentsFromSchools,
} from './account';

describe('resolveSessionUser', () => {
  it('uses Firebase email even when local store is empty (production)', () => {
    const resolved = resolveSessionUser({
      firebaseUser: { email: 'teacher@school.com', displayName: 'Alex' },
      storedUser: undefined,
      remoteAccount: null,
      fallbackRole: ROLES.STUDENT,
    });
    expect(resolved.email).toBe('teacher@school.com');
    expect(resolved.name).toBe('Alex');
    expect(resolved.role).toBe(ROLES.STUDENT);
  });

  it('restores role from Firestore when local store is empty', () => {
    const resolved = resolveSessionUser({
      firebaseUser: { email: 'parent@home.com' },
      storedUser: undefined,
      remoteAccount: { role: ROLES.PARENT, profile: { name: 'Pat', role: ROLES.PARENT } },
    });
    expect(resolved.role).toBe(ROLES.PARENT);
    expect(resolved.name).toBe('Pat');
    expect(resolved.email).toBe('parent@home.com');
  });

  it('prefers stored demo role over remote', () => {
    const resolved = resolveSessionUser({
      firebaseUser: { email: 'a@b.com' },
      storedUser: { email: 'a@b.com', role: ROLES.TEACHER, name: 'Stored' },
      remoteAccount: { role: ROLES.STUDENT },
    });
    expect(resolved.role).toBe(ROLES.TEACHER);
    expect(resolved.name).toBe('Stored');
  });
});

describe('assignment access', () => {
  it('parents cannot mutate assignments', () => {
    expect(canMutateAssignments(ROLES.PARENT)).toBe(false);
    expect(canMutateAssignments(ROLES.STUDENT)).toBe(true);
    expect(canMutateAssignments(ROLES.TEACHER)).toBe(true);
  });

  it('teachers persist to the selected student, otherwise themselves', () => {
    expect(assignmentPersistKey({
      role: ROLES.TEACHER,
      ownKey: 't@school.com',
      selectedStudentEmail: 'kid@school.com',
    })).toBe('kid@school.com');
    expect(assignmentPersistKey({
      role: ROLES.TEACHER,
      ownKey: 't@school.com',
      selectedStudentEmail: null,
    })).toBe('t@school.com');
  });

  it('parents always persist/view under the child key', () => {
    expect(assignmentPersistKey({
      role: ROLES.PARENT,
      ownKey: 'p@home.com',
      selectedStudentEmail: 'kid@school.com',
    })).toBe('kid@school.com');
  });

  it('isViewingStudent is true for parent/teacher with a selection', () => {
    expect(isViewingStudent(ROLES.PARENT, 'kid@x.com')).toBe(true);
    expect(isViewingStudent(ROLES.TEACHER, 'kid@x.com')).toBe(true);
    expect(isViewingStudent(ROLES.TEACHER, null)).toBe(false);
    expect(isViewingStudent(ROLES.STUDENT, 'kid@x.com')).toBe(false);
  });
});

describe('mergeAssignmentLists', () => {
  it('unions by id with primary winning', () => {
    const merged = mergeAssignmentLists(
      [{ id: 1, title: 'New', status: 'Completed' }],
      [{ id: 1, title: 'Old', status: 'Pending' }, { id: 2, title: 'Other', status: 'Pending' }]
    );
    expect(merged).toHaveLength(2);
    expect(merged.find(a => a.id === 1).title).toBe('New');
    expect(merged.find(a => a.id === 2).title).toBe('Other');
  });

  it('keeps teacher grade and note when the student copy omitted them', () => {
    const merged = mergeAssignmentLists(
      [{ id: 1, title: 'Fractions', status: 'Submitted', grade: null, teacherComments: '' }],
      [{ id: 1, title: 'Fractions', status: 'Submitted', grade: 88, teacherComments: 'Solid work — check Q4.' }]
    );
    const item = merged.find(a => a.id === 1);
    expect(item.grade).toBe(88);
    expect(item.teacherComments).toBe('Solid work — check Q4.');
    expect(item.title).toBe('Fractions');
  });

  it('lets a newer primary grade replace an older one', () => {
    const merged = mergeAssignmentLists(
      [{ id: 1, grade: 95, teacherComments: 'Updated note' }],
      [{ id: 1, grade: 70, teacherComments: 'First note' }]
    );
    expect(merged[0].grade).toBe(95);
    expect(merged[0].teacherComments).toBe('Updated note');
  });
});

describe('studentsFromSchools', () => {
  it('returns unique student emails for the teacher\'s classes', () => {
    const schools = [{
      classes: [
        { teacherEmail: 't@school.com', studentEmails: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
        { teacherEmail: 'other@school.com', studentEmails: [{ email: 'c@x.com' }] },
        { teacherEmail: 'T@school.com', studentEmails: [{ email: 'a@x.com' }, 'd@x.com'] },
      ],
    }];
    expect(studentsFromSchools('t@school.com', schools)).toEqual(['a@x.com', 'b@x.com', 'd@x.com']);
  });
});
