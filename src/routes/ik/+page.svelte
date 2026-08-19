<script lang="ts">
	import { enhance } from '$app/forms';
	import { telefoonTekst } from '$lib/telefoon';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Als beheerder zie je de hele ploeg, als bezorger alleen jezelf. Dat
	// verschil is precies wat de policies doen.
	let beheerder = $derived(data.persoon?.rol === 'manager' || data.persoon?.rol === 'eigenaar');

	// Hetzelfde oogje als op het inlogscherm: je typt hier een wachtwoord dat je
	// nog niet kent uit je hoofd.
	let toon = $state(false);
	let bezig = $state(false);
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
