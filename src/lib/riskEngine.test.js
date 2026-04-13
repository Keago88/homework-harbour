import { describe, it, expect } from 'vitest';
import { computeRiskScore, RISK_BANDS } from './riskEngine';

describe('riskEngine', () => {
  describe('computeRiskScore', () => {
    it('returns a high score for no assignments (low risk)', () => {
      const score = computeRiskScore({ assignments: [], streak: 0 });
      expect(score).toBeGreaterThan(90);
    });

    it('calculates a high score for completed on-time assignments', () => {
      const assignments = [
        { status: 'Completed', dueDate: '2026-01-01', submittedAt: '2026-01-01' },
      ];
      const score = computeRiskScore({ assignments, streak: 5 });
      expect(score).toBeGreaterThan(90);
    });

    it('calculates a lower score for overdue assignments', () => {
      const assignments = [
        { status: 'Open', dueDate: '2020-01-01' },
      ];
      const score = computeRiskScore({ assignments, streak: 0 });
      expect(score).toBeLessThan(50);
    });

    it('incorporates grade trend into the score', () => {
      const assignmentsFalling = [
        { status: 'Completed', grade: 100 },
        { status: 'Completed', grade: 20 },
      ];
      const assignmentsRising = [
        { status: 'Completed', grade: 20 },
        { status: 'Completed', grade: 100 },
      ];
      
      const scoreFalling = computeRiskScore({ assignments: assignmentsFalling });
      const scoreRising = computeRiskScore({ assignments: assignmentsRising });
      
      expect(scoreRising).toBeGreaterThan(scoreFalling);
    });

    it('factors in recovery targets', () => {
      const baseParams = {
        assignments: [{ status: 'Open', dueDate: '2020-01-01' }],
        recoveryTarget: { targetCompletion: 10, achieved: 0 }
      };
      
      const scoreNoProgress = computeRiskScore(baseParams);
      const scoreWithProgress = computeRiskScore({
        ...baseParams,
        recoveryTarget: { targetCompletion: 10, achieved: 9 }
      });
      
      expect(scoreWithProgress).toBeGreaterThan(scoreNoProgress);
    });
  });
});
