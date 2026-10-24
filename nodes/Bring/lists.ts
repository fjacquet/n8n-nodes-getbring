// Ports the to_locale item translation of Bring.get_list (bring-api).
import { toName } from './translation';

export interface BringList {
	listUuid: string;
	name: string;
}

export function resolveListUuid(
	lists: BringList[],
	locator: { mode: string; value: string },
): string {
	if (locator.mode !== 'name') return locator.value;
	const hits = lists.filter((l) => l.name === locator.value);
	if (hits.length === 0) throw new Error(`Bring list "${locator.value}" not found`);
	if (hits.length > 1) throw new Error(`Several Bring lists are named "${locator.value}"`);
	return hits[0].listUuid;
}

interface RawItem {
	uuid: string;
	specification: string;
	itemId: string;
}

export function mapListItems(
	response: { items: { purchase: RawItem[]; recently: RawItem[] } },
	locale: string,
	listUuid: string,
	includeRecently: boolean,
) {
	const rows = (raw: RawItem[], status: 'purchase' | 'recently') =>
		raw.map((i) => ({
			key: i.itemId,
			name: toName(i.itemId, locale),
			specification: i.specification,
			uuid: i.uuid,
			status,
			listUuid,
		}));
	return [
		...rows(response.items.purchase, 'purchase'),
		...(includeRecently ? rows(response.items.recently, 'recently') : []),
	];
}
