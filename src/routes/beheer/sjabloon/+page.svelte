<script lang="ts">
	import { enhance } from '$app/forms';
	import Merk from '$lib/componenten/Merk.svelte';
	import { dagKort, datumKort, weekdagNaam } from '$lib/tijd';
	import Kaart from '$lib/componenten/Kaart.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const dagen = [1, 2, 3, 4, 5, 6, 7];

	/** Geldt deze regel nu of nog? Wat afgelopen is zakt naar het archief. */
	const loopt = (r: { geldig_tot: string | null }) =>
		r.geldig_tot === null || r.geldig_tot >= data.nu.datum;

	const opDag = (weekdag: number) =>
		(data.regels ?? []).filter((r) => r.weekdag === weekdag && loopt(r));

	const afgelopen = $derived((data.regels ?? []).filter((r) => !loopt(r)));

	let toont = $state<number | null>(null);

	/**
	 * De kleur bij een regel uit het uitrolrapport.
	 *
	 * Groen is wat er bij kwam, rood is een gat dat je moet oplossen — iemand
	 * op non-actief die nog in het sjabloon staat, of iemand die die dag al
	 * ergens anders rijdt. De rest stond er gewoon al en is dus amber: geen
	 * fout, maar ook geen werk dat gedaan is.
	 */
	const kleurBij = (resultaat: string) =>
		resultaat === 'nieuw' ? 'bevestigd' : resultaat.startsWith('overgeslagen') ? 'vervallen' : 'gemeld';
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

{#if !data.beheerder}
	<div class="blok">
		<h2>Alleen voor de baas</h2>
	</div>
{:else}
	<div class="blok">
		<p class="detail">
			Het vaste weekrooster. Hier staat wie er élke maandag, elke dinsdag enzovoort rijdt — de
			maandaguitrol maakt daar de diensten van.
		</p>
		<p class="notitie">
			Wijzigingen gaan in per een datum en gooien niets weg. Zo blijft terug te zien hoe het
			rooster er in maart uitzag, ook als er sindsdien mensen bij en af zijn gegaan. De week die
			nu loopt staat er al, dus het vroegste dat je kunt sturen is maandag
			{datumKort(data.volgendeMaandag!)}.
		</p>
		<p><a href="/beheer">← Terug naar beheer</a></p>
	</div>

	<div class="blok">
		<h2>De week neerzetten</h2>
		<p class="detail">
			Het sjabloon hierboven zijn regels; diensten zijn wat er die week écht staat. Deze knop
			maakt van het eerste het tweede.
		</p>

		<div class="weken">
			<form method="post" action="?/uitrollen" use:enhance>
				<input type="hidden" name="maandag" value={data.dezeMaandag} />
				<div class="week">
					<span class="dag">Deze week</span>
					<span class="detail">
						maandag {datumKort(data.dezeMaandag!)} ·
						{#if data.dienstenDezeWeek}
							{data.dienstenDezeWeek} diensten
						{:else}
							nog niets
						{/if}
					</span>
				</div>
				<button class:primair={!data.dienstenDezeWeek}>Uitrollen</button>
			</form>

			<form method="post" action="?/uitrollen" use:enhance>
				<input type="hidden" name="maandag" value={data.volgendeMaandag} />
				<div class="week">
					<span class="dag">Volgende week</span>
					<span class="detail">
						maandag {datumKort(data.volgendeMaandag!)} ·
						{#if data.dienstenVolgendeWeek}
							{data.dienstenVolgendeWeek} diensten
						{:else}
							nog niets
						{/if}
					</span>
				</div>
				<button class:primair={!data.dienstenVolgendeWeek}>Uitrollen</button>
			</form>
		</div>

		<p class="notitie">
			Twee keer drukken kan geen kwaad: wat er al staat blijft staan, en een dienst die gemeld
			of geannuleerd is wordt niet teruggezet. Straks doet de app dit elke maandagnacht vanzelf.
		</p>

		{#if form?.gedaan === 'uitgerold'}
			<Kaart>
				<div class="regel">
					<span class="dag">
						{#if form.nieuw}
							{form.nieuw} {form.nieuw === 1 ? 'dienst' : 'diensten'} erbij
						{:else}
							Niets nieuws — stond er al
						{/if}
					</span>
					<span class="detail">week van {datumKort(form.maandag!)}</span>
				</div>

				{#each form.rapport ?? [] as r (r.datum + r.post + r.begintijd)}
					<div class="uitrolregel">
						<span>{dagKort(r.datum)} · {r.post} · {r.persoon}</span>
						<Merk soort={kleurBij(r.resultaat)} tekst={r.resultaat} />
					</div>
				{/each}
			</Kaart>
		{/if}
	</div>

	{#each dagen as d (d)}
		{@const regels = opDag(d)}
		<div class="blok">
			<h2>{weekdagNaam(d)}</h2>

			{#if regels.length === 0}
				<p class="leeg">Niemand vast ingeroosterd.</p>
			{/if}

			{#each regels as r (r.id)}
				<Kaart>
					<div class="regel">
						<span class="dag">{r.personen?.naam ?? 'onbekend'}</span>
						<span class="detail">{r.posten?.naam ?? 'onbekende post'}</span>
					</div>
					<div class="regel na-krap">
						<span class="detail tijden">
							{r.dienstsoorten?.naam}
							{r.dienstsoorten?.begintijd} – {r.dienstsoorten?.eindtijd}
						</span>
						<span>
							{#if r.geldig_vanaf > data.nu.datum}
								<Merk soort="verwacht" tekst="gaat in {datumKort(r.geldig_vanaf)}" />
							{/if}
							{#if r.geldig_tot}
								<Merk soort="afwijking" tekst="stopt {datumKort(r.geldig_tot)}" />
							{/if}
						</span>
					</div>

					{#if r.geldig_tot}
						<form method="post" action="?/hervatten" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<div class="knoppen"><button>Toch laten doorlopen</button></div>
						</form>
					{:else}
						<form method="post" action="?/stoppen" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<p class="regel invulrij na-mid">
								<label class="veld">
									<span>Stopt vanaf</span>
									<input type="date" name="vanaf" value={data.volgendeMaandag} />
								</label>
								<button>Stopzetten</button>
							</p>
						</form>
					{/if}

					{#if r.geldig_vanaf > data.nu.datum}
						<form method="post" action="?/weg" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<div class="knoppen"><button>Weghalen</button></div>
						</form>
					{/if}
				</Kaart>
			{/each}

			{#if toont === d}
				<form
					method="post"
					action="?/toevoegen"
					use:enhance={() => async ({ update }) => {
						await update();
						toont = null;
					}}
				>
					<input type="hidden" name="weekdag" value={d} />
					<p class="regel invulrij na-ruim">
						<select name="persoon_id">
							{#each data.personen! as p (p.id)}
								<option value={p.id}>{p.naam}</option>
							{/each}
						</select>
						<select name="post_id">
							{#each data.posten! as po (po.id)}
								<option value={po.id}>{po.naam}</option>
							{/each}
						</select>
						<select name="dienstsoort_id">
							{#each data.dienstsoorten! as ds (ds.id)}
								<option value={ds.id}>{ds.naam} {ds.begintijd}–{ds.eindtijd}</option>
							{/each}
						</select>
						<label class="veld">
							<span>Vanaf</span>
							<input type="date" name="geldig_vanaf" value={data.volgendeMaandag} />
						</label>
					</p>
					<div class="knoppen">
						<button type="button" onclick={() => (toont = null)}>Laat maar</button>
						<button class="primair">Toevoegen</button>
					</div>
				</form>
			{:else}
				<div class="knoppen">
					<button type="button" onclick={() => (toont = d)}>Regel erbij</button>
				</div>
			{/if}
		</div>
	{/each}

	{#if afgelopen.length > 0}
		<div class="blok">
			<details>
				<summary>Afgelopen regels ({afgelopen.length})</summary>
				{#each afgelopen as r (r.id)}
					<Kaart>
						<div class="regel">
							<span class="dag">{weekdagNaam(r.weekdag)} · {r.personen?.naam}</span>
							<span class="detail">{r.posten?.naam}</span>
						</div>
						<p class="detail na-krap">
							{datumKort(r.geldig_vanaf)} tot en met {datumKort(r.geldig_tot!)}
						</p>
					</Kaart>
				{/each}
				<p class="notitie">
					Deze staan er nog zodat je kunt terugzien hoe het rooster er toen uitzag. Ze rollen
					nergens meer uit.
				</p>
			</details>
		</div>
	{/if}
{/if}
