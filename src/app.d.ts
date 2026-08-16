import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			/**
			 * Praat met Supabase namens de ingelogde gebruiker, dus mét RLS.
			 * Null als er nog geen .env is ingevuld -- dan blijft het prototype
			 * gewoon werken en zegt alleen het inlogscherm er iets van.
			 */
			supabase: SupabaseClient | null;
			/** Sessie én gebruiker, allebei geverifieerd bij Supabase. */
			veiligeSessie: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			ingelogd: boolean;
		}
	}
}

export {};
