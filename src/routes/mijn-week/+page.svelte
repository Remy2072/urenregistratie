<script lang="ts">
	import type { Dienst } from '$lib/model';
	import { MAANDAG_34, NU, personen, postNaam } from '$lib/nepdata';
	import { meld, staat } from '$lib/prototype.svelte';
	import {
		afwijkingInMinuten,
		afwijkingTekst,
		dagNaam,
		datumKort,
		duurInUren,
		minuten,
		plusDagen,
		urenTekst,
		verschuif
	} from '$lib/tijd';

	const eindeWeek = plusDagen(MAANDAG_34, 6);

	let mijnWeek = $derived(
		staat.diensten
			.filter((d) => d.persoon_id === staat.ikId && d.datum >= MAANDAG_34 && d.datum <= eindeWeek)
			.sort((a, b) => a.datum.localeCompare(b.datum))
	);

	/** De dienst is voorbij maar er is nog niets mee gedaan. */
	function teMelden(d: Dienst): boolean {
		if (d.status !== 'verwacht') return false;
		if (d.datum < NU.datum) return true;
		return d.datum === NU.datum && minuten(d.gepland_eind) <= minuten(NU.tijd);
	}

	let openstaand = $derived(mijnWeek.filter(teMelden));
	let komtNog = $derived(mijnWeek.filter((d) => d.status === 'verwacht' && !teMelden(d)));
	let afgehandeld = $derived(mijnWeek.filter((d) => d.status !== 'verwacht'));

	/** Per dienst hoeveel minuten begin en eind zijn bijgesteld. Reset bij melden. */
	type Bijstelling = { begin: number; eind: number };
	let bijstelling = $state<Record<string, Bijstelling>>({});

	function tijden(d: Dienst) {
		const b = bijstelling[d.id] ?? { begin: 0, eind: 0 };
		return {
			begin: verschuif(d.gepland_begin, b.begin),
			eind: verschuif(d.gepland_eind, b.eind)
		};
	}

	function stel(d: Dienst, veld: 'begin' | 'eind', delta: number) {
		const huidig = bijstelling[d.id] ?? { begin: 0, eind: 0 };
		const nieuw = { ...huidig, [veld]: huidig[veld] + delta };
		const begin = minuten(d.gepland_begin) + nieuw.begin;
		const eind = minuten(d.gepland_eind) + nieuw.eind;

		// Dezelfde grenzen als het schema: eind na begin, en alles binnen één
		// kalenderdag. Zie dienst_werkelijk_klopt in schema.sql.
		if (begin < 0 || eind > 23 * 60 + 30) return;
		if (eind - begin < 30) return;

		bijstelling[d.id] = nieuw;
	}

	function melden(d: Dienst) {
		const t = tijden(d);
		meld(d, t.begin, t.eind);
		delete bijstelling[d.id];
	}

	const ik = $derived(personen.find((p) => p.id === staat.ikId));
	const bezorgers = personen.filter((p) => p.rol === 'medewerker');
</script>

{#snippet kop(d: Dienst)}
	<div class="regel">
		<span class="dag">{dagNaam(d.datum)} {datumKort(d.datum)}</span>
		<span class="detail">{postNaam(d.post_id)}</span>
	</div>
{/snippet}

{#if openstaand.length > 0}
	<div class="blok">
		<h2>{openstaand.length === 1 ? 'Nog invullen' : `Nog invullen (${openstaand.length})`}</h2>

		{#each openstaand as d (d.id)}
			{@const t = tijden(d)}
			{@const gewijzigd = t.begin !== d.gepland_begin || t.eind !== d.gepland_eind}
			{@const verschil =
				minuten(t.eind) - minuten(t.begin) - (minuten(d.gepland_eind) - minuten(d.gepland_begin))}
			<div class="kaart nu">
				{@render kop(d)}
				<p class="detail" style="margin:0.2rem 0 0">
					Gepland <span class="tijden">{d.gepland_begin} – {d.gepland_eind}</span>
					{#if d.datum < NU.datum}
						· <span class="merk achteraf">achteraf</span>
					{/if}
				</p>

				<p class="uitkomst">
					<span class="tijden">{t.begin} – {t.eind}</span>
					{#if verschil !== 0}
						<span class="merk afwijking">{afwijkingTekst(verschil)}</span>
					{/if}
				</p>

				<div class="stelrij">
					<span class="stellabel">Begin</span>
					<button onclick={() => stel(d, 'begin', -30)}>−30</button>
					<button onclick={() => stel(d, 'begin', 30)}>+30</button>
				</div>
				<div class="stelrij">
					<span class="stellabel">Einde</span>
					<button onclick={() => stel(d, 'eind', -30)}>−30</button>
					<button onclick={() => stel(d, 'eind', 30)}>+30</button>
					<button onclick={() => stel(d, 'eind', 60)}>+60</button>
				</div>

				<div class="knoppen">
					<button class="groot primair" onclick={() => melden(d)}>
						{gewijzigd ? `Melden ${t.begin} – ${t.eind}` : 'Gedraaid'}
					</button>
				</div>
			</div>
		{/each}

		{#if openstaand.some((d) => d.datum < NU.datum)}
			<p class="notitie">
				Die van maandag was je vergeten. Geen ritje terug en geen collega bellen: je vult hem nu
				alsnog in. De baas ziet erbij staan dat het achteraf was.
			</p>
		{/if}
	</div>
{/if}

{#if komtNog.length > 0}
	<div class="blok">
		<h2>Komt nog</h2>
		{#each komtNog as d (d.id)}
			<div class="kaart">
				{@render kop(d)}
				<div class="regel">
					<span class="detail tijden">{d.gepland_begin} – {d.gepland_eind}</span>
					<span class="merk verwacht">verwacht</span>
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
				{@render kop(d)}
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
							<span class="merk afwijking">{afwijkingTekst(verschil)}</span>
						{/if}
						<span class="merk {d.status}">{d.status}</span>
					</span>
				</div>
			</div>
		{/each}
	</div>
{/if}

<div class="blok">
	<h2>Prototype</h2>
	<p class="detail">
		Je kijkt nu als <strong>{ik?.naam}</strong>. In fase 2 komt dit uit je login; hier is het een
		keuzelijst zodat je kunt laten zien dat iedereen alleen zijn eigen week ziet.
	</p>
	<p>
		<select bind:value={staat.ikId}>
			{#each bezorgers as p (p.id)}
				<option value={p.id}>{p.naam}</option>
			{/each}
		</select>
	</p>
	{#if mijnWeek.length === 0}
		<p class="leeg">{ik?.naam} staat deze week niet ingeroosterd.</p>
	{/if}
</div>
