import { supabase } from '../utils/supabase';

export const getDashboardStats = async (orgId: string) => {
  if (!orgId) return { nbProduits: 0, valeurStock: 0, nbVentes: 0 };

  // Récupération du nombre de produits et de la valeur
  const { data, error } = await supabase
    .from('produits')
    .select('stock, prix_vente')
    .eq('organisation_id', orgId);

  if (error) {
    console.error("Erreur stats:", error);
    return { nbProduits: 0, valeurStock: 0, nbVentes: 0 };
  }

  const nbProduits = data?.length || 0;
  const valeurStock = data?.reduce((acc, p) => acc + (p.stock * p.prix_vente), 0) || 0;

  return {
    nbProduits,
    valeurStock: valeurStock.toFixed(2),
    nbVentes: 0 // On liera la table ventes plus tard
  };
};