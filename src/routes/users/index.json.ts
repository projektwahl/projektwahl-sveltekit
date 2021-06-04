// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2021 Moritz Hedtke <Moritz.Hedtke@t-online.de>
import { sql } from '$lib/database';
import type { MyRequestHandler } from '$lib/request_helpers';

export type UserType = { id: number; name: string; type: string }; // TODO FIXME is id really returned as number?

export type UsersResponseBody = {
	users: Array<UserType>;
	previousCursor: number | null;
	nextCursor: number | null;
};

export const get: MyRequestHandler<UsersResponseBody> = async function ({ query }) {
	// TODO pagination
	// TODO sorting and filtering

	// TODO FIXME better validation and null/undefined

	// AUDIT START

	const paginationCursor = parseInt(query.get('pagination_cursor') ?? '0');
	const paginationDirection = query.get('pagination_direction');
	const paginationLimit: number = parseInt(query.get('pagination_limit') ?? '10');
	const isForwardsPagination: boolean = paginationDirection === 'forwards';
	const isBackwardsPagination: boolean = paginationDirection === 'backwards';

	const sortingQuery = query.getAll('sorting[]');

	let allowedOrderBy = sortingQuery
		.map((e) => e.split(':'))
		.filter((e) => ['id', 'name', 'type'].includes(e[0]))
		.filter((e) => ['up', 'down'].includes(e[1]));

	// https://www.postgresql.org/docs/current/queries-limit.html order by is more or less required for limit
	if (allowedOrderBy.length == 0) {
		allowedOrderBy = [['id', 'up']];
	}

	// orderBy needs to be reversed for backwards pagination
	if (isBackwardsPagination) {
		allowedOrderBy = allowedOrderBy.map((e) => [e[0], e[1] === 'up' ? 'down' : 'up']);
	}

	const orderByQuery = allowedOrderBy
		.map((e) => (e[1] === 'up' ? `${e[0]} ASC` : `${e[0]} DESC`))
		.join(',');
	const orderBy = ' ORDER BY ' + orderByQuery;

	// TODO FIXME try this with an array includes in sql?
	const filterType = query
		.getAll('filter_types[]')
		.filter((t) => ['admin', 'helper', 'voter'].includes(t))
		.map((t) => `type='${t}'`);
	let filterTypeQuery = '';
	if (filterType.length > 0) {
		filterTypeQuery = ' AND (' + filterType.join(' OR ') + ')';
	}

	const queryString = `SELECT id,name,type FROM users WHERE (($2 AND id >= $1) OR ($3 AND id < $1) OR ((NOT $2) AND (NOT $3))) AND name LIKE $5 AND ($6 OR id = $7) ${filterTypeQuery} ${orderBy} LIMIT ($4 + 1);`;

	console.log(queryString);
	const sqlParams = [
		paginationCursor, // $1
		isForwardsPagination, // $2
		isBackwardsPagination, // $3
		paginationLimit, // $4
		'%' + (query.get('filter_name') ?? '') + '%', // $5
		!query.has('filter_id'), // $6
		query.get('filter_id') // $7 // TODO FIXME if this is "" we 500
	];
	console.log(sqlParams);
	let users: Array<UserType> = await sql.unsafe<Array<UserType>>(queryString, sqlParams);

	// e.g http://localhost:3000/users.json?pagination_direction=forwards
	let nextCursor: number | null = null;
	let previousCursor: number | null = null;
	if (isForwardsPagination) {
		previousCursor = paginationCursor;
		if (users.length > paginationLimit) {
			const lastElement = users.pop();
			nextCursor = lastElement?.id ?? null;
		}
	} else if (isBackwardsPagination) {
		users = users.reverse(); // fixup as we needed to switch up orders above
		if (users.length > paginationLimit) {
			users.shift();
			previousCursor = users[0].id ?? null;
		}
		nextCursor = paginationCursor;
	}

	// AUDIT END

	return {
		body: {
			users,
			nextCursor,
			previousCursor
		}
	};
};
