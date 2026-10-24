import { describe, expect, it } from 'vitest';
import { planBatches } from '../nodes/Bring/items';

const row = (index: number, listUuid: string, name: string) => ({
	index,
	listUuid,
	locale: 'de-CH',
	input: { name, specification: '' },
	operation: 'TO_PURCHASE' as const,
	translate: false,
});

describe('planBatches', () => {
	it('groups by list in input order and isolates the empty name as an error', () => {
		let n = 0;
		const { batches, errors } = planBatches(
			[row(0, 'a', 'Milk'), row(1, 'b', 'Eggs'), row(2, 'a', '  '), row(3, 'a', 'Bread')],
			() => `u${++n}`,
		);
		expect([...batches.keys()]).toEqual(['a', 'b']);
		expect(batches.get('a')?.map((e) => [e.index, e.change.itemId])).toEqual([
			[0, 'Milk'],
			[3, 'Bread'],
		]);
		expect(errors.map((e) => [e.index, e.error.message])).toEqual([[2, 'Item name is empty']]);
	});
});
