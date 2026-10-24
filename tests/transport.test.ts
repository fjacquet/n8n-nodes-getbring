import type { IExecuteFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { bringLogin, bringRequest, getListLocale } from '../nodes/Bring/transport';
import login from './fixtures/login_response.json';
import account from './fixtures/user_account_response.json';
import settings from './fixtures/user_settings_response.json';

const PASSWORD = 's3cret-pw';
const ok = (body: unknown) => ({ statusCode: 200, body });

function fakeThis(...responses: { statusCode: number; body: unknown }[]) {
	const httpRequest = vi.fn();
	for (const r of responses) httpRequest.mockResolvedValueOnce(r);
	const ctx = {
		helpers: { httpRequest },
		getCredentials: vi.fn().mockResolvedValue({ email: 'a@b.ch', password: PASSWORD }),
		getNode: () => ({ name: 'Bring' }),
	};
	return { ctx: ctx as unknown as IExecuteFunctions, httpRequest };
}

describe('bringLogin', () => {
	it('posts the form, then reads the account and builds the session', async () => {
		const { ctx, httpRequest } = fakeThis(ok(login), ok(account));
		const session = await bringLogin.call(ctx);

		const first = httpRequest.mock.calls[0][0];
		expect(first.returnFullResponse).toBe(true);
		expect(first.ignoreHttpStatusErrors).toBe(true);
		expect(first.method).toBe('POST');
		expect(first.url).toBe('https://api.getbring.com/rest/v2/bringauth');
		expect(first.body.toString()).toBe(`email=a%40b.ch&password=${PASSWORD}`);
		expect(first.headers?.['X-BRING-API-KEY']).toBeUndefined();

		expect(httpRequest.mock.calls[1][0].url).toBe(
			`https://api.getbring.com/rest/v2/bringusers/${login.uuid}`,
		);
		expect(session.uuid).toBe(login.uuid);
		expect(session.userLocale).toBe('de-DE');
		expect(session.headers).toMatchObject({
			'X-BRING-USER-UUID': login.uuid,
			'X-BRING-PUBLIC-USER-UUID': login.publicUuid,
			Authorization: `Bearer ${login.access_token}`,
			'X-BRING-COUNTRY': 'DE',
			'X-BRING-CLIENT': 'android',
			'X-BRING-APPLICATION': 'bring',
		});
	});

	it('maps 401 to a fixed message and never leaks the password', async () => {
		const { ctx } = fakeThis({ statusCode: 401, body: { message: 'nope' } });
		const error = (await bringLogin.call(ctx).catch((e) => e)) as Error;
		expect(error.message).toBe('Bring login failed: invalid email or password');
		expect(JSON.stringify(error)).not.toContain(PASSWORD);
	});

	it('maps 400 to a bad-request message', async () => {
		const { ctx } = fakeThis({ statusCode: 400, body: '' });
		await expect(bringLogin.call(ctx)).rejects.toThrow(
			'Bring login failed: bad request, check the email address',
		);
	});

	it('surfaces other failures with their message', async () => {
		const { ctx } = fakeThis({ statusCode: 503, body: { message: 'down for maintenance' } });
		await expect(bringLogin.call(ctx)).rejects.toThrow('down for maintenance');
	});
});

describe('bringLogin without userLocale', () => {
	it('falls back to the default locale instead of throwing', async () => {
		const { ctx } = fakeThis(ok(login), ok({}));
		const session = await bringLogin.call(ctx);
		expect(session.userLocale).toBe('de-DE');
		expect(session.headers['X-BRING-COUNTRY']).toBe('');
	});
});

describe('bringRequest', () => {
	const session = { uuid: 'u', publicUuid: 'p', userLocale: 'de-DE', headers: { A: 'b' } };

	it('sends session headers and a JSON body, returns the parsed body', async () => {
		const { ctx, httpRequest } = fakeThis(ok({ x: 1 }));
		const result = await bringRequest.call(ctx, session, 'PUT', 'v2/bringlists/l', { a: 1 });
		expect(result).toEqual({ x: 1 });
		expect(httpRequest.mock.calls[0][0]).toMatchObject({
			method: 'PUT',
			url: 'https://api.getbring.com/rest/v2/bringlists/l',
			headers: { A: 'b' },
			body: { a: 1 },
			json: true,
		});
	});

	it('throws NodeApiError with Bring message on non-2xx', async () => {
		const { ctx } = fakeThis({ statusCode: 404, body: { message: 'list not found' } });
		await expect(bringRequest.call(ctx, session, 'GET', 'v2/x')).rejects.toThrow('list not found');
	});
});

describe('getListLocale', () => {
	const session = { uuid: 'u', publicUuid: 'p', userLocale: 'fr-CH', headers: {} };

	it('returns the list article language when the list is configured', async () => {
		const { ctx, httpRequest } = fakeThis(ok(settings));
		const listUuid = settings.userlistsettings[0].listUuid;
		expect(await getListLocale.call(ctx, session, listUuid)).toBe('de-DE');
		expect(httpRequest.mock.calls[0][0].url).toBe(
			'https://api.getbring.com/rest/bringusersettings/u',
		);
	});

	it('falls back to the user locale when a list has no usersettings', async () => {
		const { ctx } = fakeThis(ok({ userlistsettings: [{ listUuid: 'l' }] }));
		expect(await getListLocale.call(ctx, session, 'l')).toBe('fr-CH');
	});

	it.each([
		['en-IE', 'en-US'],
		['fr-BE', 'fr-FR'],
		['xx-XX', 'de-CH'],
	])('maps the unsupported list language %s to %s', async (value, expected) => {
		const { ctx } = fakeThis(
			ok({
				userlistsettings: [
					{ listUuid: 'l', usersettings: [{ key: 'listArticleLanguage', value }] },
				],
			}),
		);
		expect(await getListLocale.call(ctx, session, 'l')).toBe(expected);
	});

	it('falls back to the user locale for an unknown list', async () => {
		const { ctx } = fakeThis(ok(settings));
		expect(await getListLocale.call(ctx, session, 'unknown')).toBe('fr-CH');
	});
});

describe('network failures', () => {
	const rawError = (config: object) =>
		Object.assign(new Error('timeout of 1000ms exceeded'), { code: 'EBRINGTEST', config });

	it('login: sanitized error without the password', async () => {
		const { ctx, httpRequest } = fakeThis();
		httpRequest.mockRejectedValueOnce(rawError({ data: `email=a&password=${PASSWORD}` }));
		const error = (await bringLogin.call(ctx).catch((e) => e)) as Error;
		expect(error.message).toBe('Bring request failed: EBRINGTEST');
		expect(JSON.stringify(error)).not.toContain(PASSWORD);
	});

	it('other requests: sanitized error without the token', async () => {
		const { ctx, httpRequest } = fakeThis();
		httpRequest.mockRejectedValueOnce(rawError({ headers: { Authorization: 'Bearer TOKEN-xyz' } }));
		const session = { uuid: 'u', publicUuid: 'p', userLocale: 'de-DE', headers: {} };
		const error = (await bringRequest.call(ctx, session, 'GET', 'v2/x').catch((e) => e)) as Error;
		expect(error.message).toBe('Bring request failed: EBRINGTEST');
		expect(JSON.stringify(error)).not.toContain('TOKEN-xyz');
	});
});
