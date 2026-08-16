<script lang="ts">
	import type { ExportRegel } from '$lib/model';
	import { naamVan, postNaam } from '$lib/nepdata';
	import { staat } from '$lib/prototype.svelte';
	import { afwijkend, datumKort, duurInUren, urenTekst } from '$lib/tijd';

	const periodes = [
		{ id: 'aug', naam: 'Augustus 2026', van: '2026-08-01', tot: '2026-08-31' },
		{ id: 'w33', naam: 'Week 33', van: '2026-08-10', tot: '2026-08-16' },
		{ id: 'w34', naam: 'Week 34', van: '2026-08-17', tot: '2026-08-23' }
	];

	let periodeId = $state('aug');
	let periode = $derived(periodes.find((p) => p.id === periodeId)!);

	/**
	 * Dit is de view `uren_export` uit schema.sql, regel voor regel: alleen
	 * bevestigde diensten, en de uren uit werkelijk_begin/eind. Nooit euro's.
	 */
	let regels = $derived<ExportRegel[]>(
		staat.diensten
			.filter(
				(d) =>
					d.status === 'bevestigd' &&
					d.werkelijk_begin !== null &&
					d.werkelijk_eind !== null &&
					d.datum >= periode.van &&
					d.datum <= periode.tot
			)
			.map((d) => ({
				medewerker: naamVan(d.persoon_id),
				datum: d.datum,
				post: postNaam(d.post_id),
				begin: d.werkelijk_begin!,
				einde: d.werkelijk_eind!,
				uren: duurInUren(d.werkelijk_begin!, d.werkelijk_eind!),
				afwijkend: afwijkend(d),
				opmerking: d.opmerking
			}))
			.sort((a, b) => a.medewerker.localeCompare(b.medewerker) || a.datum.localeCompare(b.datum))
	);

	let totaal = $derived(regels.reduce((s, r) => s + r.uren, 0));

	function csv(): string {
		const kolommen = ['medewerker', 'datum', 'post', 'begin', 'einde', 'uren', 'opmerking'];
		const veld = (w: string) => (/[";\n]/.test(w) ? `"${w.replaceAll('"', '""')}"` : w);
		const rijen = regels.map((r) =>
			[
				r.medewerker,
				r.datum,
				r.post,
				r.begin,
				r.einde,
				urenTekst(r.uren),
				r.opmerking ?? ''
			]
				.map(veld)
				.join(';')
		);
		// Puntkomma, want Nederlandse Excel leest komma's niet als scheidingsteken.
		return [kolommen.join(';'), ...rijen].join('\r\n');
	}

	function download() {
		const blob = new Blob(['﻿' + csv()], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `uren-${periode.id}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="blok">
	<p>
		<select bind:value={periodeId}>
			{#each periodes as p (p.id)}
				<option value={p.id}>{p.naam}</option>
			{/each}
		</select>
	</p>

	{#if regels.length === 0}
		<p class="leeg">Geen bevestigde diensten in deze periode.</p>
	{:else}
		<div class="tabelrand">
			<table>
				<thead>
					<tr>
						<th>Medewerker</th>
						<th>Datum</th>
						<th>Post</th>
						<th>Begin</th>
						<th>Einde</th>
						<th class="getal">Uren</th>
						<th>Opmerking</th>
					</tr>
				</thead>
				<tbody>
					{#each regels as r (r.medewerker + r.datum + r.post)}
						<tr>
							<td>{r.medewerker}</td>
							<td>{datumKort(r.datum)}</td>
							<td>{r.post}</td>
							<td class="tijden">{r.begin}</td>
							<td class="tijden">{r.einde}</td>
							<td class="getal">{urenTekst(r.uren)}</td>
							<td>{r.opmerking ?? ''}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="5"><strong>{regels.length} diensten</strong></td>
						<td class="getal"><strong>{urenTekst(totaal)}</strong></td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>

		<div class="knoppen">
			<button class="groot" onclick={download}>CSV downloaden</button>
		</div>
	{/if}
</div>

<div class="blok">
	<h2>Waarom dit er zo uitziet</h2>
	<p class="detail">
		Alleen diensten met status <strong>bevestigd</strong> staan erin — dat is wat het bonnetje nu
		doet. De uren komen uit de werkelijke tijden, niet uit de geplande, zodat er bij het exporteren
		nooit gekozen hoeft te worden.
	</p>
	<p class="detail">
		Geen euro's. Minimumloon is leeftijdsafhankelijk en verandert elk halfjaar; zodra deze app
		bedragen uitrekent, is hij verantwoordelijk voor fouten in iemands salaris.
	</p>
	<p class="notitie">
		Deze kolommen zijn een gok. Fase 6 begint pas als de boekhouder heeft laten zien wat hij nu
		krijgt: welke kolomnamen, per dag of een weektotaal, CSV of Excel. Past de export niet op zijn
		werkwijze, dan typt de baas het alsnog over en heeft dit project niets opgelost.
	</p>
</div>
