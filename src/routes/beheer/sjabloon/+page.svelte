<script lang="ts">
	import { enhance } from '$app/forms';
	import Merk from '$lib/componenten/Merk.svelte';
	import { datumKort, weekdagNaam } from '$lib/tijd';
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

	{#each dagen as d (d)}
		{@const regels = opDag(d)}
		<div class="blok">
			<h2>{weekdagNaam(d)}</h2>

			{#if regels.length === 0}
				<p class="leeg">Niemand vast ingeroosterd.</p>
			{/if}

			{#each regels as r (r.id)}
				<div class="kaart">
					<div class="regel">
						<span class="dag">{r.personen?.naam ?? 'onbekend'}</span>
						<span class="detail">{r.posten?.naam ?? 'onbekende post'}</span>
					</div>
					<div class="regel" style="margin-top:0.2rem">
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
							<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0 0">
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
				</div>
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
					<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
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
					<div class="kaart">
						<div class="regel">
							<span class="dag">{weekdagNaam(r.weekdag)} · {r.personen?.naam}</span>
							<span class="detail">{r.posten?.naam}</span>
						</div>
						<p class="detail" style="margin:0.2rem 0 0">
							{datumKort(r.geldig_vanaf)} tot en met {datumKort(r.geldig_tot!)}
						</p>
					</div>
				{/each}
				<p class="notitie">
					Deze staan er nog zodat je kunt terugzien hoe het rooster er toen uitzag. Ze rollen
					nergens meer uit.
				</p>
			</details>
		</div>
	{/if}
{/if}
