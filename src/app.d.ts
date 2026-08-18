import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			/**
			 * Praat met Supabase namens de ingelogde gebruiker, dus mét RLS.
			 * Null als er nog geen .env is ingevuld. Dan kom je nergens verder
			 * dan het inlogscherm, en dat zegt er iets over.
			 */
			supabase: SupabaseClient | null;
			/** Sessie én gebruiker, allebei geverifieerd bij Supabase. */
			veiligeSessie: () => Promise<{ session: Session | null; user: User | null }>;
			/** Wie je bent volgens `personen`. Per verzoek onthouden. */
			ik: () => Promise<import('$lib/server/wie').Ik | null>;
		}
		interface PageData {
			ingelogd: boolean;
			/** Wie je bent volgens `personen`. Null als de login nog niet gekoppeld is. */
			ik: { id: string; naam: string; rol: 'medewerker' | 'beheerder' } | null;
			/** Heb je zelf diensten? Bepaalt of het bezorgertabblad er staat. */
			bezorger: boolean;
			/** Datum en tijd in Nederland, gelezen op de server. */
			nu: { datum: string; tijd: string };
		}
	}
}

export {};
