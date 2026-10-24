// Ports bring-api: Bring.login, Bring._request, Bring.get_all_user_settings and Bring.__locale.
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { mapUserLocale } from './translation';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

export interface BringSession {
	uuid: string;
	publicUuid: string;
	userLocale: string;
	headers: Record<string, string>;
}

const BASE_URL = 'https://api.getbring.com/rest/';
const BASE_HEADERS = {
	// Public key shipped in Bring's Android app (same as bring-api), not a secret.
	// eslint-disable-next-line @n8n/community-nodes/no-hardcoded-secrets
	'X-BRING-API-KEY': 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp',
	'X-BRING-CLIENT': 'android',
	'X-BRING-APPLICATION': 'bring',
};

/** Sends the request and throws a NodeApiError (message only, never the request) on non-2xx. */
async function send(
	ctx: Ctx,
	options: Parameters<Ctx['helpers']['httpRequest']>[0],
	messages: Record<number, string> = {},
): Promise<unknown> {
	let response: { statusCode: number; body: unknown };
	try {
		response = (await ctx.helpers.httpRequest({
			...options,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as { statusCode: number; body: unknown };
	} catch (error) {
		// Raw transport errors carry the request config (password, bearer token): keep only the code.
		const code = (error as { code?: unknown }).code;
		const message = `Bring request failed: ${typeof code === 'string' ? code : 'network error'}`;
		throw new NodeApiError(ctx.getNode(), { message } as JsonObject, { message });
	}
	const { statusCode, body } = response;
	if (statusCode < 400) return body;
	const bringMessage = (body as { message?: unknown } | undefined)?.message;
	const message =
		messages[statusCode] ??
		(typeof bringMessage === 'string' && bringMessage ? bringMessage : `HTTP ${statusCode}`);
	throw new NodeApiError(ctx.getNode(), { message } as JsonObject, {
		message,
		httpCode: String(statusCode),
	});
}

export async function bringLogin(this: Ctx): Promise<BringSession> {
	const { email, password } = (await this.getCredentials('bringApi')) as {
		email: string;
		password: string;
	};
	const auth = (await send(
		this,
		{
			method: 'POST',
			url: `${BASE_URL}v2/bringauth`,
			body: new URLSearchParams({ email, password }),
		},
		{
			401: 'Bring login failed: invalid email or password',
			400: 'Bring login failed: bad request, check the email address',
		},
	)) as {
		uuid: string;
		publicUuid: string;
		token_type: string;
		access_token: string;
	};

	const session: BringSession = {
		uuid: auth.uuid,
		publicUuid: auth.publicUuid,
		userLocale: '',
		headers: {
			...BASE_HEADERS,
			'X-BRING-USER-UUID': auth.uuid,
			'X-BRING-PUBLIC-USER-UUID': auth.publicUuid,
			Authorization: `${auth.token_type} ${auth.access_token}`,
		},
	};
	const account = (await bringRequest.call(this, session, 'GET', `v2/bringusers/${auth.uuid}`)) as {
		userLocale: { language: string; country: string };
	};
	const { language, country } = account.userLocale;
	session.headers['X-BRING-COUNTRY'] = country;
	session.userLocale = mapUserLocale(language, country);
	return session;
}

export async function bringRequest<T>(
	this: Ctx,
	session: BringSession,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
): Promise<T> {
	return (await send(this, {
		method,
		url: `${BASE_URL}${path}`,
		headers: session.headers,
		json: true,
		...(body && { body }),
	})) as T;
}

export async function getListLocale(
	this: Ctx,
	session: BringSession,
	listUuid: string,
): Promise<string> {
	const settings = (await bringRequest.call(
		this,
		session,
		'GET',
		`bringusersettings/${session.uuid}`,
	)) as {
		userlistsettings?: { listUuid: string; usersettings: { key: string; value: string }[] }[];
	};
	const list = settings.userlistsettings?.find((l) => l.listUuid === listUuid);
	return (
		list?.usersettings.find((s) => s.key === 'listArticleLanguage')?.value ?? session.userLocale
	);
}
