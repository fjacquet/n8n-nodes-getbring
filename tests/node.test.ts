import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Bring } from '../nodes/Bring/Bring.node';
import userSettings from './fixtures/user_settings_response.json';

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
	{
		continueOnFail = false,
		listName,
		failPutFor,
		settings = { userlistsettings: [] },
		loginStatus = 200,
	}: {
		continueOnFail?: boolean;
		listName?: string;
		failPutFor?: string;
		settings?: unknown;
		loginStatus?: number;
	} = {},
) => {
	const httpRequest = vi.fn(async (opts: { method: string; url: string }) => {
		if (opts.method === 'PUT' && failPutFor && opts.url.includes(failPutFor))
			return { statusCode: 500, body: { message: 'boom' } };
		if (opts.url.endsWith('/v2/bringauth') && loginStatus !== 200)
			return { statusCode: loginStatus, body: { message: 'bad credentials' } };
		const body = (() => {
			if (opts.url.endsWith('/v2/bringauth'))
				return { uuid: 'u', publicUuid: 'p', token_type: 'Bearer', access_token: 't' };
			if (opts.url.endsWith('/v2/bringusers/u'))
				return { userLocale: { language: 'en', country: 'US' } };
			if (opts.url.endsWith('/bringusers/u/lists')) return LISTS;
			if (opts.url.endsWith('/bringusersettings/u')) return settings;
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
	return { context, puts, httpRequest };
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
		expect(out[0].json.key).toBe('Milch');
		expect(body.changes[0].itemId).toBe('Milch');
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

	it('returns the trimmed name that was sent', async () => {
		const { context } = fakeContext([{ itemName: '  Oignons ' }]);
		const [out] = await new Bring().execute.call(context);
		expect(out[0].json.name).toBe('Oignons');
	});

	it('sends TO_RECENTLY when completing', async () => {
		const { context, puts } = fakeContext([{ operation: 'complete', itemName: 'Milk' }]);
		await new Bring().execute.call(context);
		const change = (puts()[0] as unknown as { body: { changes: { operation: string }[] } }).body
			.changes[0];
		expect(change.operation).toBe('TO_RECENTLY');
	});

	it('coerces a non-string name to an empty-name error and a numeric spec to a string', async () => {
		const bad = fakeContext([{ itemName: 123 }, { itemName: undefined }], { continueOnFail: true });
		const [out] = await new Bring().execute.call(bad.context);
		expect(out[0].json.name).toBe('123');
		expect(out[1].json).toEqual({ error: 'Item name is empty' });

		const ok = fakeContext([{ itemName: 'Milk', specification: 5 }]);
		await new Bring().execute.call(ok.context);
		const change = (ok.puts()[0] as unknown as { body: { changes: { spec: string }[] } }).body
			.changes[0];
		expect(change.spec).toBe('5');
	});

	it('sends no uuid when removing without one', async () => {
		const { context, puts } = fakeContext([{ operation: 'remove', itemName: 'Milk' }]);
		const [out] = await new Bring().execute.call(context);
		const change = (puts()[0] as unknown as { body: { changes: object[] } }).body.changes[0];
		expect(change).not.toHaveProperty('uuid');
		expect(out[0].json.uuid).toBeUndefined();
	});

	describe('when the PUT of the second list fails', () => {
		const inputs = [
			{ itemName: 'Milk', list: { mode: 'id', value: 'list-a' } },
			{ itemName: 'Eggs', list: { mode: 'id', value: 'list-b' } },
			{ itemName: 'Bread', list: { mode: 'id', value: 'list-a' } },
		];

		it('with continueOnFail errors only that list, keeping input order', async () => {
			const { context } = fakeContext(inputs, { continueOnFail: true, failPutFor: 'list-b' });
			const [out] = await new Bring().execute.call(context);
			expect(out.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
			expect(out[0].json).toMatchObject({ name: 'Milk', listUuid: 'list-a' });
			expect(out[1].json).toEqual({ error: 'boom' });
			expect(out[2].json).toMatchObject({ name: 'Bread', listUuid: 'list-a' });
		});

		it('without continueOnFail throws', async () => {
			const { context } = fakeContext(inputs, { failPutFor: 'list-b' });
			await expect(new Bring().execute.call(context)).rejects.toThrow('boom');
		});
	});
});

describe('Bring.execute catalog', () => {
	it('returns the catalog of a fixed locale without any HTTP call', async () => {
		const { context, httpRequest } = fakeContext([
			{ resource: 'catalog', operation: 'get', localeSource: 'locale', locale: 'fr-CH' },
		]);

		const [out] = await new Bring().execute.call(context);

		expect(out).toHaveLength(385);
		expect(out.map((o) => o.json)).toContainEqual({
			key: 'Zwiebeln',
			name: 'Oignons',
			locale: 'fr-CH',
		});
		expect(out[0].pairedItem).toEqual({ item: 0 });
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it('takes the locale from the list article language', async () => {
		const { context, httpRequest } = fakeContext(
			[
				{
					resource: 'catalog',
					operation: 'get',
					localeSource: 'list',
					list: { mode: 'id', value: '00000000-0000-0000-0000-000000000000' },
				},
			],
			{ settings: userSettings },
		);

		const [out] = await new Bring().execute.call(context);

		expect(out.length).toBeGreaterThan(0);
		expect(out.every((o) => o.json.locale === 'de-DE')).toBe(true);
		expect(
			httpRequest.mock.calls.map(([o]) => o.url).some((u) => u.endsWith('/v2/bringauth')),
		).toBe(true);
	});
});

describe('Bring.execute login failure', () => {
	it('logs in once and reports the error on every item with continueOnFail', async () => {
		const { context, httpRequest } = fakeContext(
			[
				{ resource: 'list', operation: 'getAll' },
				{ resource: 'list', operation: 'getAll' },
				{ resource: 'list', operation: 'getAll' },
			],
			{ continueOnFail: true, loginStatus: 401 },
		);

		const [out] = await new Bring().execute.call(context);

		expect(httpRequest).toHaveBeenCalledTimes(1);
		expect(out).toHaveLength(3);
		expect(out.every((o) => typeof o.json.error === 'string')).toBe(true);
		expect(out.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
	});
});

describe('Bring.execute catalog unsupported language', () => {
	it('throws a NodeOperationError when the list language has no catalog', async () => {
		const { context } = fakeContext(
			[
				{
					resource: 'catalog',
					operation: 'get',
					localeSource: 'list',
					list: { mode: 'id', value: 'list-1' },
				},
			],
			{
				settings: {
					userlistsettings: [
						{ listUuid: 'list-1', usersettings: [{ key: 'listArticleLanguage', value: 'xx-XX' }] },
					],
				},
			},
		);

		const error = await new Bring().execute.call(context).catch((e) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error.message).toContain('xx-XX');
	});
});
