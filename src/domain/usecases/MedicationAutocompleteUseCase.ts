/**
 * MedicationAutocompleteUseCase
 * 
 * Proxy for medication autocomplete APIs to avoid CORS issues in mobile app.
 * Supports French medications API and RxNorm (English) API.
 */

export interface MedicationSuggestion {
  label: string;
  value: string;
  id: string;
}

export class MedicationAutocompleteUseCase {
  async execute(input: {
    term: string;
    locale: string;
  }): Promise<MedicationSuggestion[]> {
    const { term, locale } = input;

    // Validate term length
    if (term.length < 2) {
      throw new Error('Search term must be at least 2 characters long');
    }

    if (term.length > 100) {
      throw new Error('Search term must not exceed 100 characters');
    }

    // Route to appropriate API based on locale
    if (locale === 'fr') {
      return this.autocompleteFrench(term);
    }
    
    return this.autocompleteRxNorm(term);
  }

  /**
   * French medications API
   * API: base-donnees-publique.medicaments.gouv.fr
   */
  private async autocompleteFrench(term: string): Promise<MedicationSuggestion[]> {
    const url = `https://base-donnees-publique.medicaments.gouv.fr/api/options_autocompilation?searchType=medicine&term=${encodeURIComponent(term)}&contains=${encodeURIComponent(term)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SeniorHub-Backend/1.0',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.error(`[MedicationAutocomplete] French API returned ${response.status}`);
        return [];
      }

      const data = await response.json();

      // French API returns array of options
      if (!Array.isArray(data)) {
        console.error('[MedicationAutocomplete] French API returned non-array response');
        return [];
      }

      // Format response to match app expectations
      const suggestions = data.slice(0, 10).map((item: any) => ({
        label: item.label || item.name || item.value || '',
        value: item.value || item.code || item.label || '',
        id: item.id || item.code || item.value || '',
      }));

      return suggestions;
    } catch (error) {
      if (error instanceof Error) {
        console.error('[MedicationAutocomplete] French API failed:', error.message);
      } else {
        console.error('[MedicationAutocomplete] French API failed with unknown error');
      }
      return [];
    }
  }

  /**
   * RxNorm API (English)
   * API: rxnav.nlm.nih.gov
   */
  private async autocompleteRxNorm(term: string): Promise<MedicationSuggestion[]> {
    const url = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(term)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SeniorHub-Backend/1.0',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.error(`[MedicationAutocomplete] RxNorm API returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      const suggestions = data.suggestionGroup?.suggestionList?.suggestion || [];

      if (!Array.isArray(suggestions)) {
        return [];
      }

      // Format response to match app expectations
      return suggestions.slice(0, 10).map((name: string) => ({
        label: name,
        value: name,
        id: name,
      }));
    } catch (error) {
      if (error instanceof Error) {
        console.error('[MedicationAutocomplete] RxNorm API failed:', error.message);
      } else {
        console.error('[MedicationAutocomplete] RxNorm API failed with unknown error');
      }
      return [];
    }
  }
}
