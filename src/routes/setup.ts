// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2021 Moritz Hedtke <Moritz.Hedtke@t-online.de>
import { dev } from '$app/env';
import { sql } from '$lib/database';
import { hashPassword } from '$lib/password';
import type { Result } from '$lib/result';
import type { Existing, RawUserType } from '$lib/types';
import type { EndpointOutput, RequestHandler } from '@sveltejs/kit';
import type { MyLocals } from 'src/hooks';

const shuffleArray = <T>(array: T[]) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
};

export const get: RequestHandler<MyLocals, void> = async function (): Promise<
	EndpointOutput<Result<Record<string, never>, { [key: string]: string }>>
> {
	//allowUserType(request, []);

	if (dev) {
		try {
			await sql.begin('READ WRITE', async (sql) => {
				await sql.file('src/lib/setup.sql', undefined, {
					cache: false // TODO FIXME doesnt seem to work properly
				});

				await sql`INSERT INTO users (name, password_hash, type) VALUES ('admin', ${await hashPassword(
					'changeme'
				)}, 'admin') ON CONFLICT DO NOTHING;`;

				const projects =
					await sql`INSERT INTO projects (title, info, place, costs, min_age, max_age, min_participants, max_participants, presentation_type, requirements, random_assignments) (SELECT generate_series, '', '', 0, 5, 13, 5, 20, '', '', FALSE FROM generate_series(1, 10)) RETURNING *;`;

				console.log(projects);

				// take care to set this value to project_count * min_participants <= user_count <= project_count * max_participants
				for (let i = 0; i < 100; i++) {
					// TODO FIXME add user to keycloak / import users from keycloak (probably easier)
					// https://www.keycloak.org/documentation
					// https://www.keycloak.org/docs-api/15.0/rest-api/index.html

					// TODO compare our approach in general with https://github.com/keycloak/keycloak-quickstarts

					// https://github.com/keycloak/keycloak-documentation/blob/master/server_admin/topics/admin-cli.adoc

					// INTERESTING https://www.keycloak.org/docs/latest/server_admin/index.html#automatically-link-existing-first-login-flow
					// https://github.com/keycloak/keycloak-documentation/blob/master/server_admin/topics/identity-broker/first-login-flow.adoc

					// https://www.keycloak.org/docs-api/15.0/rest-api/index.html

					// TODO we could use that admin URL
					// Remove all user sessions associated with the user Also send notification to all clients that have an admin URL to invalidate the sessions for the particular user.
					/*
					const response = await fetch(process.env['OPENID_ADMIN_URL']!, {
						method: 'POST',
						headers: {
							Accept: 'application/json',
							'Content-Type': 'application/json',
							Authorization: `Bearer ${process.env['PROJEKTWAHL_ADMIN_ACCESS_TOKEN']}`
						},
						redirect: 'manual',
						body: JSON.stringify({
							username: `user${Math.random()}`,
							//email: `user${i}@example.org`,
							enabled: true
						})
					});
					console.log(await response.text());
					console.log(response.headers);
					console.log(response.headers.get('location'));
					const userResponse = await fetch(response.headers.get('location')!, {
						method: 'GET',
						headers: {
							Accept: 'application/json',
							'Content-Type': 'application/json',
							Authorization: `Bearer ${process.env['PROJEKTWAHL_ADMIN_ACCESS_TOKEN']}`
						}
					});
					const keycloakUser = await userResponse.json();
					console.log(keycloakUser);
					*/

					const [user] = await sql<
						[Existing<RawUserType>]
					>`INSERT INTO users (name, type, "group", age) VALUES (${`user${Math.random()}`}, 'voter', 'a', 10) ON CONFLICT DO NOTHING RETURNING *;`;
					shuffleArray(projects);
					for (let j = 0; j < 5; j++) {
						// TODO FIXME generate users who voted incorrectly (maybe increase/decrease iterations)
						// eslint-disable-next-line @typescript-eslint/await-thenable
						await sql`INSERT INTO choices (user_id, project_id, rank) VALUES (${user.id}, ${
							projects[j].id
						}, ${j + 1});`;
					}
				}
			});
		} catch (error) {
			console.error(error);
		}
	}

	return {
		body: {
			result: 'success',
			success: {}
		}
	};
};
