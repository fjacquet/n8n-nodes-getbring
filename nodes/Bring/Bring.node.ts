import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { listProperties } from './descriptions/ListDescription';
import { type BringList, mapListItems, resolveListUuid } from './lists';
import { bringLogin, bringRequest, getListLocale } from './transport';

type ListsResponse = { lists: (BringList & { theme: string })[] };

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
				options: [{ name: 'List', value: 'list' }],
				default: 'list',
			},
			...listProperties,
		],
	};

	methods = {
		listSearch: {
			async searchLists(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const session = await bringLogin.call(this);
				const { lists } = (await bringRequest.call(
					this,
					session,
					'GET',
					`bringusers/${session.uuid}/lists`,
				)) as ListsResponse;
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
		let lists: ListsResponse['lists'] | undefined;
		const locales = new Map<string, string>();
		const loadLists = async () => {
			lists ??= (
				(await bringRequest.call(
					this,
					session,
					'GET',
					`bringusers/${session.uuid}/lists`,
				)) as ListsResponse
			).lists;
			return lists;
		};

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
