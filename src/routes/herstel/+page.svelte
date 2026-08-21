<script lang="ts">
	import { enhance } from '$app/forms';
	import { telefoonTekst } from '$lib/telefoon';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/**
	 * Wat er in stap 2 in het veld staat.
	 *
	 * De server draagt het kenmerk over in zijn nette vorm (`+31612345678`), en
	 * die is voor een mens niet het nummer dat hij zelf zou opschrijven. Dus
	 * hier weer terug naar 06 — de server maakt er bij het verzenden opnieuw de
	 * nette vorm van.
	 */
	const ingevuld = $derived(data.naam.startsWith('+') ? telefoonTekst(data.naam) : data.naam);

	let bezig = $state(false);
	let toon = $state(false);

	const wacht = () => {
		bezig = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			bezig = false;
		};
	};
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

{#if data.stap === 'naam'}
	<!-- ── Stap 1: wie ben je ─────────────────────────────────────────── -->
	<div class="blok">
		<h2>Wachtwoord vergeten</h2>
		<p class="detail">
			Vul je gebruikersnaam of je telefoonnummer in. Staat dat nummer bij je account, dan krijg je
			een sms met een code.
		</p>

		<form method="post" action="?/aanvragen" use:enhance={wacht}>
			<label class="veld">
				<span>Gebruikersnaam of telefoonnummer</span>
				<input
					name="naam"
					autocapitalize="none"
					spellcheck="false"
					placeholder="daanb of 06 12345678"
					required
					value={form?.naam ?? ''}
				/>
			</label>
			<div class="knoppen">
				<button class="groot primair" disabled={bezig}>{bezig ? 'Bezig…' : 'Stuur me een code'}</button>
			</div>
		</form>

		<p class="notitie">
			Je krijgt een sms als er een telefoonnummer bij je account staat. Zo niet, dan zet je baas een
			nieuw wachtwoord voor je klaar — en zet je daarna zelf je nummer op "Mijn gegevens", zodat het
			de volgende keer wel kan. Je gebruikersnaam kwijt? Dan is je telefoonnummer genoeg.
		</p>
	</div>
{:else if data.stap === 'code'}
	<!-- ── Stap 2: de code uit de sms ─────────────────────────────────── -->
	<div class="blok">
		<h2>Vul de code in</h2>
		<p class="detail">
			Hoort hier een telefoonnummer bij, dan is er een sms verstuurd met zes cijfers. Die code is
			tien minuten geldig en je hebt drie pogingen.
		</p>
		<p class="notitie">
			<strong>Komt er geen sms?</strong> Dan hoort wat je invulde bij niemand, staat er geen nummer
			bij, gebruiken twee mensen hetzelfde nummer, of zijn er vandaag al drie codes aangevraagd.
			Vraag in dat geval je werkgever om een nieuw wachtwoord — en zet daarna je nummer op "Mijn
			gegevens", dan kan het de volgende keer wel.
		</p>

		{#if data.viaLog}
			<p class="notitie">
				<strong>Let op:</strong> er staan geen sms-sleutels in <code>.env</code>, dus de code is
				niet verstuurd maar in de serverlog gezet. Kijk in de terminal waar
				<code>npm run dev</code> draait.
			</p>
		{/if}

		<form method="post" action="?/code" use:enhance={wacht}>
			<label class="veld">
				<span>Gebruikersnaam of telefoonnummer</span>
				<input name="naam" autocapitalize="none" spellcheck="false" required value={ingevuld} />
			</label>
			<label class="veld">
				<span>Code uit de sms</span>
				<input
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					placeholder="418302"
					required
				/>
			</label>
			<div class="knoppen">
				<button class="groot primair" disabled={bezig}>{bezig ? 'Bezig…' : 'Verder'}</button>
			</div>
		</form>

		<p class="notitie">
			Zolang je geen nieuw wachtwoord hebt ingesteld, werkt je oude gewoon nog. Weet je hem alsnog?
			<a href="/inloggen">Dan kun je gewoon inloggen.</a>
		</p>
	</div>
{:else}
	<!-- ── Stap 3: het nieuwe wachtwoord ──────────────────────────────── -->
	<div class="blok">
		<h2>Kies een nieuw wachtwoord</h2>
		<p class="detail">Twee keer, zodat een typefout niet blijft staan.</p>

		<form method="post" action="?/nieuw" use:enhance={wacht}>
			<label class="veld">
				<span>Nieuw wachtwoord</span>
				<span class="metoog">
					<input
						name="wachtwoord"
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
			<label class="veld">
				<span>Nog een keer</span>
				<input
					name="nogmaals"
					type={toon ? 'text' : 'password'}
					autocomplete="new-password"
					minlength="8"
					required
				/>
			</label>
			<div class="knoppen">
				<button class="groot primair" disabled={bezig}>
					{bezig ? 'Bezig…' : 'Wachtwoord instellen'}
				</button>
			</div>
		</form>

		<p class="notitie">
			Minstens acht tekens. Daarna log je één keer opnieuw in met je nieuwe wachtwoord — zo weet je
			zeker dat het werkt.
		</p>
	</div>
{/if}
