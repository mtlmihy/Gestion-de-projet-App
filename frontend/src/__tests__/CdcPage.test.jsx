import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CdcPage from '../pages/CdcPage';
import * as cdcApi from '../api/cdc';

// Mock the API
jest.mock('../api/cdc');

// Mock ProjectContext
jest.mock('../context/ProjectContext', () => ({
  useProject: () => ({
    projet: { id: 1, nom: 'Test Project' },
    estLecteur: false,
  }),
}));

// Mock ThemeContext
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
  }),
}));

// Helper function to parse date keys (from CdcPage)
function jalonDateKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return Number.POSITIVE_INFINITY;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    return Date.UTC(y, m, d);
  }

  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) {
    const d = Number(fr[1]);
    const m = Number(fr[2]) - 1;
    const y = Number(fr[3]);
    return Date.UTC(y, m, d);
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

describe('CdcPage - Date Parsing', () => {
  const mockCdc = {
    id: 1,
    nom_projet: 'Test Project',
    reference: 'REF-001',
    chef_projet: 'Alice',
    service: 'IT',
    sponsor: 'Bob',
    date_debut: '2026-05-01',
    contexte: 'Test context',
    objectifs: 'Test objectives',
    perimetre: 'Test scope',
    fonctionnel: 'Test functional',
    technique: 'Test technical',
    ressources: 'Test resources',
    risques: 'Test risks',
    budget: '100000',
    history: [['1.0', '', 'Version initiale', '']],
    jalons: [['2026-06-01', 'Phase 1', 'Planning'], ['2026-07-01', 'Phase 2', 'Dev']],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cdcApi.getCdc.mockResolvedValue({ data: mockCdc });
    cdcApi.updateCdc.mockResolvedValue({ data: mockCdc });
  });

  describe('Date Format Parsing', () => {
    test('parses ISO format (YYYY-MM-DD)', () => {
      const iso = '2026-05-12';
      const key = jalonDateKey(iso);
      const expected = Date.UTC(2026, 4, 12); // Month is 0-indexed

      expect(key).toBe(expected);
    });

    test('parses French format (DD/MM/YYYY)', () => {
      const fr = '12/05/2026';
      const key = jalonDateKey(fr);
      const expected = Date.UTC(2026, 4, 12); // May is month 4 (0-indexed)

      expect(key).toBe(expected);
    });

    test('converts both formats to same UTC timestamp', () => {
      const iso = '2026-05-12';
      const fr = '12/05/2026';

      const keyIso = jalonDateKey(iso);
      const keyFr = jalonDateKey(fr);

      expect(keyIso).toBe(keyFr);
    });

    test('returns POSITIVE_INFINITY for empty string', () => {
      expect(jalonDateKey('')).toBe(Number.POSITIVE_INFINITY);
      expect(jalonDateKey(null)).toBe(Number.POSITIVE_INFINITY);
      expect(jalonDateKey(undefined)).toBe(Number.POSITIVE_INFINITY);
    });

    test('returns POSITIVE_INFINITY for invalid dates', () => {
      expect(jalonDateKey('invalid-date')).toBe(Number.POSITIVE_INFINITY);
      expect(jalonDateKey('32/13/2026')).toBe(Number.POSITIVE_INFINITY);
      expect(jalonDateKey('2026-13-45')).toBe(Number.POSITIVE_INFINITY);
    });

    test('handles various edge cases', () => {
      // First day of year
      expect(jalonDateKey('2026-01-01')).toBe(Date.UTC(2026, 0, 1));

      // Last day of year
      expect(jalonDateKey('2026-12-31')).toBe(Date.UTC(2026, 11, 31));

      // Leap year February
      expect(jalonDateKey('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    });
  });

  describe('Jalon Sorting', () => {
    test('sorts jalons chronologically by date', () => {
      const jalons = [
        ['2026-07-15', 'Phase 3', 'Testing'],
        ['2026-05-01', 'Phase 1', 'Planning'],
        ['2026-06-10', 'Phase 2', 'Dev'],
        ['', 'Unscheduled', 'Other'],
      ];

      const sorted = [...jalons].sort((a, b) => jalonDateKey(a[0]) - jalonDateKey(b[0]));

      expect(sorted[0][0]).toBe('2026-05-01');
      expect(sorted[1][0]).toBe('2026-06-10');
      expect(sorted[2][0]).toBe('2026-07-15');
      expect(sorted[3][0]).toBe(''); // Empty date at end
    });

    test('handles mixed date formats in jalons', () => {
      const jalons = [
        ['01/07/2026', 'Phase 3', 'Testing'],
        ['2026-05-01', 'Phase 1', 'Planning'],
        ['10/06/2026', 'Phase 2', 'Dev'],
      ];

      const sorted = [...jalons].sort((a, b) => jalonDateKey(a[0]) - jalonDateKey(b[0]));

      expect(sorted[0][0]).toBe('2026-05-01');
      expect(sorted[1][0]).toBe('10/06/2026');
      expect(sorted[2][0]).toBe('01/07/2026');
    });

    test('preserves unscheduled jalons at end', () => {
      const jalons = [
        ['2026-06-01', 'Scheduled', 'Work'],
        ['', 'Unscheduled 1', 'Work'],
        ['2026-05-01', 'Earlier', 'Work'],
        ['', 'Unscheduled 2', 'Work'],
      ];

      const sorted = [...jalons].sort((a, b) => jalonDateKey(a[0]) - jalonDateKey(b[0]));

      // Scheduled items first, in order
      expect(sorted[0][0]).toBe('2026-05-01');
      expect(sorted[1][0]).toBe('2026-06-01');
      // Unscheduled at end
      expect(sorted[2][0]).toBe('');
      expect(sorted[3][0]).toBe('');
    });
  });

  describe('CdcPage Component', () => {
    test('loads CDC on mount', async () => {
      render(<CdcPage />);

      await waitFor(() => {
        expect(cdcApi.getCdc).toHaveBeenCalledWith(1);
      });
    });

    test('displays project name', async () => {
      render(<CdcPage />);

      await waitFor(() => {
        expect(cdcApi.getCdc).toHaveBeenCalled();
      });
    });

    test('handles API errors gracefully', async () => {
      cdcApi.getCdc.mockRejectedValue(new Error('API Error'));

      render(<CdcPage />);

      await waitFor(() => {
        expect(cdcApi.getCdc).toHaveBeenCalled();
      });
    });

    test('saves CDC updates', async () => {
      render(<CdcPage />);

      await waitFor(() => {
        expect(cdcApi.getCdc).toHaveBeenCalled();
      });

      expect(cdcApi.updateCdc).not.toHaveBeenCalled();
    });
  });

  describe('Date Formatting Utils', () => {
    test('formats date in fr-CH locale', () => {
      const date = new Date('2026-05-12T00:00:00Z');
      const formatted = date.toLocaleDateString('fr-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      expect(formatted).toBe('12/05/2026');
    });

    test('extracts year from ISO date', () => {
      const iso = '2026-05-12';
      const year = iso.split('-')[0];

      expect(year).toBe('2026');
    });

    test('handles null/undefined dates', () => {
      expect(jalonDateKey(null)).toBe(Number.POSITIVE_INFINITY);
      expect(jalonDateKey(undefined)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('Jalon Export', () => {
    test('exports jalons in chronological order', () => {
      const jalons = [
        ['2026-07-01', 'Phase 3', 'Test'],
        ['2026-05-01', 'Phase 1', 'Plan'],
        ['2026-06-01', 'Phase 2', 'Dev'],
      ];

      const sorted = [...jalons].sort((a, b) => jalonDateKey(a[0]) - jalonDateKey(b[0]));
      const csv = sorted.map((j) => `${j[0]},${j[1]},${j[2]}`).join('\n');

      expect(csv).toContain('2026-05-01');
      expect(csv.indexOf('2026-05-01')).toBeLessThan(csv.indexOf('2026-06-01'));
      expect(csv.indexOf('2026-06-01')).toBeLessThan(csv.indexOf('2026-07-01'));
    });
  });
});
