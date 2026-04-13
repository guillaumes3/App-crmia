import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeCompanySlug } from '../../utils/companySlug';

// Initialisation sécurisée
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: orgs, error } = await supabaseAdmin
      .from('organisations')
      // 1. ICI : Remplace 'name' par le vrai nom de la colonne (ex: 'nom')
      .select('id, nom') 
      .or('slug.is.null,slug.eq.""');

    if (error) throw error;

    const updates = (orgs || []).map(async (org) => {
      // 2. ICI : Utilise org.nom au lieu de org.name
      const newSlug = normalizeCompanySlug(org.nom); 
      
      return supabaseAdmin
        .from('organisations')
        .update({ slug: newSlug })
        .eq('id', org.id);
    });

    await Promise.all(updates);
    return NextResponse.json({ message: "Migration réussie !" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}