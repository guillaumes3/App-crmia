import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
// On pointe vers ton fichier utilitaire spécifique
import { normalizeCompanySlug } from '../../utils/companySlug';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: orgs, error } = await supabaseAdmin
    .from('organisations')
    .select('id, name')
    .or('slug.is.null,slug.eq.""'); 

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates = (orgs || []).map(async (org) => {
    // On utilise TA fonction métier définie dans /utils/companySlug.ts
    const newSlug = normalizeCompanySlug(org.name);
    
    return supabaseAdmin
      .from('organisations')
      .update({ slug: newSlug })
      .eq('id', org.id);
  });

  await Promise.all(updates);

  return NextResponse.json({ message: "Migration terminée avec succès." });
}