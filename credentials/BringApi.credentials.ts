import type { ICredentialTestRequest, ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

export class BringApi implements ICredentialType {
	name = 'bringApi';

	displayName = 'Bring API';

	documentationUrl = 'https://github.com/fjacquet/n8n-nodes-getbring#credential-setup';

	icon: Icon = {
		light: 'file:../nodes/Bring/bring.svg',
		dark: 'file:../nodes/Bring/bring.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@email.com',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.getbring.com/rest',
			url: '/v2/bringauth',
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: { email: '={{$credentials.email}}', password: '={{$credentials.password}}' },
		},
	};
}
