import { describe, expect, it } from 'vitest';
import { mapListItems, resolveListUuid } from '../nodes/Bring/lists';

const lists = [
	{ listUuid: 'u-1', name: 'Maison' },
	{ listUuid: 'u-2', name: 'Bureau' },
	{ listUuid: 'u-3', name: 'Bureau' },
];

describe('resolveListUuid', () => {
	it('passes an id through untouched', () => {
		expect(resolveListUuid(lists, { mode: 'id', value: 'anything' })).toBe('anything');
	});
	it('resolves a name to its uuid', () => {
		expect(resolveListUuid(lists, { mode: 'name', value: 'Maison' })).toBe('u-1');
	});
	it('throws when the name is unknown (case-sensitive)', () => {
		expect(() => resolveListUuid(lists, { mode: 'name', value: 'maison' })).toThrow(
			'Bring list "maison" not found',
		);
	});
	it('throws when several lists share the name', () => {
		expect(() => resolveListUuid(lists, { mode: 'name', value: 'Bureau' })).toThrow(
			'Several Bring lists are named "Bureau"',
		);
	});
});

describe('mapListItems', () => {
	const response = {
		items: {
			purchase: [{ uuid: 'a', specification: 'vert', itemId: 'Zwiebeln' }],
			recently: [{ uuid: 'b', specification: '', itemId: 'Paprikapulver' }],
		},
	};

	it('maps purchase items with translated names and skips recently by default', () => {
		expect(mapListItems(response, 'fr-CH', 'L', false)).toEqual([
			{
				key: 'Zwiebeln',
				name: 'Oignons',
				specification: 'vert',
				uuid: 'a',
				status: 'purchase',
				listUuid: 'L',
			},
		]);
	});

	it('appends recently items when requested', () => {
		const rows = mapListItems(response, 'fr-CH', 'L', true);
		expect(rows.map((r) => [r.status, r.key, r.name])).toEqual([
			['purchase', 'Zwiebeln', 'Oignons'],
			['recently', 'Paprikapulver', 'Paprika'],
		]);
	});
});
