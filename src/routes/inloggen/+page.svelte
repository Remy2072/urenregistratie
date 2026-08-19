<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let bezig = $state(false);

	// Wachtwoorden die de app uitdeelt zien eruit als 9rgzs-ywb4e-fyr9p, en die
	// typt iedereen van een briefje over. Zonder oogje weet je bij een misser
	// niet of je verkeerd getypt hebt of het verkeerde wachtwoord hebt.
	let toon = $state(false);
</script>

{#if page.url.searchParams.has('nieuw')}
	<div class="blok">
		<div class="kaart nu">
			<div class="regel"><span class="dag">Je wachtwoord is gewijzigd</span></div>
			<p class="detail" style="margin:0.4rem 0 0">
				Log opnieuw in, met je nieuwe wachtwoord. Op je andere telefoons ook.
			</p>
		</div>
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
		<div class="kaart aandacht">
			<div class="regel"><span class="dag">Database nog niet ingesteld</span></div>
			<p class="detail" style="margin:0.4rem 0 0">
				Maak een bestand <code>.env</code> naast <code>package.json</code> en zet daar de twee
				waarden in die in <code>.env.example</code> staan. Daarna de dev server opnieuw starten.
			</p>
		</div>
	</div>
{/if}

<div class="blok">
	<form
		method="POST"
		use:enhance={() => {
			bezig = true;
			return async ({ update }) => {
				await update();
				bezig = false;
			};
		}}
	>
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

		{#if data.gebruikersnaam}
			<p class="notitie">
				Je gebruikersnaam is een kort woord dat je van de baas krijgt, zoals <code>daanb</code>. Je
				oude e-mailadres blijft ook werken.
			</p>
		{/if}

		<p class="notitie">
			Wachtwoord kwijt? Vraag je baas — die zet er in een minuut een nieuwe voor je klaar. Er komt
			geen mail aan te pas, dus je hoeft nergens anders in te loggen om erbij te kunnen.
		</p>
	</div>

<div class="blok">
	<p class="notitie">
		Geen account aanmaken hier. Je krijgt je inlog van de baas — tien mensen, dat regel je niet met
		een registratieformulier dat iedereen kan vinden.
	</p>
</div>
