// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2021 Moritz Hedtke <Moritz.Hedtke@t-online.de>
import type { ReadOnlyFormData } from '@mohe2015/kit/types/helper';

// https://github.com/Microsoft/TypeScript/issues/21732
/*
function hasKeys<T, K extends string | number | symbol>(obj: T, keys: K[]): obj is T & { [P in K]: unknown } {
    return obj !== null && keys.every(k => k in obj);
}*/

// TODO FIXME take case of null more (maybe also use null as default value in the original type then?)

export function hasPropertyType<T, K extends string, Y>(
	object: T,
	keys: K[],
	type: Y
): [
	T &
		{
			[k in K]: Y;
		},
	{ [index: string]: string }
] {
	const errors: { [index: string]: string } = {};
	const a = keys.filter((k) => !(k in object) || object[k as unknown as keyof T] === null);
	a.forEach((element) => {
		errors[element] = `${element} fehlt!`;
	});
	const b = a.filter((k) => k in object && typeof object[k as unknown as keyof T] !== typeof type);
	b.forEach((element) => {
		errors[element] = `${element} ist nicht vom Typ ${type}!`;
	});
	return [object as any, errors];
}

export function hasEnumProperty<T, K extends string, Y extends string>(
	object: T,
	keys: K[],
	enums: Readonly<Y[]>
): [
	T &
		{
			[k in K]: Y;
		},
	{ [index: string]: string }
] {
	const errors: { [index: string]: string } = {};
	const a = keys.filter((k) => !(k in object) || object[k as unknown as keyof T] === null);
	a.forEach((element) => {
		errors[element] = `${element} fehlt!`;
	});

	const b = keys.filter(
		(k) => k in object && !enums.includes(object[k as unknown as keyof T] as unknown as Y)
	);
	b.forEach((element) => {
		errors[element] = `${element} muss eines von ${enums} sein!`;
	});
	return [object as any, errors];
}
