/**
 * Risk Scoring Engine - 0-100 score with weighted components.
 * Spec: Completion (30%), Late Freq (20%), Grade Slope (25%), Engagement (15%), Recovery (10%).
 */

const getDate = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

export const RISK_BANDS = {
  LOW: { min: 80, max: 100, label: 'Low Risk', color: 'emerald' },
  MODERATE: { min: 60, max: 79, label: 'Moderate Risk', color: 'amber' },
  HIGH: { min: 40, max: 59, label: 'High Risk', color: 'orange' },
  CRITICAL: { min: 0, max: 39, label: 'Critical Risk', color: 'rose' },
};

export const getRiskBand = (score) => {
  if (score >= 80) return RISK_BANDS.LOW;
  if (score >= 60) return RISK_BANDS.MODERATE;
  if (score >= 40) return RISK_BANDS.HIGH;
  return RISK_BANDS.CRITICAL;
};

const weights = {
  completion: 0.3,
  lateFreq: 0.2,
  gradeSlope: 0.25,
  engagement: 0.15,
  recovery: 0.1,
};

/**
 * @param {Object} params
 * @param {Array} params.assignments - assignments with status, dueDate, grade, submittedAt
 * @param {Array} params.completionHistory - { date, subject } from analytics
 * @param {number} params.streak - current streak
 * @param {Object} params.recoveryTarget - { targetCompletion, achieved } if in recovery
 */
export function computeRiskScore(params) {
  const { assignments = [], completionHistory = [], streak = 0, recoveryTarget } = params;
  const today = getDate(0);

  // 1. Completion Rate (30%) - 0-100
  const total = assignments.length;
  const completed = assignments.filter(a => a.status === 'Completed' || a.status === 'Submitted').length;
  const completionScore = total > 0 ? Math.round((completed / total) * 100) : 100;

  // 2. Late Submission Frequency (20%) - inverse: fewer lates = higher score
  const submittedLate = assignments.filter(a => {
    const isOverdue = (a.status !== 'Completed' && a.status !== 'Submitted') && a.dueDate && today > a.dueDate;
    const sub = a.submittedAt || (a.status === 'Completed' ? today : null);
    const wasSubmittedLate = sub && a.dueDate && sub > a.dueDate;
    return isOverdue || wasSubmittedLate;
  }).length;
  const latePct = total > 0 ? (submittedLate / total) * 100 : 0;
  const lateScore = Math.max(0, 100 - latePct);

  // 3. Grade Trend Slope (25%) - use grades if present
  const graded = assignments.filter(a => typeof a.grade === 'number' || (typeof a.grade === 'string' && /^\d+$/.test(a.grade)));
  const gradeValues = graded.map(a => Number(a.grade)).filter(n => !isNaN(n));
  let gradeScore = 100;
  if (gradeValues.length >= 2) {
    const recent = gradeValues.slice(-5);
    const older = gradeValues.slice(0, -1).slice(-5);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.length ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent;
    const slope = avgRecent - avgOlder;
    gradeScore = Math.max(0, Math.min(100, 70 + slope * 2));
  } else if (gradeValues.length === 1) {
    gradeScore = Math.min(100, gradeValues[0]);
  }

  // 4. Engagement Consistency (15%) - streak-based
  const engagementScore = Math.min(100, 50 + streak * 5);

  // 5. Recovery Responsiveness (10%)
  let recoveryScore = 100;
  if (recoveryTarget && recoveryTarget.targetCompletion != null) {
    const achieved = recoveryTarget.achieved ?? 0;
    recoveryScore = Math.min(100, Math.round((achieved / recoveryTarget.targetCompletion) * 100));
  }

  const raw =
    completionScore * weights.completion +
    lateScore * weights.lateFreq +
    gradeScore * weights.gradeSlope +
    engagementScore * weights.engagement +
    recoveryScore * weights.recovery;

  return Math.round(Math.max(0, Math.min(100, raw)));
}
