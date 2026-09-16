/**
 * Early-Warning System - trigger conditions and alert storage.
 */

import { getRiskBand } from './riskEngine';
import { getAlerts, saveAlerts } from './platformData';

export const ALERT_TYPES = {
  RISK_SHIFT: 'risk_shift',
  RISK_BAND_CHANGE: 'risk_band_change',
  GRADE_DECLINE: 'grade_decline',
  LATE_STREAK: 'late_streak',
  INTERVENTION_REQUIRED: 'intervention_required',
};

const getDate = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

export function checkAlertTriggers({ studentEmail, currentRisk, previousRisk, assignments, gradeSlope }) {
  const alerts = getAlerts();
  const today = getDate(0);
  const newAlerts = [];

  // Risk drop >= 10 in 7 days
  if (previousRisk != null && currentRisk !== null && (previousRisk - currentRisk) >= 10) {
    const existing = alerts.some(a => a.studentEmail === studentEmail && a.type === ALERT_TYPES.RISK_SHIFT && a.date === today);
    if (!existing) {
      newAlerts.push({
        id: `alert_${Date.now()}`,
        type: ALERT_TYPES.RISK_SHIFT,
        studentEmail,
        date: today,
        message: `Risk score dropped ${previousRisk - currentRisk} points`,
        severity: 'high',
        readBy: [],
      });
    }
  }

  // Risk band change
  if (previousRisk != null && currentRisk !== null) {
    const prevBand = getRiskBand(previousRisk).label;
    const currBand = getRiskBand(currentRisk).label;
    if (prevBand !== currBand) {
      const existing = alerts.some(a => a.studentEmail === studentEmail && a.type === ALERT_TYPES.RISK_BAND_CHANGE && a.date === today);
      if (!existing) {
        newAlerts.push({
          id: `alert_${Date.now()}_2`,
          type: ALERT_TYPES.RISK_BAND_CHANGE,
          studentEmail,
          date: today,
          message: `Risk band changed: ${prevBand} → ${currBand}`,
          severity: currBand.includes('High') || currBand.includes('Critical') ? 'high' : 'medium',
          readBy: [],
        });
      }
    }
  }

  // Grade slope decline >= 10%
  if (gradeSlope != null && gradeSlope <= -10) {
    const existing = alerts.some(a => a.studentEmail === studentEmail && a.type === ALERT_TYPES.GRADE_DECLINE && a.date === today);
    if (!existing) {
      newAlerts.push({
        id: `alert_${Date.now()}_3`,
        type: ALERT_TYPES.GRADE_DECLINE,
        studentEmail,
        date: today,
        message: `Grade trend declined ${Math.abs(gradeSlope)}%`,
        severity: 'high',
        readBy: [],
      });
    }
  }

  // Consecutive late streak >= 3
  const completed = assignments.filter(a => a.status === 'Completed' || a.status === 'Submitted').sort((a, b) => (a.submittedAt || a.dueDate).localeCompare(b.submittedAt || b.dueDate));
  let lateStreak = 0;
  for (let i = completed.length - 1; i >= 0; i--) {
    const a = completed[i];
    const sub = a.submittedAt || a.dueDate;
    if (sub > a.dueDate) lateStreak++;
    else break;
  }
  if (lateStreak >= 3) {
    const existing = alerts.some(a => a.studentEmail === studentEmail && a.type === ALERT_TYPES.LATE_STREAK && a.date === today);
    if (!existing) {
      newAlerts.push({
        id: `alert_${Date.now()}_4`,
        type: ALERT_TYPES.LATE_STREAK,
        studentEmail,
        date: today,
        message: `${lateStreak} assignments submitted late in a row`,
        severity: 'high',
        readBy: [],
      });
    }
  }

  if (newAlerts.length > 0) {
    saveAlerts([...alerts, ...newAlerts]);
  }
  return newAlerts;
}

export function getAlertsForStudent(studentEmail) {
  return getAlerts().filter(a => a.studentEmail === studentEmail);
}

export function getAlertsForParent(parentEmail, linkedStudents) {
  return getAlerts().filter(a => linkedStudents.includes(a.studentEmail));
}

export function getUnreadAlertsForUser(userEmail, linkedStudents = [], role) {
  const linked = linkedStudents || [];
  let all;
  if (role === 'Parent') {
    all = getAlertsForParent(userEmail, linked);
  } else if (role === 'Teacher') {
    all = getAlerts().filter(a =>
      linked.includes(a.studentEmail) ||
      a.studentEmail === userEmail ||
      a.recipients?.includes(userEmail)
    );
  } else {
    all = getAlerts().filter(a => a.studentEmail === userEmail || a.recipients?.includes(userEmail));
  }
  return all.filter(a => !a.readBy?.includes(userEmail));
}

export function markAlertRead(alertId, userEmail) {
  const alerts = getAlerts();
  const a = alerts.find(x => x.id === alertId);
  if (a) {
    a.readBy = [...(a.readBy || []), userEmail];
    saveAlerts(alerts);
  }
}
