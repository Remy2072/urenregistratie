<script lang="ts">
	import { deserialize } from '$app/forms';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { Dienst } from '$lib/model';
	import DienstRegel from '$lib/componenten/DienstRegel.svelte';
	import MeldKaart from '$lib/componenten/MeldKaart.svelte';
	import Merk from '$lib/componenten/Merk.svelte';
	import { afwijkingInMinuten, afwijkingTekst, dagNaam, datumKort, duurInUren, minuten, urenTekst } from '$lib/tijd';
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

	// ── Ruilen ────────────────────────────────────────────────────────
	//
	// Bij welke dienst je aan het ruilen bent, en wie er die dag kan. Die lijst
	// wordt pas opgehaald als je op de knop tikt: hij komt uit een functie in de
	// database en je hebt hem bij hoogstens één dienst nodig.
	let ruilt = $state<string | null>(null);
	let kandidaten = $state<{ persoon_id: string; naam: string; kan: boolean; bezet: boolean }[]>([]);
	let ruilBezig = $state(false);
	let ruilFout = $state<string | null>(null);
	let gekopieerd = $state<string | null>(null);

	/**
	 * De link naar een verzoek, afgeleid uit het verzoek zelf.
	 *
	 * Eerst hield ik hem in een variabele na het aanmaken, en toen verdween hij
	 * zodra het scherm zich verversde -- het verzoek bestond dan, dus de kaart
	 * sprong naar de andere tak. Zo staat hij er ook nog als je de app morgen
	 * opnieuw opent en hem nog eens in de groep wil zetten.
	 */
	const ruilLink = (id: string) => `${page.url.origin}/ruil/${id}`;

	async function beginRuil(dienstId: string) {
		ruilt = dienstId;
		kandidaten = [];
		ruilFout = null;
		ruilBezig = true;

		const body = new FormData();
		body.set('dienst_id', dienstId);
		const uitkomst = await stuur('?/kandidaten', body);
		if (uitkomst.type === 'success') kandidaten = uitkomst.data?.kandidaten ?? [];
		else ruilFout = uitkomst.data?.fout ?? 'De lijst met collega\'s kwam niet door.';
		ruilBezig = false;
	}

	async function vraag(dienstId: string, datum: string, naar: string) {
		ruilBezig = true;
		ruilFout = null;

		const body = new FormData();
		body.set('dienst_id', dienstId);
		body.set('datum', datum);
		body.set('naar', naar);

		const uitkomst = await stuur('?/ruilVragen', body);
		if (uitkomst.type === 'success') {
			// Het verzoek bestaat nu, dus het scherm laat het zelf zien -- met de
			// link erbij als het een open verzoek is.
			ruilt = null;
			await invalidateAll();
		} else {
			ruilFout = uitkomst.data?.fout ?? 'Dat lukte niet.';
		}
		ruilBezig = false;
	}

	async function kopieer(id: string) {
		try {
			await navigator.clipboard.writeText(ruilLink(id));
			gekopieerd = id;
			setTimeout(() => (gekopieerd = null), 2500);
		} catch {
			gekopieerd = null; // dan staat de link eronder om zelf te selecteren
		}
	}

	async function stuur(actie: string, body: FormData) {
		const antwoord = await fetch(actie, { method: 'POST', body });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return deserialize(await antwoord.text()) as any;
	}

	// Wat er per dienst en in het algemeen openstaat.
	let mijnVerzoeken = $derived((data.verzoeken ?? []).filter((r) => r.van_mij && r.status === 'open'));
	let voorMij = $derived((data.verzoeken ?? []).filter((r) => r.voor_mij && r.status === 'open'));
	let openVanAnderen = $derived(
		(data.verzoeken ?? []).filter((r) => r.open_verzoek && r.status === 'open' && !r.van_mij)
	);
	const verzoekVan = (dienstId: string) => mijnVerzoeken.find((r) => r.dienst_id === dienstId);

	// Welke gemelde dienst je op dit moment aan het corrigeren bent. Alleen
	// 'gemeld' mag nog; zodra de baas hem bevestigd heeft is het zijn oordeel
	// en niet meer jouw invoer. De database houdt dat ook zo tegen.
	let corrigeert = $state<string | null>(null);
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}
{#if form?.let_op}
	<p class="notitie">{form.let_op}</p>
{/if}
{#if page.url.searchParams.has('overgenomen')}
	<p class="notitie">Je hebt die dienst overgenomen. Hij staat hieronder bij "Komt nog".</p>
{/if}

{#if voorMij.length > 0}
	<!-- Wat een collega jóu vraagt staat bovenaan: dit is het enige op dit
	     scherm waar iemand anders op wacht. -->
	<div class="blok">
		<h2>{voorMij.length === 1 ? 'Een collega vraagt je iets' : 'Collega\'s vragen je iets'}</h2>
		{#each voorMij as r (r.id)}
			<div class="kaart aandacht">
				<div class="regel">
					<span class="dag">{dagNaam(r.datum)} {datumKort(r.datum)}</span>
					<span class="detail tijden">{r.gepland_begin} – {r.gepland_eind}</span>
				</div>
				<p class="detail" style="margin:0.3rem 0 0">
					{r.van_naam} vraagt of jij {r.post} overneemt.
				</p>
				<div class="knoppen"><a href="/ruil/{r.id}">Bekijken →</a></div>
			</div>
		{/each}
	</div>
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
				{@const verzoek = verzoekVan(d.id)}
				<div class="kaart">
					<DienstRegel dienst={d} post={post(d)} />
					<div class="regel">
						<span class="detail tijden">{d.gepland_begin} – {d.gepland_eind}</span>
						<Merk soort="verwacht" />
					</div>

					{#if verzoek}
						<!-- Er staat een verzoek open voor deze dienst. Dat moet hier staan:
						     anders denkt iemand dat hij ervan af is. -->
						{#if verzoek.open_verzoek}
							<p class="detail" style="margin:0.4rem 0 0">
								Open verzoek — zet deze link in de groepsapp. Wie het eerst ja zegt, krijgt de
								dienst.
							</p>
							<div class="knoppen">
								<button type="button" class="primair" onclick={() => kopieer(verzoek.id)}>
									{gekopieerd === verzoek.id ? 'Gekopieerd' : 'Kopieer de link'}
								</button>
							</div>
						{:else}
							<p class="detail" style="margin:0.4rem 0 0">
								Gevraagd aan {verzoek.naar_naam} — nog geen antwoord.
							</p>
						{/if}
						<p class="notitie">Zolang niemand ja zegt, blijft deze dienst van jou.</p>
						<form method="post" action="?/ruilIntrekken" use:enhance>
							<input type="hidden" name="id" value={verzoek.id} />
							<div class="knoppen"><button>Verzoek sluiten</button></div>
						</form>
					{:else if ruilt === d.id}
						<p class="detail" style="margin:0.5rem 0 0">Wie vraag je?</p>
						{#if ruilBezig && kandidaten.length === 0}
							<p class="detail">Bezig…</p>
						{/if}
						{#each kandidaten as k (k.persoon_id)}
							<div class="regel" style="margin-top:0.3rem">
								<span>
									{k.naam}
									{#if k.bezet}<Merk soort="afgemeld" tekst="werkt die dag" />
									{:else if !k.kan}<Merk soort="achteraf" tekst="heeft weggezet" />{/if}
								</span>
								<button
									type="button"
									disabled={k.bezet || ruilBezig}
									onclick={() => vraag(d.id, d.datum, k.persoon_id)}
								>
									Vraag
								</button>
							</div>
						{/each}
						<div class="knoppen">
							<button type="button" class="primair" disabled={ruilBezig} onclick={() => vraag(d.id, d.datum, '')}>
								Open verzoek voor de groep
							</button>
							<button type="button" onclick={() => (ruilt = null)}>Laat maar</button>
						</div>
						{#if ruilFout}<p class="fout">{ruilFout}</p>{/if}
						<p class="notitie">
							Wie die dag al ergens staat kun je niet vragen. Iemand die zijn dag heeft
							weggezet mag je wél vragen — hij zegt zelf ja of nee.
						</p>
					{:else}
						<div class="knoppen">
							<button type="button" onclick={() => beginRuil(d.id)}>Ruilen</button>
						</div>
					{/if}
				</div>
			{/each}
			<p class="notitie">
				Kun je niet? Vraag het een collega, of zet een open verzoek in de groepsapp. Zegt iemand
				ja, dan verhuist de dienst meteen en klopt het rooster — niemand hoeft het nog om te
				zetten. Een dienst die al gemeld is, gaat via de baas.
			</p>
		</div>
	{/if}

	{#if openVanAnderen.length > 0}
		<div class="blok">
			<h2>Open in de groep</h2>
			{#each openVanAnderen as r (r.id)}
				<div class="kaart">
					<div class="regel">
						<span class="dag">{dagNaam(r.datum)} {datumKort(r.datum)}</span>
						<span class="detail tijden">{r.gepland_begin} – {r.gepland_eind}</span>
					</div>
					<p class="detail" style="margin:0.3rem 0 0">{r.van_naam} zoekt iemand voor {r.post}.</p>
					<div class="knoppen"><a href="/ruil/{r.id}">Bekijken →</a></div>
				</div>
			{/each}
			<p class="notitie">
				Deze diensten zoeken nog iemand. Wie het eerst ja zegt, krijgt hem — en wie die dag al
				werkt kan niet.
			</p>
		</div>
	{/if}

	{#if afgehandeld.length > 0}
		<div class="blok">
			<h2>Gedaan</h2>
			{#each afgehandeld as d (d.id)}
				{@const verschil = afwijkingInMinuten(d)}
				{#if corrigeert === d.id}
					<MeldKaart
						dienst={d}
						post={post(d)}
						corrigeren
						sluit={() => (corrigeert = null)}
					/>
				{:else}
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
						{#if d.status === 'gemeld'}
							<div class="knoppen">
								<button type="button" onclick={() => (corrigeert = d.id)}>Aanpassen</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			<p class="notitie">
				Verkeerd getikt? Zolang de baas hem nog niet bevestigd heeft kun je een melding
				aanpassen. Daarna is het zijn oordeel en gaat het via hem.
			</p>
		</div>
	{/if}

	{#if dezeWeek.length === 0 && openstaand.length === 0}
		<div class="blok">
			<p class="leeg">Je staat deze week niet ingeroosterd.</p>
		</div>
	{/if}
{/if}
