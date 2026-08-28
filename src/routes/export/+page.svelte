<script lang="ts">
	import { datumKort, urenTekst } from '$lib/tijd';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let regels = $derived(data.regels ?? []);
	let totaal = $derived(regels.reduce((s, r) => s + r.uren, 0));

	// Per medewerker, want dat is wat de boekhouder overneemt. De regels
	// eronder zijn de onderbouwing als hij iets navraagt.
	let perPersoon = $derived.by(() => {
		const per = new Map<string, number>();
		for (const r of regels) per.set(r.medewerker, (per.get(r.medewerker) ?? 0) + r.uren);
		return [...per].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	});

</script>

{#if !data.beheerder}
	<div class="blok">
		<h2>Alleen voor de baas</h2>
		<p class="detail">
			De export gaat over de uren van de hele ploeg. Jouw week staat op
			<a href="/mijn-week">Mijn week</a>.
		</p>
	</div>
{:else}
	<div class="blok">
		<form method="get" class="regel invulrij">
			<label class="veld"><span>Van</span><input type="date" name="van" value={data.van} /></label>
			<label class="veld"><span>Tot en met</span><input type="date" name="tot" value={data.tot} /></label>
			<button>Tonen</button>
		</form>
		<p class="regel invulrij na-ruim">
			{#each data.snelkeuzes! as k (k.naam)}
				<a href="?van={k.van}&tot={k.tot}">{k.naam}</a>
			{/each}
		</p>
	</div>

	<div class="blok">
		{#if regels.length === 0}
			<p class="leeg">Geen bevestigde diensten in deze periode.</p>
		{:else}
			<div class="tabelrand">
				<table>
					<thead>
						<tr>
							<th>Medewerker</th>
							<th class="getal">Uren</th>
						</tr>
					</thead>
					<tbody>
						{#each perPersoon as [naam, uren] (naam)}
							<tr>
								<td>{naam}</td>
								<td class="getal">{urenTekst(uren)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>{regels.length} diensten</strong></td>
							<td class="getal"><strong>{urenTekst(totaal)}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>

			<form method="get" action="/export/bestand">
				<input type="hidden" name="van" value={data.van} />
				<input type="hidden" name="tot" value={data.tot} />
				<div class="knoppen">
					<button class="groot">CSV downloaden</button>
				</div>
			</form>
		{/if}
	</div>

	{#if regels.length > 0}
		<div class="blok">
			<details>
				<summary>Regel voor regel ({regels.length})</summary>
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
					</table>
				</div>
			</details>
		</div>
	{/if}

	<div class="blok">
		<h2>Wat hier wel en niet in staat</h2>
		<p class="detail">
			Alleen diensten met status <strong>bevestigd</strong>. Wat niemand gemeld heeft en wat de
			baas niet heeft goedgekeurd staat er dus niet in — geen melding, geen uren.
		</p>
		<p class="detail">
			De uren komen uit de werkelijke tijden en niet uit de geplande, zodat er bij het exporteren
			nooit gekozen hoeft te worden.
		</p>
		<p class="detail">
			Geen euro's. Minimumloon is leeftijdsafhankelijk en verandert elk halfjaar; zodra deze app
			bedragen uitrekent, is hij verantwoordelijk voor fouten in iemands salaris.
		</p>
		<p class="notitie">
			Deze kolommen zijn een keuze en geen wet. Ze staan op één plek in
			<code>src/lib/server/uren.ts</code> — bij het opzetten voor een bedrijf leg je ze naast de
			sheet die de boekhouder nu gebruikt en pas je ze daar aan.
		</p>
	</div>
{/if}
