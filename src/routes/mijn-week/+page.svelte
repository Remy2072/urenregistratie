<script lang="ts">
	import type { Dienst } from '$lib/model';
	import DienstRegel from '$lib/componenten/DienstRegel.svelte';
	import MeldKaart from '$lib/componenten/MeldKaart.svelte';
	import Merk from '$lib/componenten/Merk.svelte';
	import { afwijkingInMinuten, afwijkingTekst, duurInUren, minuten, urenTekst } from '$lib/tijd';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const post = (d: Dienst) => data.posten[d.post_id] ?? 'onbekende post';

	/**
	 * De dienst is afgelopen en er is nog niets mee gedaan.
	 *
	 * Let op het verschil met het bazenscherm: daar telt een dienst pas de dag
	 * erna als "niet gemeld". Hier staat hij open zodra hij voorbij is, want jij
	 * bent degene die hem nu kan invullen.
	 */
	function teMelden(d: Dienst): boolean {
		if (d.status !== 'verwacht') return false;
		if (d.datum < data.nu.datum) return true;
		return d.datum === data.nu.datum && minuten(d.gepland_eind) <= minuten(data.nu.tijd);
	}

	// Openstaand mag uit de week ervoor komen -- op maandag ligt gisteren daar.
	// Vandaag bovenaan: dat is de dienst die je op dit moment komt melden.
	let openstaand = $derived(
		data.diensten.filter(teMelden).sort((a, b) => b.datum.localeCompare(a.datum))
	);

	// De rest van het scherm gaat alleen over deze week.
	let dezeWeek = $derived(data.diensten.filter((d) => d.datum >= data.maandag));
	let komtNog = $derived(dezeWeek.filter((d) => d.status === 'verwacht' && !teMelden(d)));
	let afgehandeld = $derived(dezeWeek.filter((d) => d.status !== 'verwacht'));
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

{#if !data.ik}
	<div class="blok">
		<h2>Nog niet gekoppeld</h2>
		<p class="detail">
			Je bent ingelogd, maar deze login hangt nog niet aan een persoon in het rooster. Dat is één
			regel in de database — vraag of <code>auth_user_id</code> bij je naam gezet wordt.
		</p>
	</div>
{:else}
	{#if openstaand.length > 0}
		<div class="blok">
			<h2>{openstaand.length === 1 ? 'Nog invullen' : `Nog invullen (${openstaand.length})`}</h2>

			{#each openstaand as d (d.id)}
				<MeldKaart dienst={d} post={post(d)} achteraf={d.datum < data.nu.datum} />
			{/each}

			<p class="notitie">
				Tijden gaan per half uur. Klaar om 21:20 meld je als 21:30, om 21:10 als 21:00 — het
				dichtstbijzijnde half uur, met de knip op kwart over en kwart voor.
			</p>

			{#if openstaand.some((d) => d.datum < data.nu.datum)}
				<p class="notitie">
					Een dienst van gisteren kun je gewoon nu nog invullen. De baas ziet erbij staan dat het
					achteraf was.
				</p>
			{/if}
		</div>
	{/if}

	{#if komtNog.length > 0}
		<div class="blok">
			<h2>Komt nog</h2>
			{#each komtNog as d (d.id)}
				<div class="kaart">
					<DienstRegel dienst={d} post={post(d)} />
					<div class="regel">
						<span class="detail tijden">{d.gepland_begin} – {d.gepland_eind}</span>
						<Merk soort="verwacht" />
					</div>
				</div>
			{/each}
			<p class="notitie">
				Kun je niet? Dat gaat via de baas, niet hier — hij verzet de dienst en dan staat hij bij je
				collega in het scherm. Zo blijft er één plek waar staat wie er die avond echt gereden heeft.
			</p>
		</div>
	{/if}

	{#if afgehandeld.length > 0}
		<div class="blok">
			<h2>Gedaan</h2>
			{#each afgehandeld as d (d.id)}
				{@const verschil = afwijkingInMinuten(d)}
				<div class="kaart">
					<DienstRegel dienst={d} post={post(d)} />
					<div class="regel">
						<span class="detail tijden">
							{#if d.werkelijk_begin && d.werkelijk_eind}
								{d.werkelijk_begin} – {d.werkelijk_eind}
								· {urenTekst(duurInUren(d.werkelijk_begin, d.werkelijk_eind))} uur
							{:else}
								{d.gepland_begin} – {d.gepland_eind}
							{/if}
						</span>
						<span>
							{#if verschil !== 0}
								<Merk soort="afwijking" tekst={afwijkingTekst(verschil)} />
							{/if}
							<Merk soort={d.status} />
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if dezeWeek.length === 0 && openstaand.length === 0}
		<div class="blok">
			<p class="leeg">Je staat deze week niet ingeroosterd.</p>
		</div>
	{/if}
{/if}
