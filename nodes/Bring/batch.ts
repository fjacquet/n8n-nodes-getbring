import { toKey } from './translation';

export type BringOperation = 'TO_PURCHASE' | 'TO_RECENTLY' | 'REMOVE';

export interface ItemInput {
	name: string;
	specification: string;
	uuid?: string;
}

export interface BringChange {
	itemId: string;
	spec: string;
	uuid: string;
	operation: BringOperation;
	accuracy: '0.0';
	altitude: '0.0';
	latitude: '0.0';
	longitude: '0.0';
}

export function buildChange(
	input: ItemInput,
	operation: BringOperation,
	locale: string,
	translate: boolean,
	newUuid: () => string,
): BringChange {
	const name = input.name.trim();
	if (!name) throw new Error('Item name is empty');
	return {
		itemId: translate ? toKey(name, locale) : name,
		spec: input.specification,
		// Empty uuid on non-purchase ops: Bring targets the newest match by name.
		uuid: input.uuid || (operation === 'TO_PURCHASE' ? newUuid() : ''),
		operation,
		accuracy: '0.0',
		altitude: '0.0',
		latitude: '0.0',
		longitude: '0.0',
	};
}

export function buildBody(changes: BringChange[]): { changes: BringChange[]; sender: '' } {
	return { changes, sender: '' };
}
