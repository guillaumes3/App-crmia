// src/app/utils/stats.ts
export const getGlobalStats = () => {
  if (typeof window === 'undefined') return null;
  
  const produits = JSON.parse(localStorage.getItem('mes_produits') || '[]');
  
  return produits.reduce((acc: any, p: any) => {
    acc.caAmazon += (p.stats?.amazon?.ventes || 0) * (p.prixAchat * 1.5);
    acc.caShopify += (p.stats?.shopify?.ventes || 0) * (p.prixAchat * 1.3);
    acc.ventesTotales += (p.stats?.amazon?.ventes || 0) + (p.stats?.shopify?.ventes || 0);
    acc.stockTotal += (p.stock || 0);
    if (p.stock < 5) acc.alertes += 1;
    return acc;
  }, { caAmazon: 0, caShopify: 0, ventesTotales: 0, stockTotal: 0, alertes: 0 });
};