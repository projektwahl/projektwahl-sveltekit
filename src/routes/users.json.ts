import { sql } from '$lib/database';
import type {
	EndpointOutput,
	JSONValue,
	RequestHandler,
	ServerRequest
} from '@sveltejs/kit/types/endpoint';

export type MyEndpointOutput<Body extends string | Uint8Array | JSONValue> = {
	status?: number;
	headers?: Partial<Headers>;
	body?: Body;
};

export type MyRequestHandler<
	OutputBody extends string | Uint8Array | JSONValue,
	Locals = Record<string, any>,
	Body = unknown
> = (request: ServerRequest<Locals, Body>) => Promise<MyEndpointOutput<OutputBody>>;

export type UsersResponseBody = {
	users: Array<{ id: number; name: string; type: string }>; // TODO FIXME is id really returned as number?
	previousCursor: number | null;
	nextCursor: number | null;
};

export const get: MyRequestHandler<UsersResponseBody> = async function ({ query }) {
	// TODO pagination
	// TODO sorting and filtering

	// TODO FIXME better validation and null/undefined

	// AUDIT START

	const sortingQuery = query.getAll('sorting[]');

	let allowedOrderBy = sortingQuery
		.map((e) => e.split(':'))
		.filter((e) => ['id', 'name', 'type'].includes(e[0]))
		.filter((e) => ['up', 'down'].includes(e[1]));

	// https://www.postgresql.org/docs/current/queries-limit.html order by is more or less required for limit
	if (allowedOrderBy.length == 0) {
		allowedOrderBy = [['id', 'up']];
	}

	const orderByQuery = allowedOrderBy
		.map((e) => (e[1] === 'up' ? `${e[0]} ASC` : `${e[0]} DESC`))
		.join(',');
	const orderBy = ' ORDER BY ' + orderByQuery;

	const filterType = query
		.getAll('filter_type[]')
		.filter((t) => ['admin', 'helper', 'voter'].includes(t))
		.map((t) => `type='${t}'`);
	let filterTypeQuery = '';
	if (filterType.length > 0) {
		filterTypeQuery = ' AND (' + filterType.join(' OR ') + ')';
	}

	const paginationCursor = parseInt(query.get('pagination_cursor') ?? '0');
	const paginationDirection = query.get('pagination_direction');
	const paginationLimit: number = parseInt(query.get('pagination_limit') ?? '10');
	const isForwardsPagination: boolean = paginationDirection === 'forwards';
	const isBackwardsPagination: boolean = paginationDirection === 'backwards';
	const queryString = `SELECT id,name,type FROM users WHERE (($5 AND id >= $4) OR ($6 AND id < $4) OR ((NOT $5) AND (NOT $6))) AND name LIKE $1 AND ($2 OR id = $3) ${filterTypeQuery} ${orderBy} LIMIT ($7 + 1);`;

	console.log(queryString);
	const users = await sql.unsafe(queryString, [
		'%' + (query.get('filter_name') ?? '') + '%', // $1
		!query.has('filter_id'), // $2
		query.get('filter_id'), // $3 // TODO FIXME if this is "" we 500
		paginationCursor, // $4
		isForwardsPagination, // $5
		isBackwardsPagination, // $6
		paginationLimit // $7
	]);

	// e.g http://localhost:3000/users.json?pagination_direction=forwards
	let nextCursor: number | null = null;
	let previousCursor: number | null = null;
	if (isForwardsPagination) {
		previousCursor = paginationCursor;
		if (users.length > paginationLimit) {
			const lastElement = users.pop();
			nextCursor = lastElement?.id;
		}
	} else if (isBackwardsPagination) {
		if (users.length > paginationLimit) {
			const firstElement = users.shift();
			previousCursor = firstElement?.id;
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
