export const getGlobalStats = () => {
  const produits = JSON.parse(localStorage.getItem('mes_produits') || '[]');
  
  return produits.reduce((acc: any, p: any) => {
    // Calcul de la marge et prix pour cet article
    const tva = 1.20;
    const pVenteAmz = (p.prixAchat + 20) * tva; // On garde tes marges par défaut
    const pVenteShp = (p.prixAchat + 15) * tva;
    
    acc.caAmazon += p.stats.amazon.ventes * pVenteAmz;
    acc.caShopify += p.stats.shopify.ventes * pVenteShp;
    acc.ventesTotales += (p.stats.amazon.ventes + p.stats.shopify.ventes);
    acc.stockTotal += p.stock;
    if (p.stock < 10) acc.alertes += 1;
    
    return acc;
  }, { caAmazon: 0, caShopify: 0, ventesTotales: 0, stockTotal: 0, alertes: 0 });
};