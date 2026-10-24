import type { INodeProperties } from 'n8n-workflow';
import { SUPPORTED_LOCALES } from '../translation';
import { listLocator } from './ListDescription';

const show = { resource: ['catalog'] };

export const catalogProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get the article catalog',
				description: 'Get the article catalog (key and translated name) of a locale',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Locale Source',
		name: 'localeSource',
		type: 'options',
		displayOptions: { show },
		options: [
			{ name: 'From List', value: 'list', description: "Use the list's article language" },
			{ name: 'Fixed Locale', value: 'locale', description: 'Pick a locale (no login needed)' },
		],
		default: 'locale',
	},
	{ ...listLocator, displayOptions: { show: { ...show, localeSource: ['list'] } } },
	{
		displayName: 'Locale',
		name: 'locale',
		type: 'options',
		displayOptions: { show: { ...show, localeSource: ['locale'] } },
		options: [...SUPPORTED_LOCALES].sort().map((l) => ({ name: l, value: l })),
		default: 'de-CH',
	},
];
