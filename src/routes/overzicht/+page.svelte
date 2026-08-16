<script lang="ts">
	import type { Dienst } from '$lib/model';
	import { MAANDAG_34, NU, naamVan, postNaam } from '$lib/nepdata';
	import { bevestig, staat } from '$lib/prototype.svelte';
	import {
		achterafGemeld,
		afwijkend,
		afwijkingInMinuten,
		afwijkingTekst,
		dagKort,
		datumKort,
		duurInUren,
		plusDagen,
		urenTekst
	} from '$lib/tijd';

	const eindeWeek = plusDagen(MAANDAG_34, 6);

	let week = $derived(
		staat.diensten
			.filter((d) => d.datum >= MAANDAG_34 && d.datum <= eindeWeek)
			.sort((a, b) => a.datum.localeCompare(b.datum) || a.post_id.localeCompare(b.post_id))
	);

	/**
	 * Voorbij, maar niemand heeft er iets mee gedaan.
	 *
	 * Bewust een dag speling, en dus een andere grens dan op het
	 * bezorgerscherm: daar staat een dienst open zodra hij afgelopen is, hier
	 * pas vanaf de dag erna. Iemand die om 20:00 klaar is en het om 22:00 nog
	 * niet ingevuld heeft, is niets vergeten -- die is gewoon nog onderweg.
	 * Zou dat hier al als probleem staan, dan staat er elke avond iets in dit
	 * lijstje en kijkt de baas er binnen twee weken overheen.
	 */
	function nietGemeld(d: Dienst): boolean {
		return d.status === 'verwacht' && d.datum < NU.datum;
	}

	function redenen(d: Dienst): string[] {
		const r: string[] = [];
		if (nietGemeld(d)) r.push('niet gemeld');
		if (d.status === 'gemeld' && afwijkend(d)) r.push('afwijking');
		if (d.status === 'gemeld' && achterafGemeld(d)) r.push('achteraf');
		return r;
	}

	let aandacht = $derived(week.filter((d) => redenen(d).length > 0));
	let rechttoe = $derived(week.filter((d) => d.status === 'gemeld' && redenen(d).length === 0));
	let rest = $derived(
		week.filter((d) => redenen(d).length === 0 && d.status !== 'gemeld')
	);

	function bevestigAlleRechttoe() {
		for (const d of rechttoe) bevestig(d);
	}

	type Totaal = { naam: string; uren: number; open: number };

	let totalen = $derived.by(() => {
		const per = new Map<string, Totaal>();
		for (const d of week) {
			if (d.persoon_id === null) continue;
			const naam = naamVan(d.persoon_id);
			const t = per.get(naam) ?? { naam, uren: 0, open: 0 };
			if (d.status === 'bevestigd' && d.werkelijk_begin && d.werkelijk_eind) {
				t.uren += duurInUren(d.werkelijk_begin, d.werkelijk_eind);
			} else if (d.status === 'gemeld' || nietGemeld(d)) {
				t.open += 1;
			}
			per.set(naam, t);
		}
		return [...per.values()].sort((a, b) => b.uren - a.uren || a.naam.localeCompare(b.naam));
	});

	let totaalUren = $derived(totalen.reduce((s, t) => s + t.uren, 0));
</script>

{#snippet regel(d: Dienst)}
	<div class="regel">
		<span class="dag">{dagKort(d.datum)} {datumKort(d.datum)}</span>
		<span class="detail">{naamVan(d.persoon_id)} · {postNaam(d.post_id)}</span>
	</div>
{/snippet}

<div class="blok">
	<h2>Vraagt aandacht ({aandacht.length})</h2>

	{#if aandacht.length === 0}
		<p class="leeg">Niets. De week loopt zoals gepland.</p>
	{/if}

	{#each aandacht as d (d.id)}
		{@const verschil = afwijkingInMinuten(d)}
		<div class="kaart aandacht">
			{@render regel(d)}

			<div class="regel" style="margin-top:0.35rem">
				<span class="tijden">
					{#if nietGemeld(d)}
						<span class="detail">gepland {d.gepland_begin} – {d.gepland_eind}</span>
					{:else if afwijkend(d)}
						<span class="doorgehaald">{d.gepland_begin} – {d.gepland_eind}</span>
						&rarr;
						<strong>{d.werkelijk_begin} – {d.werkelijk_eind}</strong>
					{:else}
						{d.werkelijk_begin} – {d.werkelijk_eind}
					{/if}
				</span>
				<span>
					{#each redenen(d) as reden}
						<span class="merk {reden === 'afwijking' ? 'afwijking' : 'achteraf'}">{reden}</span>
					{/each}
				</span>
			</div>

			{#if verschil !== 0}
				<p class="detail" style="margin:0.3rem 0 0">{afwijkingTekst(verschil)}</p>
			{:else if afwijkend(d)}
				<!-- Later begonnen én later gestopt: andere tijden, zelfde uren.
				     Wel een afwijking, maar niet één die geld kost. -->
				<p class="detail" style="margin:0.3rem 0 0">andere tijden, even lang</p>
			{/if}

			{#if d.opmerking}
				<p class="detail" style="margin:0.3rem 0 0">“{d.opmerking}”</p>
			{/if}

			{#if d.status === 'gemeld'}
				<div class="knoppen">
					<button class="primair" onclick={() => bevestig(d)}>Bevestigen</button>
				</div>
			{:else}
				<p class="detail" style="margin:0.5rem 0 0">
					Niemand heeft deze avond ingevuld. Navragen, of zelf invullen op basis van het rooster —
					dat is nog een open vraag voor fase 5.
				</p>
			{/if}
		</div>
	{/each}
</div>

<div class="blok">
	<h2>Gemeld, geen afwijking ({rechttoe.length})</h2>

	{#if rechttoe.length === 0}
		<p class="leeg">Niets meer open.</p>
	{:else}
		{#each rechttoe as d (d.id)}
			<div class="kaart">
				{@render regel(d)}
				<div class="regel" style="margin-top:0.35rem">
					<span class="detail tijden">{d.werkelijk_begin} – {d.werkelijk_eind}</span>
					<span class="merk gemeld">gemeld</span>
				</div>
			</div>
		{/each}

		<div class="knoppen">
			<button class="groot" onclick={bevestigAlleRechttoe}>
				Alle {rechttoe.length} bevestigen
			</button>
		</div>
		<p class="notitie">
			Deze knop is het verschil tussen vijf minuten en een half uur. Hij is veilig: dit zijn precies
			de diensten waar niets te beoordelen valt, want ze zijn gedraaid zoals ze gepland stonden.
		</p>
	{/if}
</div>

<div class="blok">
	<details>
		<summary>De rest van de week ({rest.length})</summary>
		{#each rest as d (d.id)}
			<div class="kaart">
				{@render regel(d)}
				<div class="regel" style="margin-top:0.35rem">
					<span class="detail tijden">
						{d.werkelijk_begin ?? d.gepland_begin} – {d.werkelijk_eind ?? d.gepland_eind}
					</span>
					<span class="merk {d.status}">{d.status}</span>
				</div>
				{#if d.opmerking}
					<p class="detail" style="margin:0.3rem 0 0">“{d.opmerking}”</p>
				{/if}
			</div>
		{/each}
	</details>
</div>

<div class="blok">
	<h2>Totalen deze week</h2>
	<div class="tabelrand">
		<table>
			<thead>
				<tr>
					<th>Medewerker</th>
					<th class="getal">Bevestigd</th>
					<th class="getal">Open</th>
				</tr>
			</thead>
			<tbody>
				{#each totalen as t (t.naam)}
					<tr>
						<td>{t.naam}</td>
						<td class="getal">{t.uren > 0 ? `${urenTekst(t.uren)} uur` : '—'}</td>
						<td class="getal">{t.open > 0 ? t.open : '—'}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td><strong>Totaal</strong></td>
					<td class="getal"><strong>{urenTekst(totaalUren)} uur</strong></td>
					<td class="getal"></td>
				</tr>
			</tfoot>
		</table>
	</div>
	<p class="notitie">
		Alleen bevestigde diensten tellen mee. Wat nog open staat is geen getal maar een taak — daarom
		staat het ernaast en niet erbij opgeteld.
	</p>
</div>
