import { describe, expect, it } from 'vitest';
import { buildBody, buildChange } from '../nodes/Bring/batch';

describe('buildChange', () => {
	it('translates the name and generates a uuid for TO_PURCHASE', () => {
		expect(
			buildChange(
				{ name: 'Oignons', specification: '2' },
				'TO_PURCHASE',
				'fr-CH',
				true,
				() => 'u-1',
			),
		).toEqual({
			itemId: 'Zwiebeln',
			spec: '2',
			uuid: 'u-1',
			operation: 'TO_PURCHASE',
			accuracy: '0.0',
			altitude: '0.0',
			latitude: '0.0',
			longitude: '0.0',
		});
	});

	it('keeps the trimmed name when translate is false', () => {
		const c = buildChange(
			{ name: ' Oignons ', specification: '' },
			'TO_PURCHASE',
			'fr-CH',
			false,
			() => 'u',
		);
		expect(c.itemId).toBe('Oignons');
	});

	it('prefers the supplied uuid', () => {
		const c = buildChange(
			{ name: 'Oignons', specification: '', uuid: 'abc' },
			'REMOVE',
			'fr-CH',
			true,
			() => 'x',
		);
		expect(c.uuid).toBe('abc');
	});

	it('leaves uuid empty for non-purchase operations without uuid', () => {
		const c = buildChange(
			{ name: 'Oignons', specification: '' },
			'REMOVE',
			'fr-CH',
			true,
			() => 'x',
		);
		expect(c.uuid).toBe('');
	});

	it('rejects an empty name', () => {
		expect(() =>
			buildChange({ name: '  ', specification: '' }, 'TO_PURCHASE', 'fr-CH', true, () => 'x'),
		).toThrow('Item name is empty');
	});
});

describe('buildBody', () => {
	it('wraps changes with an empty sender', () => {
		const c = buildChange(
			{ name: 'Oignons', specification: '' },
			'REMOVE',
			'fr-CH',
			true,
			() => 'x',
		);
		expect(buildBody([c])).toEqual({ changes: [c], sender: '' });
	});
});
