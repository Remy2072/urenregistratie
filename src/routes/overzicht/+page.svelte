<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Dienst } from '$lib/model';
	import Merk from '$lib/componenten/Merk.svelte';
	import {
		achterafGemeld,
		afwijkend,
		afwijkingInMinuten,
		afwijkingTekst,
		dagKort,
		datumKort,
		datumLang,
		duurInUren,
		isoWeek,
		urenTekst
	} from '$lib/tijd';
	import Kaart from '$lib/componenten/Kaart.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const naam = (id: string | null) =>
		data.personen?.find((p) => p.id === id)?.naam ?? 'niemand';
	const post = (d: Dienst) => data.posten?.[d.post_id] ?? 'onbekende post';

	/**
	 * Voorbij, maar niemand heeft er iets mee gedaan.
	 *
	 * Bewust een dag speling, en dus een andere grens dan op het bezorgerscherm:
	 * daar staat een dienst open zodra hij afgelopen is, hier pas vanaf de dag
	 * erna. Iemand die om 20:00 klaar is en het om 22:00 nog niet ingevuld
	 * heeft, is niets vergeten -- die is gewoon nog onderweg. Zou dat hier al
	 * als probleem staan, dan staat er elke avond iets in dit lijstje en kijkt
	 * de baas er binnen twee weken overheen.
	 */
	function nietGemeld(d: Dienst): boolean {
		return d.status === 'verwacht' && d.datum < data.nu.datum;
	}

	function redenen(d: Dienst): string[] {
		const r: string[] = [];
		if (nietGemeld(d)) r.push('niet gemeld');
		if (d.status === 'gemeld' && afwijkend(d)) r.push('afwijking');
		if (d.status === 'gemeld' && achterafGemeld(d)) r.push('achteraf');
		return r;
	}

	let week = $derived(data.diensten ?? []);
	let aandacht = $derived(week.filter((d) => redenen(d).length > 0));
	let rechttoe = $derived(week.filter((d) => d.status === 'gemeld' && redenen(d).length === 0));
	let rest = $derived(week.filter((d) => redenen(d).length === 0 && d.status !== 'gemeld'));

	/** Welke dienst je op dit moment aan het ruilen bent. */
	let ruilt = $state<string | null>(null);

	type Totaal = { naam: string; uren: number; open: number };

	let totalen = $derived.by(() => {
		const per = new Map<string, Totaal>();
		for (const d of week) {
			if (d.persoon_id === null) continue;
			const n = naam(d.persoon_id);
			const t = per.get(n) ?? { naam: n, uren: 0, open: 0 };
			if (d.status === 'bevestigd' && d.werkelijk_begin && d.werkelijk_eind) {
				t.uren += duurInUren(d.werkelijk_begin, d.werkelijk_eind);
			} else if (d.status === 'gemeld' || nietGemeld(d)) {
				t.open += 1;
			}
			per.set(n, t);
		}
		return [...per.values()].sort((a, b) => b.uren - a.uren || a.naam.localeCompare(b.naam));
	});

	let totaalUren = $derived(totalen.reduce((s, t) => s + t.uren, 0));
</script>

{#snippet regel(d: Dienst)}
	<div class="regel">
		<span class="dag">{dagKort(d.datum)} {datumKort(d.datum)}</span>
		<span class="detail">{naam(d.persoon_id)} · {post(d)}</span>
	</div>
{/snippet}

{#snippet ruilknop(d: Dienst)}
	{#if ruilt === d.id}
		<form
			method="post"
			action="?/ruil"
			use:enhance={() => async ({ update }) => {
				await update();
				ruilt = null;
			}}
		>
			<input type="hidden" name="id" value={d.id} />
			{#if d.status === 'gemeld' || d.status === 'bevestigd'}
				<p class="notitie na-mid">
					Deze is al ingevuld door {naam(d.persoon_id)}. Verzetten betekent dat de verkeerde
					persoon hem gemeld heeft, dus gaan de uren eraf en meldt de nieuwe hem zelf.
				</p>
			{/if}
			<p class="regel invulrij na-mid">
				<select name="persoon_id">
					{#each (data.personen ?? []).filter((p) => p.actief) as p (p.id)}
						<option value={p.id} selected={p.id === d.persoon_id}>{p.naam}</option>
					{/each}
				</select>
			</p>
			<div class="knoppen">
				<button type="button" onclick={() => (ruilt = null)}>Laat maar</button>
				<button class="primair">Verzetten</button>
			</div>
		</form>
	{:else}
		<button type="button" onclick={() => (ruilt = d.id)}>Iemand anders</button>
	{/if}
{/snippet}

{#if !data.beheerder}
	<div class="blok">
		<h2>Alleen voor de baas</h2>
		<p class="detail">
			Dit scherm is voor wie diensten bevestigt. Jouw week staat op
			<a href="/mijn-week">Mijn week</a>.
		</p>
	</div>
{:else}

	{#if (data.verzoeken ?? []).length > 0}
		<!-- Alleen kijken. Ruilen doen de bezorgers zelf; dit staat er zodat je
		     niet verrast wordt door een andere naam op een bus. -->
		<div class="blok">
			<h2>Ruilverzoeken die openstaan</h2>
			{#each data.verzoeken as r (r.id)}
				<Kaart>
					<div class="regel">
						<span class="dag">{dagKort(r.datum)} {datumKort(r.datum)}</span>
						<span class="detail tijden">{r.gepland_begin} – {r.gepland_eind}</span>
					</div>
					<p class="detail na-klein">
						{r.van_naam} · {r.post} ·
						{#if r.open_verzoek}open in de groep{:else}gevraagd aan {r.naar_naam}{/if}
					</p>
				</Kaart>
			{/each}
			<p class="notitie">
				Je hoeft hier niets te doen: wie ja zegt, krijgt de dienst en het rooster gaat mee. Zodra
				dat gebeurd is staat de nieuwe naam gewoon in het weekoverzicht.
			</p>
		</div>
	{/if}
	{#if form?.fout}
		<p class="fout">{form.fout}</p>
	{/if}

	<div class="blok">
		<div class="regel">
			<span class="dag">Week {isoWeek(data.maandag)}</span>
			<span class="detail">{datumLang(data.maandag)} – {datumLang(data.zondag!)}</span>
		</div>
		<p class="regel na-ruim">
			<a href="?week={data.vorige}">← Vorige week</a>
			<a href="?week={data.volgende}">Volgende week →</a>
		</p>
	</div>

	{#if (data.ouder ?? []).length > 0}
		<div class="blok">
			<h2>Blijft openstaan ({data.ouder!.length})</h2>
			{#each data.ouder! as d (d.id)}
				<Kaart soort="aandacht">
					{@render regel(d)}
					<div class="regel na-klein">
						<span class="detail tijden">gepland {d.gepland_begin} – {d.gepland_eind}</span>
						<Merk soort="achteraf" tekst="niet gemeld" />
					</div>
					{@render ruilknop(d)}
				</Kaart>
			{/each}
			<p class="notitie">
				Van vóór deze week en nog steeds niet ingevuld. Niemand vult dit namens hem in — dat is de
				afspraak — dus blijft hij hier staan tot hij het zelf doet. Zonder melding geen uren, en
				dus ook niets in de export.
			</p>
		</div>
	{/if}

	<div class="blok">
		<h2>Vraagt aandacht ({aandacht.length})</h2>

		{#if aandacht.length === 0}
			<p class="leeg">Niets. De week loopt zoals gepland.</p>
		{/if}

		{#each aandacht as d (d.id)}
			{@const verschil = afwijkingInMinuten(d)}
			<Kaart soort="aandacht">
				{@render regel(d)}

				<div class="regel na-klein">
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
						{#each redenen(d) as reden (reden)}
							<Merk soort={reden === 'afwijking' ? 'afwijking' : 'achteraf'} tekst={reden} />
						{/each}
					</span>
				</div>

				{#if verschil !== 0}
					<p class="detail na-klein">{afwijkingTekst(verschil)}</p>
				{:else if afwijkend(d)}
					<!-- Later begonnen én later gestopt: andere tijden, zelfde uren.
					     Wel een afwijking, maar niet één die geld kost. -->
					<p class="detail na-klein">andere tijden, even lang</p>
				{/if}

				{#if d.opmerking}
					<p class="detail na-klein">“{d.opmerking}”</p>
				{/if}

				{#if d.status === 'gemeld'}
					<form method="post" action="?/bevestig" use:enhance>
						<input type="hidden" name="id" value={d.id} />
						<div class="knoppen">
							<button class="primair">Bevestigen</button>
						</div>
					</form>
					{@render ruilknop(d)}
				{:else}
					<p class="detail na-mid">
						Niemand heeft deze avond ingevuld. Appen als dat zin heeft — invullen doet hij zelf.
					</p>
					{@render ruilknop(d)}
				{/if}
			</Kaart>
		{/each}
	</div>

	<div class="blok">
		<h2>Gemeld, geen afwijking ({rechttoe.length})</h2>

		{#if rechttoe.length === 0}
			<p class="leeg">Niets meer open.</p>
		{:else}
			{#each rechttoe as d (d.id)}
				<Kaart>
					{@render regel(d)}
					<div class="regel na-klein">
						<span class="detail tijden">{d.werkelijk_begin} – {d.werkelijk_eind}</span>
						<Merk soort="gemeld" />
					</div>
					{@render ruilknop(d)}
				</Kaart>
			{/each}

			<form method="post" action="?/bevestigAlle" use:enhance>
				<input type="hidden" name="week" value={data.maandag} />
				<div class="knoppen">
					<button class="groot">Alle {rechttoe.length} bevestigen</button>
				</div>
			</form>
			<p class="notitie">
				Deze knop is het verschil tussen vijf minuten en een half uur. Hij is veilig: dit zijn
				precies de diensten waar niets te beoordelen valt, want ze zijn gedraaid zoals ze gepland
				stonden. Welke dat zijn bepaalt de server, niet dit scherm.
			</p>
		{/if}
	</div>

	<div class="blok">
		<details>
			<summary>De rest van de week ({rest.length})</summary>
			{#each rest as d (d.id)}
				<Kaart>
					{@render regel(d)}
					<div class="regel na-klein">
						<span class="detail tijden">
							{d.werkelijk_begin ?? d.gepland_begin} – {d.werkelijk_eind ?? d.gepland_eind}
						</span>
						<Merk soort={d.status} />
					</div>
					{#if d.opmerking}
						<p class="detail na-klein">“{d.opmerking}”</p>
					{/if}
					{#if d.status === 'verwacht' || d.status === 'bevestigd'}
						{@render ruilknop(d)}
					{/if}
				</Kaart>
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
			Alleen bevestigde diensten tellen mee. Wat nog open staat is geen getal maar een taak —
			daarom staat het ernaast en niet erbij opgeteld.
		</p>
	</div>
{/if}
