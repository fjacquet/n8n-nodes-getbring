import { describe, expect, it } from 'vitest';
import {
	getCatalog,
	mapUserLocale,
	SUPPORTED_LOCALES,
	toKey,
	toName,
} from '../nodes/Bring/translation';

describe('toKey', () => {
	it.each([
		['Oignons', 'fr-CH', 'Zwiebeln'],
		['  OIGNONS ', 'fr-CH', 'Zwiebeln'],
		["Huile d'olive", 'fr-CH', 'Olivenöl'],
		['Zwiebeln', 'fr-CH', 'Zwiebeln'],
		['zwiebeln', 'fr-CH', 'Zwiebeln'],
		['Boissons', 'fr-CH', 'Getränke & Tabak'], // duplicate display name: last key wins like bring-api
		['Raisins', 'fr-CH', 'Rosinen'],
		['boissons', 'fr-CH', 'Getränke & Tabak'],
		['Oignon', 'fr-CH', 'Oignon'], // no fuzzy match
		['Oignons', 'de-CH', 'Oignons'], // default locale: untouched
	])('toKey(%j, %s) = %s', (name, locale, key) => {
		expect(toKey(name, locale)).toBe(key);
	});
});

describe('toName', () => {
	it('maps key to display name', () => expect(toName('Zwiebeln', 'fr-CH')).toBe('Oignons'));
	it('keeps unknown keys', () => expect(toName('Unbekannt', 'fr-CH')).toBe('Unbekannt'));
	it('leaves default locale untouched', () => expect(toName('Zwiebeln', 'de-CH')).toBe('Zwiebeln'));
});

describe('mapUserLocale', () => {
	it.each([
		['fr', 'CH', 'fr-CH'],
		['fr', 'BE', 'fr-FR'],
		['xx', 'YY', 'de-CH'],
	])('%s/%s -> %s', (l, c, out) => expect(mapUserLocale(l, c)).toBe(out));
});

describe('getCatalog', () => {
	it('loads fr-CH with 385 entries', () =>
		expect(Object.keys(getCatalog('fr-CH')).length).toBe(385));
	it('throws for unsupported locale', () => expect(() => getCatalog('fr-BE')).toThrow());
});

describe('SUPPORTED_LOCALES', () => {
	it('has 20 locales, each loadable', () => {
		expect(SUPPORTED_LOCALES.length).toBe(20);
		for (const l of SUPPORTED_LOCALES) expect(Object.keys(getCatalog(l)).length).toBeGreaterThan(0);
	});
});
