import { supabase } from '../utils/supabase';

export const DB = {
  // Récupérer les produits de l'entreprise
  getProducts: async (orgId: string) => {
    const { data, error } = await supabase
      .from('produits')
      .select('*')
      .eq('organisation_id', orgId);
    
    if (error) throw error;
    return data;
  },

  // Ajouter un produit
  addProduct: async (produit: any, orgId: string) => {
    const { data, error } = await supabase
      .from('produits')
      .insert([{ ...produit, organisation_id: orgId }]);
    
    if (error) throw error;
    return data;
  }
};