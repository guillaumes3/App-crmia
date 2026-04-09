import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export function useUser() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // 1. On récupère l'utilisateur connecté
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // 2. On extrait l'ID de l'organisation qui est stocké dans les métadonnées de l'utilisateur
  const orgId = session?.user?.user_metadata?.organisation_id;

  return { user: session?.user, orgId };
}