import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { wieBenIk } from '$lib/server/wie';
import { bestandsnaam, haalUren, naarCsv } from '$lib/server/uren';

/**
 * Het bestand zelf, als gewoon adres.
 *
 * Bewust geen knop die in de browser een bestand in elkaar zet: dan bestaat de
 * export alleen zolang die pagina open staat, en kun je hem niet aan iemand
 * doorsturen of in een script gebruiken. Nu is het een link die je kunt mailen
 * -- al komt hij er alleen uit als je ingelogd bent en beheerder.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const ik = await wieBenIk(locals);
	if (ik?.rol !== 'beheerder') error(403, 'Alleen een beheerder haalt de uren op.');

	const van = url.searchParams.get('van') ?? '';
	const tot = url.searchParams.get('tot') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) {
		error(400, 'Geef een begin- en einddatum als jjjj-mm-dd.');
	}

	const csv = naarCsv(await haalUren(locals.supabase!, van, tot));

	// De BOM vooraan. Zonder die drie bytes leest Excel het bestand als
	// Windows-1252 en maakt het van 'André' iets anders.
	return new Response('﻿' + csv, {
		headers: {
			'content-type': 'text/csv;charset=utf-8',
			'content-disposition': `attachment; filename="${bestandsnaam(van, tot)}"`
		}
	});
};
