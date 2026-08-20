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
			/**
			 * Sessie én gebruiker, allebei geverifieerd bij Supabase.
			 *
			 * `onzeker` is waar als het nagaan zelf mislukte -- geen netwerk, Supabase
			 * even plat. Dan ben je niet uitgelogd, het is alleen niet vast te stellen.
			 */
			veiligeSessie: () => Promise<{
				session: Session | null;
				user: User | null;
				onzeker: boolean;
			}>;
			/** Wie je bent volgens `personen`. Per verzoek onthouden. */
			ik: () => Promise<import('$lib/server/wie').Ik | null>;
		}
		interface PageData {
			ingelogd: boolean;
			/** Wie je bent volgens `personen`. Null als de login nog niet gekoppeld is. */
			ik: import('$lib/server/wie').Ik | null;
			/** Heb je zelf diensten? Bepaalt of het bezorgertabblad er staat. */
			bezorger: boolean;
			/** Datum en tijd in Nederland, gelezen op de server. */
			nu: { datum: string; tijd: string };
		}
	}
}

export {};
