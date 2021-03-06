// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2021 Moritz Hedtke <Moritz.Hedtke@t-online.de>
import { sql } from '$lib/database';
import { buildGet } from '$lib/list-entities';
import { fakeTT } from '$lib/tagged-templates';
import type { RequestHandler } from '@sveltejs/kit';
import type { SerializableParameter } from 'postgres';
import type { MyLocals } from 'src/hooks';
import { dev } from '$app/env';
import type { EntityResponseBody } from '$lib/types';
import type { Result } from '$lib/result';

export type TestType = {
	id: number;
	a: string;
	b: string;
	c: string;
};

export const get: RequestHandler<
	MyLocals,
	Result<EntityResponseBody<TestType>, { [key: string]: string }>
> = async function (request) {
	if (!dev) {
		throw new Error('only available in dev');
	}

	return await buildGet(
		['id', 'a', 'b', 'c'],
		fakeTT<SerializableParameter>`SELECT ${sql(['id', 'a', 'b', 'c'])} FROM ${sql('test1')}`,
		(
			_query // TODO FIXME validation
		) => fakeTT<SerializableParameter>``
	)(request);
};
