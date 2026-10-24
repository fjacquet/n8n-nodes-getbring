import type { INodeProperties } from 'n8n-workflow';

/** Shared list picker; other resources reuse it with their own displayOptions. */
export const listLocator: INodeProperties = {
	displayName: 'List',
	name: 'list',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchLists', searchable: true },
		},
		{ displayName: 'ID', name: 'id', type: 'string', placeholder: 'List UUID' },
		{ displayName: 'Name', name: 'name', type: 'string', placeholder: 'Groceries' },
	],
};

export const listProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['list'] } },
		options: [
			{
				name: 'Get Items',
				value: 'getItems',
				action: 'Get the items of a list',
				description: 'Get the articles of a shopping list',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many lists',
				description: 'Get many shopping lists of the account',
			},
		],
		default: 'getAll',
	},
	{
		...listLocator,
		displayOptions: { show: { resource: ['list'], operation: ['getItems'] } },
	},
	{
		displayName: 'Include Recently Used',
		name: 'includeRecently',
		type: 'boolean',
		default: false,
		description: 'Whether to also return items from the "recently" section',
		displayOptions: { show: { resource: ['list'], operation: ['getItems'] } },
	},
];
