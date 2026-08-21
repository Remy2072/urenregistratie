<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { telefoonTekst } from '$lib/telefoon';
	import { kanPasskey, maakPasskey, passkeyFout } from '$lib/passkey';
	import { datumKort } from '$lib/tijd';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Als beheerder zie je de hele ploeg, als bezorger alleen jezelf. Dat
	// verschil is precies wat de policies doen.
	let beheerder = $derived(data.persoon?.rol === 'manager' || data.persoon?.rol === 'eigenaar');

	// Hetzelfde oogje als op het inlogscherm: je typt hier een wachtwoord dat je
	// nog niet kent uit je hoofd.
	let toon = $state(false);
	let bezig = $state(false);

	/**
	 * Staat de app al op het beginscherm? Dan is de uitleg eronder onzin.
	 *
	 * Dit mag in de browser, want het gaat over de browser: hoe deze pagina
	 * geopend is, weet de server niet. Begint op false, zodat er bij iemand
	 * zonder JavaScript uitleg staat in plaats van niets.
	 */
	let alsApp = $state(false);
	$effect(() => {
		alsApp =
			window.matchMedia('(display-mode: standalone)').matches ||
			// Safari op iOS doet display-mode niet en zet dit in plaats daarvan.
			(navigator as { standalone?: boolean }).standalone === true;
	});

	// Kan dit toestel passkeys? Dat weet alleen de browser, dus staat de knop er
	// pas na het laden.
	let passkeyKan = $state(false);
	$effect(() => {
		passkeyKan = kanPasskey();
	});

	// De agendalink zie je één keer, net als een wachtwoord. Daarna staat er
	// alleen nog dat je er een hebt.
	let agendaGekopieerd = $state(false);
	async function kopieerAgenda(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			agendaGekopieerd = true;
			setTimeout(() => (agendaGekopieerd = false), 2500);
		} catch {
			agendaGekopieerd = false;
		}
	}

	let passkeyBezig = $state(false);
	let passkeyMelding = $state<string | null>(null);
	let toestelnaam = $state('');

	/**
	 * Een passkey aanmelden voor dit toestel.
	 *
	 * De server haalt de opdracht op en controleert het antwoord; hier gebeurt
	 * alleen het stukje dat alleen hier kán -- het venster van de telefoon. Zo
	 * blijft de sessie in de cookie die scripts niet kunnen lezen.
	 */
	async function passkeyAanmelden() {
		passkeyBezig = true;
		passkeyMelding = null;
		try {
			const start = await stuur('?/passkeyStart', new FormData());
			if (start.type !== 'success' || !start.data?.opdracht) {
				passkeyMelding = start.data?.fout ?? 'Dat lukte niet.';
				return;
			}

			const { challengeId, opties } = start.data.opdracht;
			const antwoord = await maakPasskey(opties);

			const klaar = new FormData();
			klaar.set('challengeId', challengeId);
			klaar.set('antwoord', JSON.stringify(antwoord));
			klaar.set('naam', toestelnaam);

			const uitkomst = await stuur('?/passkeyKlaar', klaar);
			if (uitkomst.type === 'success') {
				toestelnaam = '';
				passkeyMelding = uitkomst.data?.gedaan ?? 'Gelukt.';
				await invalidateAll(); // de lijst hieronder opnieuw ophalen
				return;
			}
			passkeyMelding = uitkomst.data?.fout ?? 'Dat lukte niet.';
		} catch (fout) {
			passkeyMelding = passkeyFout(fout);
		} finally {
			passkeyBezig = false;
		}
	}

	/** Een actie aanroepen zonder formulier. Dit is de manier die SvelteKit ervoor heeft. */
	async function stuur(actie: string, body: FormData) {
		const antwoord = await fetch(actie, { method: 'POST', body });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return deserialize(await antwoord.text()) as any;
	}
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}
{#if form?.gedaan}
	<p class="notitie">{form.gedaan}</p>
{/if}

<div class="blok">
	{#if data.persoon}
		<div class="kaart nu">
			<div class="regel">
				<span class="dag">{data.persoon.naam}</span>
				<span class="merk {beheerder ? 'bevestigd' : 'gemeld'}">{data.persoon.rol}</span>
			</div>
			{#if data.persoon.gebruikersnaam}
				<p class="detail" style="margin:0.4rem 0 0">
					Je logt in als <span class="tijden">{data.persoon.gebruikersnaam}</span>
				</p>
			{:else}
				<p class="detail" style="margin:0.4rem 0 0">Je logt in met {data.email}</p>
			{/if}
		</div>

		<p class="notitie">
			Je naam en je gebruikersnaam zijn van de baas. Dat is geen wantrouwen: staat er in het
			rooster morgen een andere naam dan gisteren, dan klopt geen enkel oud overzicht meer. Klopt er
			iets niet, vraag of hij het omzet.
		</p>
	{:else}
		<div class="kaart aandacht">
			<div class="regel"><span class="dag">Nog niet gekoppeld</span></div>
			<p class="detail" style="margin:0.4rem 0 0">
				Je bent ingelogd als {data.email}, maar dit account hangt nog aan geen enkele persoon. Zolang
				<code>personen.auth_user_id</code> leeg is, laat de database je nergens bij — vandaar dat alle
				tellingen hieronder op nul staan.
			</p>
		</div>
	{/if}
</div>

{#if !alsApp}
	<!--
		De goedkoopste oplossing voor "ik moet steeds opnieuw inloggen": de app
		als icoon openen. Dan heeft hij zijn eigen omgeving en zijn eigen
		koekjes, buiten de schoonmaak van de browser om -- en je bent van de
		adresbalk af.
	-->
	<div class="blok">
		<h2>Zet de app op je beginscherm</h2>
		<p class="detail">
			Dan opent hij als een app en blijf je ingelogd. Je hoeft niets te installeren; het is
			dezelfde app met een icoon ervoor.
		</p>
		<p class="notitie">
			<strong>iPhone:</strong> in Safari op het deelknopje onderaan, dan "Zet op beginscherm".<br />
			<strong>Android:</strong> in Chrome op de drie puntjes rechtsboven, dan "Toevoegen aan
			startscherm".
		</p>
	</div>
{/if}

{#if data.persoon}
	<!-- ── Telefoonnummer ─────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Je telefoonnummer</h2>
		<form method="post" action="?/telefoon" use:enhance>
			<label class="veld">
				<span>Nummer</span>
				<input
					name="telefoon"
					type="tel"
					inputmode="tel"
					autocomplete="tel"
					placeholder="06 12345678"
					value={telefoonTekst(data.persoon.telefoon)}
				/>
			</label>
			<div class="knoppen"><button class="primair">Opslaan</button></div>
		</form>
		<p class="notitie">
			Dit is het enige gegeven dat je zelf mag wijzigen, en het is er voor later: een nieuw
			wachtwoord per sms, en een collega vragen of hij een dienst overneemt. Er gaat nu nog niets
			heen. Laat je het leeg, dan staat er niets en werkt de rest gewoon.
		</p>
	</div>

	<!-- ── Agenda ─────────────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Je diensten in je agenda</h2>

		{#if form?.agenda}
			<div class="kaart nu">
				<div class="regel"><span class="dag">Je agendalink</span></div>
				<div class="knoppen">
					<button type="button" class="primair" onclick={() => kopieerAgenda(form.agenda!)}>
						{agendaGekopieerd ? 'Gekopieerd' : 'Kopieer de link'}
					</button>
				</div>
				<p class="notitie">
					Kopieer hem nu — je ziet hem één keer, want in de database staat alleen een versleutelde
					versie. Kwijt? Maak een nieuwe; de oude werkt dan niet meer.
				</p>
			</div>

			<p class="notitie">
				<strong>Op je iPhone:</strong> Instellingen → Apps → Agenda → Accounts → Account toevoegen
				→ Anders → Geabonneerde agenda toevoegen, en plak de link.<br />
				<strong>Op een Mac:</strong> Agenda → Bestand → Nieuw agenda-abonnement.<br />
				<strong>Google Agenda:</strong> op een computer, via "Andere agenda's" → Van URL.
			</p>
		{:else}
			<p class="detail">
				{#if data.agendaAan}
					Je hebt een agendalink. Weet je hem niet meer, maak dan een nieuwe — de oude stopt dan
					met werken.
				{:else}
					Eén link, en je diensten staan in de agenda die je toch al open hebt.
				{/if}
			</p>
			<form method="post" action="?/agendaLink" use:enhance>
				<div class="knoppen">
					<button class="primair">{data.agendaAan ? 'Nieuwe link maken' : 'Maak een agendalink'}</button>
				</div>
			</form>
			{#if data.agendaAan}
				<form method="post" action="?/agendaUit" use:enhance>
					<div class="knoppen"><button>Zet de agenda uit</button></div>
				</form>
			{/if}
		{/if}

		<p class="notitie">
			Er staan alleen jouw diensten in: dag, geplande tijden en welke bus. Geen gewerkte uren en
			geen opmerkingen — dat blijft tussen jou en de baas.
		</p>
		<p class="notitie">
			<strong>Behandel die link als een wachtwoord.</strong> Wie hem heeft, ziet wanneer jij werkt —
			een agenda kan namelijk niet inloggen, dus die link is het enige bewijs. En reken op enige
			vertraging: je agenda bepaalt zelf hoe vaak hij kijkt, bij Google kan dat uren duren. De app
			blijft de plek waar het rooster echt staat.
		</p>
	</div>

	<!-- ── Passkey ────────────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Inloggen met je gezicht of vinger</h2>

		{#if !data.passkeysKan}
			<p class="detail">
				Dit staat nog uit in Supabase. Zet het aan bij Authentication → Passkeys, dan verschijnt
				het hier.
			</p>
		{:else}
			{#each data.passkeys as pk (pk.id)}
				<div class="kaart">
					<div class="regel">
						<span class="dag">{pk.friendly_name || 'Naamloos toestel'}</span>
						<span class="detail">sinds {datumKort(pk.created_at.slice(0, 10))}</span>
					</div>
					{#if pk.last_used_at}
						<p class="detail" style="margin:0.2rem 0 0">
							Laatst gebruikt op {datumKort(pk.last_used_at.slice(0, 10))}
						</p>
					{/if}
					<form method="post" action="?/passkeyWeg" use:enhance>
						<input type="hidden" name="id" value={pk.id} />
						<div class="knoppen"><button>Weghalen</button></div>
					</form>
				</div>
			{/each}

			{#if passkeyKan}
				<label class="veld">
					<span>Hoe heet dit toestel?</span>
					<input bind:value={toestelnaam} placeholder="iPhone van Daan" />
				</label>
				<div class="knoppen">
					<button type="button" class="primair" onclick={passkeyAanmelden} disabled={passkeyBezig}>
						{passkeyBezig ? 'Bezig…' : 'Dit toestel toevoegen'}
					</button>
				</div>
				{#if passkeyMelding}
					<p class="notitie">{passkeyMelding}</p>
				{/if}
			{:else}
				<p class="detail">Dit toestel kan geen passkeys. Op je telefoon werkt het meestal wel.</p>
			{/if}

			<p class="notitie">
				Eén keer aanzetten per toestel. Daarna log je in met het gezicht, de vinger of de pincode
				van je telefoon — er komt geen wachtwoord meer aan te pas, en er is ook niets meer om over
				te typen van een briefje.
			</p>
			<p class="notitie">
				Je wachtwoord blijft werken en blijft nodig: een passkey zit op dít toestel. Raak je je
				telefoon kwijt, dan is dat je weg terug — en de baas kan er altijd een nieuw voor je
				zetten. Nieuwe telefoon? Zet hem daar ook aan en haal de oude hier weg.
			</p>
		{/if}
	</div>

	<!-- ── Wachtwoord ─────────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Je wachtwoord</h2>
		<form
			method="post"
			action="?/wachtwoord"
			use:enhance={() => {
				bezig = true;
				return async ({ update }) => {
					await update();
					bezig = false;
				};
			}}
		>
			<label class="veld">
				<span>Je huidige wachtwoord</span>
				<input name="huidig" type="password" autocomplete="current-password" required />
			</label>
			<label class="veld">
				<span>Je nieuwe wachtwoord</span>
				<span class="metoog">
					<input
						name="nieuw"
						type={toon ? 'text' : 'password'}
						autocomplete="new-password"
						minlength="8"
						required
					/>
					<button
						type="button"
						class="oog"
						onclick={() => (toon = !toon)}
						aria-label={toon ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
						aria-pressed={toon}
					>
						{toon ? 'verberg' : 'toon'}
					</button>
				</span>
			</label>
			<div class="knoppen">
				<button class="primair" disabled={bezig}>{bezig ? 'Bezig…' : 'Wachtwoord wijzigen'}</button>
			</div>
		</form>
		<p class="notitie">
			Je huidige wachtwoord moet erbij. Anders is een telefoon die je even open laat liggen genoeg
			om je buiten te sluiten — en er komt geen mail aan te pas om dat terug te draaien.
		</p>
		<p class="notitie">
			Na het wijzigen log je één keer opnieuw in, met je nieuwe wachtwoord. Op je andere telefoons
			ook.
		</p>
	</div>
{/if}

<div class="blok">
	<details>
		<summary>Wat de database jou laat zien</summary>
		<div class="tabelrand" style="margin-top:0.6rem">
			<table>
				<tbody>
					<tr><td>Personen</td><td class="getal">{data.zichtbaar.personen}</td></tr>
					<tr><td>Diensten</td><td class="getal">{data.zichtbaar.diensten}</td></tr>
					<tr><td>Sjabloonregels</td><td class="getal">{data.zichtbaar.sjabloon}</td></tr>
					<tr><td>Posten</td><td class="getal">{data.zichtbaar.posten}</td></tr>
				</tbody>
			</table>
		</div>

		<p class="notitie">
			{#if beheerder}
				Je ziet de hele ploeg en alle diensten. Dat hoort: je bent beheerder.
			{:else if data.persoon}
				Eén persoon — jezelf — en van het sjabloon alleen jouw eigen vaste dagen. De ploeg staat er
				wel, je mag hem alleen niet zien. Posten zijn voor iedereen zichtbaar; daar staan geen
				persoonsgegevens in.
			{:else}
				Overal nul. Niet omdat de database leeg is, maar omdat dit account nog nergens bij hoort.
			{/if}
		</p>
		<p class="notitie">
			Deze tellingen gaan door row level security heen. Wat er staat is dus wat de database jou
			toestaat, en niet wat dit scherm besloten heeft te tonen.
		</p>
	</details>
</div>

<div class="blok">
	<form method="POST" action="?/uitloggen">
		<div class="knoppen">
			<button class="groot" type="submit">Uitloggen</button>
		</div>
	</form>
</div>
