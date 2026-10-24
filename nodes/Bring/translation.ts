// Ports bring-api: Bring.__translate and Bring.map_user_language_to_locale (+ const.py locale constants).
import cdeAT from './locales/articles.de-AT.json';
import cdeCH from './locales/articles.de-CH.json';
import cdeDE from './locales/articles.de-DE.json';
import cenAU from './locales/articles.en-AU.json';
import cenCA from './locales/articles.en-CA.json';
import cenGB from './locales/articles.en-GB.json';
import cenUS from './locales/articles.en-US.json';
import cesES from './locales/articles.es-ES.json';
import cfrCH from './locales/articles.fr-CH.json';
import cfrFR from './locales/articles.fr-FR.json';
import chuHU from './locales/articles.hu-HU.json';
import citCH from './locales/articles.it-CH.json';
import citIT from './locales/articles.it-IT.json';
import cnbNO from './locales/articles.nb-NO.json';
import cnlNL from './locales/articles.nl-NL.json';
import cplPL from './locales/articles.pl-PL.json';
import cptBR from './locales/articles.pt-BR.json';
import cruRU from './locales/articles.ru-RU.json';
import csvSE from './locales/articles.sv-SE.json';
import ctrTR from './locales/articles.tr-TR.json';

export const DEFAULT_LOCALE = 'de-CH';

export type Catalog = Record<string, string>;

const CATALOGS: Record<string, Catalog> = {
	'de-AT': cdeAT,
	'de-CH': cdeCH,
	'de-DE': cdeDE,
	'en-AU': cenAU,
	'en-CA': cenCA,
	'en-GB': cenGB,
	'en-US': cenUS,
	'es-ES': cesES,
	'fr-CH': cfrCH,
	'fr-FR': cfrFR,
	'hu-HU': chuHU,
	'it-CH': citCH,
	'it-IT': citIT,
	'nb-NO': cnbNO,
	'nl-NL': cnlNL,
	'pl-PL': cplPL,
	'pt-BR': cptBR,
	'ru-RU': cruRU,
	'sv-SE': csvSE,
	'tr-TR': ctrTR,
};

export const SUPPORTED_LOCALES: readonly string[] = Object.keys(CATALOGS);

export const MAP_LANG_TO_LOCALE: Readonly<Record<string, string>> = {
	de: 'de-DE',
	en: 'en-US',
	es: 'es-ES',
	fr: 'fr-FR',
	hu: 'hu-HU',
	it: 'it-IT',
	nb: 'nb-NO',
	nl: 'nl-NL',
	pl: 'pl-PL',
	pt: 'pt-BR',
	ru: 'ru-RU',
	sv: 'sv-SE',
	tr: 'tr-TR',
};

export function getCatalog(locale: string): Catalog {
	const catalog = Object.prototype.hasOwnProperty.call(CATALOGS, locale) ? CATALOGS[locale] : undefined;
	if (!catalog) throw new Error(`Locale ${locale} not supported by Bring.`);
	return catalog;
}

export function mapUserLocale(language: string, country: string): string {
	const locale = `${language}-${country}`;
	if (SUPPORTED_LOCALES.includes(locale)) return locale;
	return Object.prototype.hasOwnProperty.call(MAP_LANG_TO_LOCALE, language)
		? MAP_LANG_TO_LOCALE[language]
		: DEFAULT_LOCALE;
}

/** Display name in `locale` -> catalog key (German). Unmatched input is returned trimmed. */
export function toKey(name: string, locale: string): string {
	const input = name.trim();
	if (locale === DEFAULT_LOCALE) return input;
	// reversed: duplicate display names resolve to the LAST key, like bring-api's {value: key} inversion
	const entries = Object.entries(getCatalog(locale)).reverse();
	const exact = entries.find(([, display]) => display === input);
	if (exact) return exact[0];
	const lower = input.toLowerCase();
	const byName = entries.find(([, display]) => display.toLowerCase() === lower);
	if (byName) return byName[0];
	// key match comes after display-name match to mirror bring-api
	const byKey = entries.find(([key]) => key.toLowerCase() === lower);
	return byKey ? byKey[0] : input;
}

/** Catalog key -> display name in `locale`; unknown keys are returned unchanged. */
export function toName(key: string, locale: string): string {
	if (locale === DEFAULT_LOCALE) return key;
	return getCatalog(locale)[key] ?? key;
}
