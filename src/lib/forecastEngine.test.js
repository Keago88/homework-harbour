import { describe, it, expect } from 'vitest';
import { computeForecast } from './forecastEngine';

describe('forecastEngine', () => {
  describe('computeForecast', () => {
    it('returns null projected grade when no grades are available', () => {
      const forecast = computeForecast([], []);
      expect(forecast.projectedGrade).toBeNull();
      expect(forecast.trendDirection).toBe('Stable');
    });

    it('predicts an upward trend when grades are improving', () => {
      const assignments = [
        { status: 'Completed', grade: 70 },
        { status: 'Completed', grade: 90 },
      ];
      const forecast = computeForecast(assignments, []);
      expect(forecast.trendDirection).toBe('Upward');
      expect(forecast.projectedGrade).toBe(80);
    });

    it('predicts a downward trend when grades are falling', () => {
      const assignments = [
        { status: 'Completed', grade: 90 },
        { status: 'Completed', grade: 70 },
      ];
      const forecast = computeForecast(assignments, []);
      expect(forecast.trendDirection).toBe('Downward');
    });

    it('calculates late probability based on history', () => {
      const assignments = [
        { status: 'Completed', dueDate: '2026-01-01', submittedAt: '2026-01-02' }, // Late
        { status: 'Completed', dueDate: '2026-01-01', submittedAt: '2026-01-01' }, // On time
      ];
      const forecast = computeForecast(assignments, []);
      expect(forecast.lateProbability14Days).toBe(50);
    });
  });
});
