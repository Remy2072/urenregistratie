<script lang="ts">
	import { page } from '$app/state';
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { gebruikPasskey, kanPasskey, passkeyFout } from '$lib/passkey';
	import Kaart from '$lib/componenten/Kaart.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let bezig = $state(false);

	// Wachtwoorden die de app uitdeelt zien eruit als 9rgzs-ywb4e-fyr9p, en die
	// typt iedereen van een briefje over. Zonder oogje weet je bij een misser
	// niet of je verkeerd getypt hebt of het verkeerde wachtwoord hebt.
	let toon = $state(false);

	// Kan dit toestel passkeys? Pas na het laden te zeggen, want de server weet
	// het niet -- dus staat de knop er eerst niet en verschijnt hij daarna.
	let passkeyKan = $state(false);
	$effect(() => {
		passkeyKan = kanPasskey();
	});

	let passkeyBezig = $state(false);
	let passkeyMelding = $state<string | null>(null);

	/**
	 * Inloggen met een passkey: drie stappen, en de middelste is de enige die
	 * hier hoort.
	 *
	 * 1. De server vraagt de opdracht op bij Supabase.
	 * 2. De telefoon laat zijn venster zien en ondertekent -- dat kan alleen hier.
	 * 3. De server laat het antwoord controleren en zet de sessie in de cookie.
	 *
	 * Er komt dus geen sleutel en geen sessie in deze browser. Dat is waarom
	 * fase 11 z'n httpOnly-cookie kan houden.
	 */
	async function metPasskey() {
		passkeyBezig = true;
		passkeyMelding = null;
		try {
			const start = await stuur('?/passkeyStart', new FormData());
			if (start.type !== 'success' || !start.data?.opdracht) {
				passkeyMelding = start.data?.fout ?? 'Passkey inloggen kan hier niet.';
				return;
			}

			const { challengeId, opties } = start.data.opdracht;
			const antwoord = await gebruikPasskey(opties);

			const klaar = new FormData();
			klaar.set('challengeId', challengeId);
			klaar.set('antwoord', JSON.stringify(antwoord));
			klaar.set('verder', data.verder);

			const uitkomst = await stuur('?/passkeyKlaar', klaar);
			if (uitkomst.type === 'redirect') {
				// De cookie staat er; nu pas mag de app opnieuw laden.
				await invalidateAll();
				window.location.href = uitkomst.location;
				return;
			}
			passkeyMelding = uitkomst.data?.fout ?? 'Inloggen met je passkey lukte niet.';
		} catch (fout) {
			// Weggeklikt is geen fout, dus dan blijft het stil. Zie passkeyFout().
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

{#if page.url.searchParams.has('nieuw')}
	<div class="blok">
		<Kaart soort="nu">
			<div class="regel"><span class="dag">Je wachtwoord is gewijzigd</span></div>
			<p class="detail na-klein">
				Log opnieuw in, met je nieuwe wachtwoord. Op je andere telefoons ook.
			</p>
		</Kaart>
	</div>
{/if}

{#if page.url.searchParams.has('weg')}
	<p class="fout">
		Je staat op non-actief en kunt daarom niet inloggen. Klopt dat niet, vraag dan je baas om je
		weer aan te vinken.
	</p>
{/if}

{#if !data.ingesteld}
	<div class="blok">
		<Kaart soort="aandacht">
			<div class="regel"><span class="dag">Database nog niet ingesteld</span></div>
			<p class="detail na-klein">
				Maak een bestand <code>.env</code> naast <code>package.json</code> en zet daar de twee
				waarden in die in <code>.env.example</code> staan. Daarna de dev server opnieuw starten.
			</p>
		</Kaart>
	</div>
{/if}

<div class="blok">
	<form
		method="POST"
		action="?/wachtwoord"
		use:enhance={() => {
			bezig = true;
			return async ({ update }) => {
				await update();
				bezig = false;
			};
		}}
	>
		<!-- Waar je heen wilde. Als verborgen veld en niet in de actie-URL, want
		     die wordt door `?/wachtwoord` overschreven. -->
		<input type="hidden" name="verder" value={data.verder} />

		<label class="veld">
			<span>{data.gebruikersnaam ? 'Gebruikersnaam' : 'E-mailadres'}</span>
			<!--
				Geen type="email": dan weigert de browser 'daanb' voordat de server
				hem ooit ziet. De server bepaalt wat het is, aan het apenstaartje.
			-->
			<input
				name="wie"
				type="text"
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
				placeholder={data.gebruikersnaam ? 'daanb' : 'jij@voorbeeld.nl'}
				value={form?.wie ?? ''}
			/>
		</label>

		<label class="veld">
			<span>Wachtwoord</span>
			<span class="metoog">
				<input
					name="wachtwoord"
					type={toon ? 'text' : 'password'}
					autocomplete="current-password"
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

		{#if form?.fout}
			<p class="fout">{form.fout}</p>
		{/if}

		<div class="knoppen">
			<button class="groot primair" type="submit" disabled={bezig}>
				{bezig ? 'Bezig…' : 'Inloggen'}
			</button>
		</div>
	</form>

	{#if passkeyKan}
		<!--
			Onder het wachtwoord en niet erboven: wie hier voor het eerst komt heeft
			nog geen passkey, en dan is een knop die niets doet het verkeerde begin.
		-->
		<div class="knoppen na-ruim">
			<button type="button" class="groot" onclick={metPasskey} disabled={passkeyBezig}>
				{passkeyBezig ? 'Bezig…' : 'Inloggen met gezicht of vinger'}
			</button>
		</div>
		{#if passkeyMelding}
			<p class="fout">{passkeyMelding}</p>
		{/if}
	{/if}

		{#if data.gebruikersnaam}
			<p class="notitie">
				Je gebruikersnaam is een kort woord dat je van de baas krijgt, zoals <code>daanb</code>. Je
				oude e-mailadres blijft ook werken.
			</p>
		{/if}

		<p class="notitie">
			<a href="/herstel">Wachtwoord vergeten?</a> Staat er een telefoonnummer bij je account, dan
			krijg je een code per sms en stel je zelf een nieuw wachtwoord in. Zo niet, dan zet je baas er
			in een minuut een nieuwe voor je klaar — er komt geen mail aan te pas.
		</p>
	</div>

<div class="blok">
	<!--
		Wie hier staat terwijl hij dat niet verwachtte, heeft precies deze vraag.
		Dichtgeklapt, want voor de meeste mensen is het inlogscherm het enige dat
		ze hier komen doen.
	-->
	<details>
		<summary>Moet je hier vaker inloggen dan je wil?</summary>
		<p class="notitie">
			Zet de app op je beginscherm, dan opent hij als een app en blijf je ingelogd. Op een
			<strong>iPhone</strong> via het deelknopje onderaan in Safari → "Zet op beginscherm". Op
			<strong>Android</strong> via de drie puntjes in Chrome → "Toevoegen aan startscherm".
		</p>
		<p class="notitie">
			Kwam je hier na een storing? Dan was je niet uitgelogd en werkt je oude wachtwoord nog
			gewoon.
		</p>
	</details>

	<p class="notitie">
		Geen account aanmaken hier. Je krijgt je inlog van de baas — tien mensen, dat regel je niet met
		een registratieformulier dat iedereen kan vinden.
	</p>
</div>
