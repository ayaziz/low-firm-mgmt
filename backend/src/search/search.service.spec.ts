import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    // Only testing pure normalizeArabic — no DB dependency
    service = new SearchService(null as any);
  });

  describe('normalizeArabic', () => {
    it('should return falsy input unchanged (empty string)', () => {
      expect(service.normalizeArabic('')).toBe('');
    });

    it('should return null/undefined unchanged', () => {
      expect(service.normalizeArabic(null as any)).toBeNull();
      expect(service.normalizeArabic(undefined as any)).toBeUndefined();
    });

    it('should strip Arabic diacritics (tashkeel)', () => {
      // Fathah \u064E, Dammah \u064F, Kasrah \u0650, Sukun \u0652, Shadda \u0651
      const withDiacritics = '\u0643\u064E\u062A\u064E\u0628\u064E'; // كَتَبَ
      const expected = '\u0643\u062A\u0628'; // كتب
      expect(service.normalizeArabic(withDiacritics)).toBe(expected);
    });

    it('should strip tanwin forms', () => {
      // Fathatan \u064B, Dammatan \u064C, Kasratan \u064D
      const withTanwin = '\u0643\u062A\u0627\u0628\u064B\u0627'; // كتابًا
      const expected = '\u0643\u062A\u0627\u0628\u0627'; // كتابا
      expect(service.normalizeArabic(withTanwin)).toBe(expected);
    });

    it('should normalize Hamza-above-Alef (أ) to plain Alef (ا)', () => {
      const input = '\u0623\u062D\u0645\u062F'; // أحمد
      const expected = '\u0627\u062D\u0645\u062F'; // احمد
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should normalize Hamza-below-Alef (إ) to plain Alef (ا)', () => {
      const input = '\u0625\u0633\u0644\u0627\u0645'; // إسلام
      const expected = '\u0627\u0633\u0644\u0627\u0645'; // اسلام
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should normalize Alef-Madda (آ) to plain Alef (ا)', () => {
      const input = '\u0622\u062E\u0631'; // آخر
      const expected = '\u0627\u062E\u0631'; // اخر
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should normalize Taa Marbuta (ة) to Haa (ه)', () => {
      const input = '\u0645\u0643\u062A\u0628\u0629'; // مكتبة
      const expected = '\u0645\u0643\u062A\u0628\u0647'; // مكتبه
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should normalize Alef Maksura (ى) to Yaa (ي)', () => {
      const input = '\u0639\u0644\u0649'; // على
      const expected = '\u0639\u0644\u064A'; // علي
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should strip Kashida/Tatweel (ـ)', () => {
      const input = '\u0643\u0640\u062A\u0640\u0627\u0628'; // كـتـاب
      const expected = '\u0643\u062A\u0627\u0628'; // كتاب
      expect(service.normalizeArabic(input)).toBe(expected);
    });

    it('should handle combined normalizations', () => {
      // أحمد مكتبة ← احمد مكتبه
      const input = '\u0623\u064E\u062D\u0652\u0645\u064E\u062F مكتبة';
      const result = service.normalizeArabic(input);
      // Should strip diacritics and normalize Hamza
      expect(result).toContain('\u0627'); // Hamza → Alef
      expect(result).not.toMatch(/[\u064B-\u065F\u0670]/); // No diacritics
      expect(result).toContain('\u0645\u0643\u062A\u0628\u0647'); // ة → ه
    });

    it('should leave non-Arabic text unchanged', () => {
      expect(service.normalizeArabic('hello world')).toBe('hello world');
      expect(service.normalizeArabic('John Doe 123')).toBe('John Doe 123');
    });

    it('should handle mixed Arabic and Latin text', () => {
      const input = 'Case: \u0623\u062D\u0645\u062F vs Smith';
      const result = service.normalizeArabic(input);
      expect(result).toContain('Case:');
      expect(result).toContain('Smith');
      expect(result).toContain('\u0627\u062D\u0645\u062F'); // أحمد → احمد
    });
  });

  // ── HC filtering (FR-SEARCH-03) ──

  describe('globalSearch – HC filtering', () => {
    let searchService: SearchService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        queryTenant: jest.fn().mockResolvedValue([]),
      };
      searchService = new SearchService(mockPrisma);
    });

    it('should exclude HC docs when hasStepUp=false', async () => {
      await searchService.globalSearch('test-firm', 'user-1', 'contract', 'document', undefined, 20, false);

      expect(mockPrisma.queryTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining("!= 'HighlyConfidential'"),
        expect.any(Array),
      );
    });

    it('should include HC docs when hasStepUp=true', async () => {
      await searchService.globalSearch('test-firm', 'user-1', 'contract', 'document', undefined, 20, true);

      expect(mockPrisma.queryTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.not.stringContaining("!= 'HighlyConfidential'"),
        expect.any(Array),
      );
    });

    it('should return empty results for queries shorter than 2 chars', async () => {
      const result = await searchService.globalSearch('test-firm', 'user-1', 'a');
      expect(result).toEqual({ results: [], cursor: null });
      expect(mockPrisma.queryTenant).not.toHaveBeenCalled();
    });

    it('should default hasStepUp to false', async () => {
      await searchService.globalSearch('test-firm', 'user-1', 'contract', 'document');

      expect(mockPrisma.queryTenant).toHaveBeenCalledWith(
        'test-firm',
        expect.stringContaining("!= 'HighlyConfidential'"),
        expect.any(Array),
      );
    });
  });
});
