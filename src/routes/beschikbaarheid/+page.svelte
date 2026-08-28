<script lang="ts">
	import { enhance } from '$app/forms';
	import Merk from '$lib/componenten/Merk.svelte';
	import { datumKort, datumLang, isoWeek, plusDagen, weekdagNaam } from '$lib/tijd';
	import Kaart from '$lib/componenten/Kaart.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const dagen = [1, 2, 3, 4, 5, 6, 7];

	/** Kan ik normaal op deze weekdag? Geen rij betekent ja. */
	const normaal = (weekdag: number) =>
		data.standaard?.find((r) => r.weekdag === weekdag)?.kan ?? true;

	/** Wat staat er voor de getoonde week? undefined = volgt gewoon de standaard. */
	const afwijking = (weekdag: number) =>
		data.afwijkingen?.find((r) => r.weekdag === weekdag)?.kan;

	const kanDezeWeek = (weekdag: number) => afwijking(weekdag) ?? normaal(weekdag);
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

{#if !data.ik}
	<div class="blok">
		<h2>Nog niet gekoppeld</h2>
		<p class="detail">Deze login hangt nog niet aan een persoon in het rooster.</p>
	</div>
{:else}
	<div class="blok">
		<h2>Week {isoWeek(data.week!)}</h2>
		<p class="detail">
			{datumLang(data.week!)} – {datumLang(plusDagen(data.week!, 6))}
		</p>
		<p class="regel na-ruim">
			<a href="?week={data.dezeWeek}">Deze week</a>
			<a href="?week={data.volgendeWeek}">Volgende week</a>
			<a href="?week={data.weekErna}">De week erna</a>
		</p>

		{#if data.vergrendeld}
			<p class="notitie">
				Deze week is al begonnen, dus hij ligt vast. De baas heeft hem ingedeeld en zit er
				misschien al middenin. Kun je een dienst toch niet draaien, dan is dat een appje naar hem
				en geen vinkje hier.
			</p>
		{/if}

		{#each dagen as d (d)}
			{@const kan = kanDezeWeek(d)}
			{@const anders = afwijking(d) !== undefined}
			<Kaart>
				<div class="regel">
					<span class="dag">
						{weekdagNaam(d)}
						<span class="detail">{datumKort(plusDagen(data.week!, d - 1))}</span>
					</span>
					<span>
						{#if anders}
							<Merk soort="afwijking" tekst="alleen deze week" />
						{/if}
						<Merk soort={kan ? 'bevestigd' : 'afgemeld'} tekst={kan ? 'kan' : 'kan niet'} />
					</span>
				</div>

				{#if !data.vergrendeld}
					<div class="knoppen">
						<form method="post" action="?/week" use:enhance>
							<input type="hidden" name="week" value={data.week} />
							<input type="hidden" name="weekdag" value={d} />
							<input type="hidden" name="kan" value={kan ? 'nee' : 'ja'} />
							<button class="primair">{kan ? 'Kan niet' : 'Kan wel'} — alleen deze week</button>
						</form>

						{#if anders}
							<form method="post" action="?/voortaan" use:enhance>
								<input type="hidden" name="week" value={data.week} />
								<input type="hidden" name="weekdag" value={d} />
								<input type="hidden" name="kan" value={kan ? 'ja' : 'nee'} />
								<button>Voortaan ook zo</button>
							</form>

							<form method="post" action="?/normaal" use:enhance>
								<input type="hidden" name="week" value={data.week} />
								<input type="hidden" name="weekdag" value={d} />
								<button>Terug naar normaal</button>
							</form>
						{/if}
					</div>
				{/if}
			</Kaart>
		{/each}

		{#if !data.vergrendeld}
			<p class="notitie">
				Een keertje weg zijn wordt nooit stilzwijgend een vaste vrije dag: wat je hier zet geldt
				alleen voor deze week. Is het geen uitzondering maar je nieuwe normaal, dan is daar
				"Voortaan ook zo" voor.
			</p>
		{/if}
	</div>
	<!--
		De standaard staat onder de week, want daar kijk je het vaakst. Hij staat
		wel open en niet weggeklapt: wie alleen op zaterdag kan, zet hier zes
		dagen weg en is daarna klaar -- dat hoort niet iets te zijn wat je moet
		opzoeken.
	-->
	<div class="blok">
		<h2>Zo kan ik normaal</h2>
		<p class="detail">
			Dit vul je één keer in. Elke week begint hiermee. Wijkt één week af, dan zet je dat
			hieronder — dat geldt dan alleen voor die week.
		</p>

		{#each dagen as d (d)}
			{@const kan = normaal(d)}
			<Kaart>
				<div class="regel">
					<span class="dag">{weekdagNaam(d)}</span>
					<span>
						<Merk soort={kan ? 'bevestigd' : 'afgemeld'} tekst={kan ? 'kan' : 'kan niet'} />
					</span>
				</div>
				<form method="post" action="?/standaard" use:enhance>
					<input type="hidden" name="weekdag" value={d} />
					<input type="hidden" name="kan" value={kan ? 'nee' : 'ja'} />
					<div class="knoppen">
						<button>{kan ? 'Kan normaal niet' : 'Kan normaal wel'}</button>
					</div>
				</form>
			</Kaart>
		{/each}
	</div>

{/if}
