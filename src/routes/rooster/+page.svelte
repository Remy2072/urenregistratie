<script lang="ts">
	import { enhance } from '$app/forms';
	import Merk from '$lib/componenten/Merk.svelte';
	import { dagNaam, datumKort, datumLang, isoWeek, plusDagen, weekdagNaam } from '$lib/tijd';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const dagen = $derived(Array.from({ length: 7 }, (_, i) => plusDagen(data.week, i)));
	const opDag = (datum: string) => data.regels.filter((r) => r.datum === datum);
	const weekdagVan = (datum: string) => dagen.indexOf(datum) + 1;

	/** Wie kan er die dag niet? Alleen de baas krijgt dit binnen. */
	const kanNiet = (datum: string) =>
		data.beschikbaar.filter((b) => b.weekdag === weekdagVan(datum) && !b.kan);

	const kanNietVandaag = (datum: string, persoonId: string) =>
		kanNiet(datum).some((b) => b.persoon_id === persoonId);

	/** Wie staat die dag nog nergens op? Twee diensten op één dag mag niet. */
	function vrij(datum: string) {
		const bezet = new Set(opDag(datum).map((r) => r.persoon_id));
		return data.personen.filter((p) => p.actief && !bezet.has(p.id));
	}

	/**
	 * Welke bus of scooter is die dag nog vrij?
	 *
	 * Eén post per dag, ook al staat de database twee diensten op dezelfde bus
	 * toe zolang ze niet op hetzelfde tijdstip beginnen. Dat is hier een
	 * afspraak en geen constraint: kan er ooit toch een bus twee keer uit, dan
	 * is dat een keuze in dit scherm en geen migratie.
	 */
	function vrijePosten(datum: string) {
		const bezet = new Set(opDag(datum).map((r) => r.post_id));
		return data.posten.filter((po) => !bezet.has(po.id));
	}

	/** Welke dienstsoort hoort bij deze tijden? Leeg als hij handmatig is aangepast. */
	const soortVan = (begin: string, eind: string) =>
		data.dienstsoorten.find((ds) => ds.begintijd === begin && ds.eindtijd === eind)?.id ?? '';

	/** Welke dienst staat open om te wijzigen. */
	let opent = $state<string | null>(null);

	// ── Naar de groepsapp ────────────────────────────────────────────────
	//
	// Dit is de knop die deze hele fase verantwoordt. Het rooster ontstaat in
	// de app, maar het wordt gelezen waar het altijd gelezen werd. Zonder deze
	// knop staat het rooster op twee plekken, en dan wint de groepsapp.
	function bericht(): string {
		const uit = [`*Rooster week ${isoWeek(data.week)}*`, ''];
		for (const datum of dagen) {
			const diensten = opDag(datum);
			if (diensten.length === 0) continue;
			uit.push(`*${dagNaam(datum)} ${datumKort(datum)}*`);
			for (const r of diensten) {
				uit.push(
					`${r.post} · ${r.persoon ?? 'nog niemand'} · ${r.gepland_begin}–${r.gepland_eind}`
				);
			}
			uit.push('');
		}
		return uit.join('\n').trim();
	}

	let gekopieerd = $state(false);
	let uitwijken = $state(false);

	async function kopieer() {
		try {
			await navigator.clipboard.writeText(bericht());
			gekopieerd = true;
			setTimeout(() => (gekopieerd = false), 2500);
		} catch {
			// Zonder https of zonder toestemming werkt het klembord niet. Dan maar
			// zelf selecteren -- beter dan een knop die niets doet.
			uitwijken = true;
		}
	}
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

<div class="blok">
	<div class="regel">
		<span class="dag">Week {isoWeek(data.week)}</span>
		<span class="detail">{datumLang(data.week)} – {datumLang(data.zondag)}</span>
	</div>
	<p class="regel" style="margin:0.6rem 0 0">
		<a href="?week={data.vorige}">← Vorige week</a>
		{#if data.week !== data.dezeWeek}
			<a href="?week={data.dezeWeek}">Deze week</a>
		{/if}
		<a href="?week={data.volgende}">Volgende week →</a>
	</p>
</div>

{#each dagen as datum (datum)}
	{@const diensten = opDag(datum)}
	<div class="blok">
		<h2>{dagNaam(datum)} {datumKort(datum)}</h2>

		{#if diensten.length === 0}
			<p class="leeg">Niemand ingeroosterd.</p>
		{/if}

		{#each diensten as r (r.id)}
			<div class="kaart">
				<div class="regel">
					<span class="dag">{r.persoon ?? 'nog niemand'}</span>
					<span class="detail">{r.post}</span>
				</div>
				<div class="regel" style="margin-top:0.2rem">
					<span class="detail tijden">{r.gepland_begin} – {r.gepland_eind}</span>
					{#if r.status !== 'verwacht'}
						<Merk soort={r.status} />
					{/if}
				</div>

				{#if data.beheerder}
					{#if opent === r.id}
						<form
							method="post"
							action="?/wijzig"
							use:enhance={() => async ({ update }) => {
								await update();
								opent = null;
							}}
						>
							<input type="hidden" name="id" value={r.id} />
							<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin:0.6rem 0 0">
								<select name="persoon_id">
									{#each data.personen.filter((p) => p.actief) as p (p.id)}
										<option value={p.id} selected={p.id === r.persoon_id}>
											{p.naam}{kanNietVandaag(datum, p.id) ? ' — kan niet' : ''}
										</option>
									{/each}
								</select>
								<select name="post_id">
									{#each data.posten.filter((po) => po.id === r.post_id || vrijePosten(datum).some((v) => v.id === po.id)) as po (po.id)}
										<option value={po.id} selected={po.id === r.post_id}>{po.naam}</option>
									{/each}
								</select>
								<select name="dienstsoort_id">
									{#if soortVan(r.gepland_begin, r.gepland_eind) === ''}
										<option value="">{r.gepland_begin}–{r.gepland_eind} (eigen tijden)</option>
									{/if}
									{#each data.dienstsoorten as ds (ds.id)}
										<option
											value={ds.id}
											selected={ds.id === soortVan(r.gepland_begin, r.gepland_eind)}
										>
											{ds.naam} {ds.begintijd}–{ds.eindtijd}
										</option>
									{/each}
								</select>
							</p>
							<div class="knoppen">
								<button type="button" onclick={() => (opent = null)}>Laat maar</button>
								<button class="primair">Opslaan</button>
							</div>
						</form>

						<form method="post" action="?/vervallen" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<div class="knoppen">
								<button>Deze rit gaat niet door</button>
							</div>
						</form>
					{:else}
						<div class="knoppen">
							<button type="button" onclick={() => (opent = r.id)}>Wijzigen</button>
						</div>
					{/if}
				{/if}
			</div>
		{/each}

		{#if data.beheerder}
			{@const weg = kanNiet(datum)}
			{#if weg.length > 0}
				<p class="detail">
					Kan niet:
					{#each weg as b, i (b.persoon_id)}{i > 0 ? ', ' : ''}{b.naam}{b.afwijking
							? ' (deze week)'
							: ''}{/each}
				</p>
			{/if}

			{@const posten = vrijePosten(datum)}
			{@const mensen = vrij(datum)}
			{#if posten.length > 0 && mensen.length > 0}
				<details>
					<summary>Dienst erbij</summary>
					<form method="post" action="?/toevoegen" use:enhance>
						<input type="hidden" name="datum" value={datum} />
						<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin:0.6rem 0 0">
							<select name="post_id">
								{#each posten as po (po.id)}
									<option value={po.id}>{po.naam}</option>
								{/each}
							</select>
							<select name="dienstsoort_id">
								{#each data.dienstsoorten as ds (ds.id)}
									<option value={ds.id}>{ds.naam} {ds.begintijd}–{ds.eindtijd}</option>
								{/each}
							</select>
							<select name="persoon_id">
								{#each mensen as p (p.id)}
									<option value={p.id}>
										{p.naam}{kanNietVandaag(datum, p.id) ? ' — kan niet' : ''}
									</option>
								{/each}
							</select>
						</p>
						<div class="knoppen">
							<button class="primair">Toevoegen</button>
						</div>
					</form>
					<p class="notitie">
						Alleen bussen die die dag nog vrij zijn, en alleen mensen die nog nergens staan. Wat je
						hier toevoegt komt niet uit het sjabloon en staat als <code>handmatig</code> in de
						database — zo zie je later terug dat het een besluit was en geen uitrol.
					</p>
				</details>
			{/if}
		{/if}
	</div>
{/each}

<div class="blok">
	<div class="knoppen">
		<button class="groot primair" type="button" onclick={kopieer}>
			{gekopieerd ? 'Gekopieerd' : 'Kopieer voor de groepsapp'}
		</button>
	</div>
	{#if uitwijken}
		<p class="detail" style="margin-top:0.6rem">
			Kopiëren mocht niet van de browser. Selecteer het hier zelf:
		</p>
		<textarea readonly rows="12" style="width:100%">{bericht()}</textarea>
	{/if}
	<p class="notitie">
		Het rooster staat hier, maar wordt gelezen waar het altijd gelezen werd. Deze knop maakt het
		bericht; jij plakt het in de groep.
	</p>
</div>

{#if data.beheerder && data.beschikbaar.length > 0}
	<div class="blok">
		<details>
			<summary>Wie kan wanneer</summary>
			<div class="tabelrand">
				<table>
					<thead>
						<tr>
							<th></th>
							{#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
								<th class="getal">{weekdagNaam(d).slice(0, 2)}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each [...new Set(data.beschikbaar.map((b) => b.naam))] as naam (naam)}
							<tr>
								<td>{naam}</td>
								{#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
									{@const b = data.beschikbaar.find((x) => x.naam === naam && x.weekdag === d)}
									<td class="getal">{b?.kan === false ? '—' : '·'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="notitie">Een streepje is "kan niet". Niets ingevuld betekent gewoon beschikbaar.</p>
		</details>
	</div>
{/if}
