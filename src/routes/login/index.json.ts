// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2021 Moritz Hedtke <Moritz.Hedtke@t-online.de>
import { sql } from '$lib/database';
import { checkPassword } from '$lib/password';
import type { Existing, RawSessionType, RawUserType } from '$lib/types';
import type { EndpointOutput, RequestHandler } from '@sveltejs/kit';
import type { MyLocals } from 'src/hooks';
import type { JSONValue } from '@sveltejs/kit/types/helper';
import { validator } from './validator';
import { isOk, Result, safeUnwrap } from '$lib/result';

export type Login = {
	session: RawSessionType;
};

export const post: RequestHandler<MyLocals, JSONValue> = async function (
	request
): Promise<EndpointOutput<Result<Login, { [key: string]: string }>>> {
	/*
	// https://github.com/panva/node-openid-client/blob/main/docs/README.md
	// .well-known/openid-configuration
	const issuer = await Issuer.discover(process.env['OPENID_URL']!);

	const Client = issuer.Client;

	// TODO ERROR HANDLING

	const client = new Client({
		client_id: process.env['CLIENT_ID']!,
		client_secret: process.env['CLIENT_SECRET']
	});

	const url = client.authorizationUrl({
		redirect_uri: `${process.env['THE_BASE_URL']}/redirect`,
		response_type: 'code',
		claims: 'roles'
	});

	return {
		body: {
			errors: {}
		},
		status: 307,
		headers: {
			Location: url
		}
	};*/

	const result = validator(request.locals.user, request.body);
	if (!isOk(result)) {
		return {
			body: result
		};
	}
	const user = safeUnwrap(result);

	const [entity]: [Existing<RawUserType>] =
		// eslint-disable-next-line @typescript-eslint/await-thenable
		await sql`SELECT id, name, password_hash AS password, type FROM users WHERE name = ${user.name} LIMIT 1`;

	if (entity === undefined) {
		return {
			body: {
				result: 'failure',
				failure: {
					name: 'Nutzer existiert nicht!'
				}
			}
		};
	}

	if (entity.password == null || !(await checkPassword(entity.password, user.password))) {
		return {
			body: {
				result: 'failure',
				failure: {
					password: 'Falsches Passwort!'
				}
			}
		};
	}

	const [session]: [RawSessionType] = await sql.begin('READ WRITE', async (sql) => {
		return await sql`INSERT INTO sessions (user_id) VALUES (${entity.id}) RETURNING session_id`;
	});

	// TODO https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

	// TODO FIXME CSRF

	return {
		body: {
			result: 'success',
			success: {
				session
			}
		},
		headers: {
			'Set-Cookie': [
				`strict_id=${session.session_id}; Max-Age=${
					48 * 60 * 60
				}; Secure; HttpOnly; SameSite=Strict`,
				`lax_id=${session.session_id}; Max-Age=${48 * 60 * 60}; Secure; HttpOnly; SameSite=Lax`
			]
		}
	};
};
