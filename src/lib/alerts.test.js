import { describe, it, expect, beforeEach } from 'vitest';
import { checkAlertTriggers, getUnreadAlertsForUser, ALERT_TYPES } from './alerts';
import { saveAlerts } from './platformData';

describe('alerts', () => {
  beforeEach(() => {
    saveAlerts([]);
  });

  it('creates a late-streak alert and shows it to the linked teacher', () => {
    const assignments = [
      { status: 'Completed', dueDate: '2026-01-01', submittedAt: '2026-01-02' },
      { status: 'Completed', dueDate: '2026-01-03', submittedAt: '2026-01-04' },
      { status: 'Completed', dueDate: '2026-01-05', submittedAt: '2026-01-06' },
    ];
    const created = checkAlertTriggers({
      studentEmail: 'kid@school.com',
      currentRisk: 50,
      previousRisk: 80,
      assignments,
      gradeSlope: null,
    });
    expect(created.some(a => a.type === ALERT_TYPES.LATE_STREAK)).toBe(true);
    expect(created.some(a => a.type === ALERT_TYPES.RISK_SHIFT)).toBe(true);

    const teacherUnread = getUnreadAlertsForUser('t@school.com', ['kid@school.com'], 'Teacher');
    expect(teacherUnread.length).toBeGreaterThan(0);

    const parentUnread = getUnreadAlertsForUser('p@home.com', ['kid@school.com'], 'Parent');
    expect(parentUnread.length).toBeGreaterThan(0);

    const stranger = getUnreadAlertsForUser('other@x.com', [], 'Student');
    expect(stranger).toHaveLength(0);
  });
});
