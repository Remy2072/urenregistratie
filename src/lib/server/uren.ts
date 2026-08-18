import type { SupabaseClient } from '@supabase/supabase-js';
import type { Datum, ExportRegel } from '$lib/model';
import { datumNL, korteTijd, urenTekst } from '$lib/tijd';

/**
 * Wat de boekhouder krijgt.
 *
 * Eén plek, met opzet. De view `uren_export` in schema.sql bepaalt wélke
 * diensten meetellen -- alleen bevestigde, en de uren uit de werkelijke tijden
 * -- en dit bestand bepaalt hoe ze eruitzien in een bestand. Wil een ander
 * bedrijf andere kolommen, dan is dit het enige bestand dat verandert.
 *
 * Nooit euro's. Minimumloon is leeftijdsafhankelijk en verandert elk halfjaar;
 * zodra deze app bedragen uitrekent is hij verantwoordelijk voor fouten in
 * iemands salaris.
 */
export async function haalUren(
	supabase: SupabaseClient,
	van: Datum,
	tot: Datum
): Promise<ExportRegel[]> {
	const { data } = await supabase
		.from('uren_export')
		.select('*')
		.gte('datum', van)
		.lte('datum', tot)
		.order('medewerker')
		.order('datum');

	return ((data ?? []) as ExportRegel[]).map((r) => ({
		...r,
		begin: korteTijd(r.begin)!,
		einde: korteTijd(r.einde)!
	}));
}

const KOLOMMEN = ['Medewerker', 'Datum', 'Post', 'Begin', 'Einde', 'Uren', 'Opmerking'];

/**
 * CSV zoals Nederlandse Excel hem begrijpt:
 *
 * - puntkomma als scheidingsteken, want bij ons is de komma het decimaalteken
 * - datums als dd-mm-jjjj
 * - uren met een komma: 5,5 en niet 5.5
 * - CRLF aan het eind van elke regel
 *
 * De BOM zet de route ervoor; zonder die drie bytes maakt Excel van 'André'
 * iets anders.
 */
export function naarCsv(regels: ExportRegel[]): string {
	const veld = (w: string) => (/[";\n\r]/.test(w) ? `"${w.replaceAll('"', '""')}"` : w);
	const rijen = regels.map((r) =>
		[
			r.medewerker,
			datumNL(r.datum),
			r.post,
			r.begin,
			r.einde,
			urenTekst(r.uren),
			r.opmerking ?? ''
		]
			.map(veld)
			.join(';')
	);
	return [KOLOMMEN.join(';'), ...rijen].join('\r\n');
}

/** uren-17-08-2026-tm-23-08-2026.csv */
export function bestandsnaam(van: Datum, tot: Datum): string {
	return `uren-${datumNL(van)}-tm-${datumNL(tot)}.csv`;
}
