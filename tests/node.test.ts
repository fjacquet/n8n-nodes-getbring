import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Bring } from '../nodes/Bring/Bring.node';

const node: INode = {
	id: 'n1',
	name: 'Bring!',
	type: 'bring',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const LISTS = {
	lists: [{ listUuid: 'list-1', name: 'Groceries', theme: 'ch.publisher.list.home' }],
};

const fakeContext = (
	inputs: Record<string, unknown>[],
	{ continueOnFail = false, listName }: { continueOnFail?: boolean; listName?: string } = {},
) => {
	const httpRequest = vi.fn(async (opts: { method: string; url: string }) => {
		const body = (() => {
			if (opts.url.endsWith('/v2/bringauth'))
				return { uuid: 'u', publicUuid: 'p', token_type: 'Bearer', access_token: 't' };
			if (opts.url.endsWith('/v2/bringusers/u'))
				return { userLocale: { language: 'en', country: 'US' } };
			if (opts.url.endsWith('/bringusers/u/lists')) return LISTS;
			if (opts.url.endsWith('/bringusersettings/u')) return { userlistsettings: [] };
			return {};
		})();
		return { statusCode: 200, body };
	});
	const context = {
		getInputData: () => inputs.map(() => ({ json: {} })),
		getCredentials: vi.fn().mockResolvedValue({ email: 'a@b.c', password: 'pw' }),
		getNodeParameter: (name: string, i: number, fallback?: unknown) => {
			const params: Record<string, unknown> = {
				resource: 'item',
				operation: 'add',
				list: listName ? { mode: 'name', value: listName } : { mode: 'id', value: 'list-1' },
				specification: '',
				...inputs[i],
			};
			return name in params ? params[name] : fallback;
		},
		getNode: () => node,
		continueOnFail: () => continueOnFail,
		helpers: { httpRequest },
	} as unknown as IExecuteFunctions;
	const puts = () => httpRequest.mock.calls.map(([o]) => o).filter((o) => o.method === 'PUT');
	return { context, puts };
};

describe('Bring.execute item', () => {
	it('adds two items with a single PUT and returns key/name/uuid per item', async () => {
		const { context, puts } = fakeContext([{ itemName: 'Milk' }, { itemName: 'Bread' }]);

		const [out] = await new Bring().execute.call(context);

		expect(puts()).toHaveLength(1);
		const body = (puts()[0] as unknown as { body: { changes: { itemId: string }[] } }).body;
		expect(body.changes).toHaveLength(2);
		expect(out).toHaveLength(2);
		expect(out[0].json).toMatchObject({
			name: 'Milk',
			listUuid: 'list-1',
			operation: 'TO_PURCHASE',
		});
		expect(out[1].json).toMatchObject({ name: 'Bread' });
		expect(out[0].json.uuid).toEqual(expect.any(String));
		expect(out[0].json.key).toEqual(expect.any(String));
		expect(out.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('with continueOnFail reports the empty name and still sends the other item', async () => {
		const { context, puts } = fakeContext([{ itemName: '  ' }, { itemName: 'Bread' }], {
			continueOnFail: true,
		});

		const [out] = await new Bring().execute.call(context);

		expect(out[0].json).toEqual({ error: 'Item name is empty' });
		expect(out[1].json).toMatchObject({ name: 'Bread' });
		expect(puts()).toHaveLength(1);
		expect((puts()[0] as unknown as { body: { changes: unknown[] } }).body.changes).toHaveLength(1);
	});

	it('throws a NodeOperationError naming the list when By Name finds nothing', async () => {
		const { context, puts } = fakeContext([{ itemName: 'Milk' }], { listName: 'Nope' });

		const error = await new Bring().execute.call(context).catch((e) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error.message).toContain('Nope');
		expect(puts()).toHaveLength(0);
	});
});
