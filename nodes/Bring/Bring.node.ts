import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type { BringOperation } from './batch';
import { buildBody } from './batch';
import { itemProperties } from './descriptions/ItemDescription';
import { listProperties } from './descriptions/ListDescription';
import { type ItemRow, planBatches } from './items';
import { type BringList, mapListItems, resolveListUuid } from './lists';
import { type BringSession, bringLogin, bringRequest, getListLocale } from './transport';

type Lists = (BringList & { theme: string })[];

const ITEM_OPERATIONS: Record<string, BringOperation> = {
	add: 'TO_PURCHASE',
	remove: 'REMOVE',
	complete: 'TO_RECENTLY',
};

async function fetchLists(
	ctx: IExecuteFunctions | ILoadOptionsFunctions,
	session: BringSession,
): Promise<Lists> {
	const response = await bringRequest.call(ctx, session, 'GET', `bringusers/${session.uuid}/lists`);
	return (response as { lists: Lists }).lists;
}

function fail(ctx: IExecuteFunctions, error: Error, index: number): Error {
	return error instanceof NodeApiError
		? error
		: new NodeOperationError(ctx.getNode(), error, { itemIndex: index });
}

async function executeItems(
	ctx: IExecuteFunctions,
	items: INodeExecutionData[],
	session: BringSession,
	loadLists: () => Promise<Lists>,
	loadLocale: (listUuid: string) => Promise<string>,
): Promise<INodeExecutionData[]> {
	const failures = new Map<number, Error>();
	const rows: ItemRow[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const op = ctx.getNodeParameter('operation', i) as string;
			const locator = ctx.getNodeParameter('list', i) as { mode: string; value: string };
			const listUuid = resolveListUuid(locator.mode === 'name' ? await loadLists() : [], locator);
			const options = ctx.getNodeParameter('options', i, {}) as { translate?: boolean };
			rows.push({
				index: i,
				listUuid,
				locale: await loadLocale(listUuid),
				input: {
					name: ctx.getNodeParameter('itemName', i) as string,
					specification: ctx.getNodeParameter('specification', i, '') as string,
					uuid: op === 'add' ? undefined : (ctx.getNodeParameter('itemUuid', i, '') as string),
				},
				operation: ITEM_OPERATIONS[op],
				translate: options.translate ?? true,
			});
		} catch (error) {
			failures.set(i, error as Error);
		}
	}
	const { batches, errors } = planBatches(rows);
	for (const e of errors) failures.set(e.index, e.error);
	// Plan everything first: without continueOnFail nothing is written if any item is invalid.
	if (failures.size > 0 && !ctx.continueOnFail()) {
		const first = Math.min(...failures.keys());
		throw fail(ctx, failures.get(first) as Error, first);
	}

	// Lists are written one after another: if a later list's PUT fails without continueOnFail, earlier lists stay written.
	const results = new Map<number, INodeExecutionData>();
	for (const [listUuid, group] of batches) {
		try {
			await bringRequest.call(
				ctx,
				session,
				'PUT',
				`v2/bringlists/${listUuid}/items`,
				buildBody(group.map((g) => g.change)) as unknown as IDataObject,
			);
		} catch (error) {
			if (!ctx.continueOnFail()) throw fail(ctx, error as Error, group[0].index);
			for (const g of group) failures.set(g.index, error as Error);
			continue;
		}
		for (const { index, change } of group) {
			results.set(index, {
				json: {
					...items[index].json,
					key: change.itemId,
					name: (ctx.getNodeParameter('itemName', index) as string).trim(),
					specification: change.spec,
					uuid: change.uuid,
					listUuid,
					operation: change.operation,
				},
				pairedItem: { item: index },
			});
		}
	}
	return items.map(
		(_, i) =>
			results.get(i) ?? {
				json: { error: (failures.get(i) as Error).message },
				pairedItem: { item: i },
			},
	);
}

export class Bring implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bring!',
		name: 'bring',
		icon: { light: 'file:bring.svg', dark: 'file:bring.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Manage Bring! shopping lists',
		defaults: { name: 'Bring!' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'bringApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Item', value: 'item' },
					{ name: 'List', value: 'list' },
				],
				default: 'list',
			},
			...listProperties,
			...itemProperties,
		],
	};

	methods = {
		listSearch: {
			async searchLists(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const session = await bringLogin.call(this);
				const lists = await fetchLists(this, session);
				const needle = filter?.toLowerCase();
				return {
					results: lists
						.filter((l) => !needle || l.name.toLowerCase().includes(needle))
						.map((l) => ({ name: l.name, value: l.listUuid })),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const session = await bringLogin.call(this);
		let lists: Lists | undefined;
		const locales = new Map<string, string>();
		const loadLists = async () => {
			lists ??= await fetchLists(this, session);
			return lists;
		};
		const loadLocale = async (listUuid: string) => {
			let locale = locales.get(listUuid);
			if (locale === undefined) {
				locale = await getListLocale.call(this, session, listUuid);
				locales.set(listUuid, locale);
			}
			return locale;
		};

		// `resource` has noDataExpression, so it is the same for every input item.
		if (items.length > 0 && this.getNodeParameter('resource', 0) === 'item') {
			return [await executeItems(this, items, session, loadLists, loadLocale)];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const pairedItem = { item: i };
				if (operation === 'getAll') {
					for (const l of await loadLists()) {
						out.push({
							json: { listUuid: l.listUuid, name: l.name, theme: l.theme },
							pairedItem,
						});
					}
				} else if (operation === 'getItems') {
					const locator = this.getNodeParameter('list', i) as { mode: string; value: string };
					const listUuid = resolveListUuid(
						locator.mode === 'name' ? await loadLists() : [],
						locator,
					);
					const response = (await bringRequest.call(
						this,
						session,
						'GET',
						`v2/bringlists/${listUuid}`,
					)) as Parameters<typeof mapListItems>[0];
					let locale = locales.get(listUuid);
					if (locale === undefined) {
						locale = await getListLocale.call(this, session, listUuid);
						locales.set(listUuid, locale);
					}
					const includeRecently = this.getNodeParameter('includeRecently', i, false) as boolean;
					for (const row of mapListItems(response, locale, listUuid, includeRecently)) {
						out.push({ json: row, pairedItem });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeApiError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
