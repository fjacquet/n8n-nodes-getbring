import type { INodeProperties } from 'n8n-workflow';
import { listLocator } from './ListDescription';

const show = { resource: ['item'] };
const showUuid = { resource: ['item'], operation: ['remove', 'complete'] };

export const itemProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Add',
				value: 'add',
				action: 'Add an item to a list',
				description: 'Add an article to a shopping list',
			},
			{
				name: 'Complete',
				value: 'complete',
				action: 'Complete an item of a list',
				description: 'Mark an article as bought (moves it to recently used)',
			},
			{
				name: 'Remove',
				value: 'remove',
				action: 'Remove an item from a list',
				description: 'Remove an article from a shopping list',
			},
		],
		default: 'add',
	},
	{ ...listLocator, displayOptions: { show } },
	{
		displayName: 'Item Name',
		name: 'itemName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show },
	},
	{
		displayName: 'Specification',
		name: 'specification',
		type: 'string',
		default: '',
		description: 'Optional detail such as a quantity or brand',
		displayOptions: { show },
	},
	{
		displayName: 'Item UUID',
		name: 'itemUuid',
		type: 'string',
		default: '',
		description:
			'Target a specific item. Left empty, Bring acts on the most recent item with that name.',
		displayOptions: { show: showUuid },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Translate Name',
				name: 'translate',
				type: 'boolean',
				default: true,
				description:
					"Whether to translate the name to Bring's catalog key so the article gets its icon",
			},
		],
	},
];
