"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPrefilledLinesFromRupture,
  checkAutoReorder,
  createPurchaseOrderDraft,
  getFournisseursByOrganisation,
  getSupplierCatalog,
  getSupplierOrders,
  linkArticleToSupplier,
  type DraftOrderLineInput,
  type PurchaseOrderRow,
  type PurchaseOrderStatus,
  type ReorderSuggestion,
  type SupplierCatalogRow,
  type SupplierDirectoryRow,
} from "@/app/services/fournisseurs";
import { supabase } from "@/app/utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";

type ActionState = "oneClickDraft" | "manualDraft" | "linkArticle" | null;

const euroFormat = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function FournisseursPage() {
  const [organisationId, setOrganisationId] = useState("");
  const [fournisseurs, setFournisseurs] = useState<SupplierDirectoryRow[]>([]);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<SupplierCatalogRow[]>([]);
  const [commandes, setCommandes] = useState<PurchaseOrderRow[]>([]);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const [menuFournisseurId, setMenuFournisseurId] = useState<string | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderLines, setOrderLines] = useState<DraftOrderLineInput[]>([]);

  const [linkArticleId, setLinkArticleId] = useState("");
  const [linkSku, setLinkSku] = useState("");
  const [linkPrix, setLinkPrix] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const onResize = () => setIsCompactLayout(window.innerWidth < 1120);
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Session introuvable. Merci de vous reconnecter.");
        }

        if (isKipiloteStaff(session.user)) {
          setActiveUniverse("hq");
          throw new Error("Acces HQ interdit sur le module fournisseurs client.");
        }

        setActiveUniverse("client");
        const orgId = getOrganisationId(session.user);

        if (!orgId) {
          throw new Error("organisation_id manquant dans la session utilisateur.");
        }

        const fournisseursRows = await getFournisseursByOrganisation(orgId);
        if (!isMounted) return;

        setOrganisationId(orgId);
        setFournisseurs(fournisseursRows);
        setSelectedFournisseurId((current) => {
          if (current && fournisseursRows.some((fournisseur) => fournisseur.id === current)) {
            return current;
          }
          return fournisseursRows[0]?.id ?? null;
        });
      } catch (error) {
        if (!isMounted) return;
        setPageError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedFournisseur = useMemo(() => {
    return fournisseurs.find((fournisseur) => fournisseur.id === selectedFournisseurId) ?? null;
  }, [fournisseurs, selectedFournisseurId]);

  const filteredFournisseurs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return fournisseurs;
    }

    return fournisseurs.filter((fournisseur) => {
      const nom = fournisseur.nom.toLowerCase();
      const categorie = (fournisseur.categorie_produits ?? "").toLowerCase();
      const etat = fournisseur.etat_commandes_en_cours.toLowerCase();
      return nom.includes(normalizedSearch) || categorie.includes(normalizedSearch) || etat.includes(normalizedSearch);
    });
  }, [fournisseurs, search]);

  const reportYear = new Date().getFullYear();

  const mockReportingBySupplierId = useMemo(() => {
    // TODO: remplacer ce mock par une vue Supabase de reporting fournisseurs.
    return fournisseurs.reduce<
      Record<
        string,
        {
          total_achats_ht_annuel: number;
          taux_litige_retard: number;
          score_ponctualite: number;
          repartition_categories: Array<{
            label: string;
            part: number;
            color: string;
          }>;
        }
      >
    >((acc, fournisseur, index) => {
      const seed = fournisseur.nom.length * 17 + index * 31;
      const baseAnnual = 18000 + seed * 230 + toNumber(fournisseur.commandes_en_cours) * 950;
      const catA = 28 + (seed % 22);
      const catB = 18 + ((seed + 7) % 20);
      const catC = 12 + ((seed + 11) % 16);
      const catD = Math.max(8, 100 - catA - catB - catC);

      acc[fournisseur.id] = {
        total_achats_ht_annuel: baseAnnual,
        taux_litige_retard: 3 + (seed % 12),
        score_ponctualite: Math.max(72, 98 - (seed % 19)),
        repartition_categories: [
          { label: "Consommables", part: catA, color: "#4f46e5" },
          { label: "Materiel", part: catB, color: "#0ea5e9" },
          { label: "Packaging", part: catC, color: "#22c55e" },
          { label: "Autres", part: catD, color: "#f59e0b" },
        ],
      };

      return acc;
    }, {});
  }, [fournisseurs]);

  const kpis = useMemo(() => {
    const totalArticles = catalogue.length;
    const ruptureCount = catalogue.filter((article) => toNumber(article.stock_actuel) <= 0).length;
    const montantAchatHt = catalogue.reduce((sum, article) => sum + toNumber(article.prix_achat_ht), 0);

    return {
      totalArticles,
      ruptureCount,
      montantAchatHt,
      suggestionsCount: suggestions.length,
    };
  }, [catalogue, suggestions]);

  const reportingKpis = useMemo(() => {
    if (!selectedFournisseur) {
      return null;
    }

    const mock = mockReportingBySupplierId[selectedFournisseur.id];
    if (!mock) {
      return null;
    }

    const commandesAnnee = commandes.filter((commande) => {
      const rawDate = commande.date_commande || commande.created_at;
      if (!rawDate) return false;

      const year = new Date(rawDate).getFullYear();
      return Number.isFinite(year) && year === reportYear;
    });

    const totalAchatsReels = commandesAnnee.reduce((sum, commande) => sum + toNumber(commande.total_ht), 0);
    const commandesEnCours = commandes.filter((commande) => commande.statut !== "Recu").length;
    const commandesRecues = commandes.filter((commande) => commande.statut === "Recu").length;

    return {
      totalAchatsHtAnnuel: totalAchatsReels > 0 ? totalAchatsReels : mock.total_achats_ht_annuel,
      commandesEnCours: commandesEnCours || selectedFournisseur.commandes_en_cours,
      commandesRecues,
      tauxLitigeRetard: mock.taux_litige_retard,
      scorePonctualite: mock.score_ponctualite,
      repartitionCategories: mock.repartition_categories,
    };
  }, [selectedFournisseur, mockReportingBySupplierId, commandes, reportYear]);

  const topFournisseurs = useMemo(() => {
    return fournisseurs
      .map((fournisseur) => {
        const mock = mockReportingBySupplierId[fournisseur.id];
        const isSelected = fournisseur.id === selectedFournisseurId;
        const totalAchatsSelection = isSelected ? reportingKpis?.totalAchatsHtAnnuel ?? 0 : 0;

        return {
          id: fournisseur.id,
          nom: fournisseur.nom,
          totalAchatsHt: totalAchatsSelection > 0 ? totalAchatsSelection : mock?.total_achats_ht_annuel ?? 0,
        };
      })
      .sort((a, b) => b.totalAchatsHt - a.totalAchatsHt)
      .slice(0, 3);
  }, [fournisseurs, mockReportingBySupplierId, selectedFournisseurId, reportingKpis]);

  const orderTotalHt = useMemo(() => {
    return orderLines.reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_achat_ht), 0);
  }, [orderLines]);

  const reloadSelectedSupplier = useCallback(async () => {
    if (!organisationId || !selectedFournisseurId) {
      setCatalogue([]);
      setCommandes([]);
      setSuggestions([]);
      return;
    }

    setLoadingDetails(true);
    setActionError(null);

    try {
      const [catalogueRows, commandesRows] = await Promise.all([
        getSupplierCatalog(organisationId, selectedFournisseurId),
        getSupplierOrders(organisationId, selectedFournisseurId),
      ]);

      setCatalogue(catalogueRows);
      setCommandes(commandesRows);

      if (selectedFournisseur?.mode_reappro_auto) {
        const suggestionRows = await checkAutoReorder({
          organisationId,
          fournisseurId: selectedFournisseurId,
        });
        setSuggestions(suggestionRows);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setLoadingDetails(false);
    }
  }, [organisationId, selectedFournisseurId, selectedFournisseur?.mode_reappro_auto]);

  useEffect(() => {
    void reloadSelectedSupplier();
  }, [reloadSelectedSupplier]);

  const openOrderFormWithPrefill = () => {
    const ruptureLines = buildPrefilledLinesFromRupture(catalogue);
    const fallbackLines = suggestions.map((suggestion) => ({
      article_id: suggestion.article_id,
      article_nom: suggestion.article_nom,
      sku_fournisseur: suggestion.sku_fournisseur,
      prix_achat_ht: suggestion.prix_achat_ht,
      quantite: suggestion.quantite_suggeree,
    }));

    const prefilledLines = ruptureLines.length > 0 ? ruptureLines : fallbackLines;

    if (prefilledLines.length === 0) {
      setInfoMessage("Aucun article en rupture ou sous seuil pour ce fournisseur.");
      setShowOrderForm(false);
      return;
    }

    setOrderLines(prefilledLines);
    setShowOrderForm(true);
    setInfoMessage("Formulaire pre-rempli avec les articles en rupture du fournisseur.");
  };

  const handleOneClickDraft = async () => {
    if (!organisationId || !selectedFournisseur) return;

    if (suggestions.length === 0) {
      setInfoMessage("Aucune suggestion de reapprovisionnement disponible.");
      return;
    }

    setActionState("oneClickDraft");
    setActionError(null);

    try {
      await createPurchaseOrderDraft({
        organisationId,
        fournisseurId: selectedFournisseur.id,
        source: "suggestion",
        lignes: suggestions.map((suggestion) => ({
          article_id: suggestion.article_id,
          article_nom: suggestion.article_nom,
          sku_fournisseur: suggestion.sku_fournisseur,
          prix_achat_ht: suggestion.prix_achat_ht,
          quantite: suggestion.quantite_suggeree,
        })),
      });

      setInfoMessage("Brouillon de bon de commande genere depuis les suggestions IA.");
      await reloadSelectedSupplier();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionState(null);
    }
  };

  const handleSubmitManualDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !selectedFournisseur) return;

    if (orderLines.length === 0) {
      setActionError("Ajoutez au moins un article dans le bon de commande.");
      return;
    }

    setActionState("manualDraft");
    setActionError(null);

    try {
      await createPurchaseOrderDraft({
        organisationId,
        fournisseurId: selectedFournisseur.id,
        source: "manuel",
        lignes: orderLines,
      });

      setShowOrderForm(false);
      setInfoMessage("Brouillon de bon de commande cree avec succes.");
      await reloadSelectedSupplier();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionState(null);
    }
  };

  const handleLinkArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !selectedFournisseur) return;

    if (!linkArticleId.trim()) {
      setActionError("Indiquez un article_id a lier.");
      return;
    }

    setActionState("linkArticle");
    setActionError(null);

    try {
      await linkArticleToSupplier({
        organisationId,
        fournisseurId: selectedFournisseur.id,
        articleId: linkArticleId.trim(),
        skuFournisseur: linkSku.trim() || undefined,
        prixAchatHt: linkPrix.trim() ? toNumber(linkPrix) : undefined,
      });

      setLinkArticleId("");
      setLinkSku("");
      setLinkPrix("");
      setInfoMessage("Article lie au fournisseur et mapping catalogue mis a jour.");
      await reloadSelectedSupplier();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionState(null);
    }
  };

  const updateOrderLine = (index: number, field: "quantite" | "prix_achat_ht", value: string) => {
    setOrderLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        if (field === "quantite") {
          return {
            ...line,
            quantite: Math.max(1, Math.floor(toNumber(value))),
          };
        }

        return {
          ...line,
          prix_achat_ht: Math.max(0, toNumber(value)),
        };
      }),
    );
  };

  const removeOrderLine = (index: number) => {
    setOrderLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  };

  if (loading) {
    return <section style={loadingCardStyle}>Chargement du module fournisseurs...</section>;
  }

  if (pageError) {
    return <section style={errorCardStyle}>Erreur: {pageError}</section>;
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Module Fournisseurs</h1>
          <p style={subtitleStyle}>Centralisez les achats, automatisez le reapprovisionnement et gardez le stock sous controle.</p>
        </div>
      </header>

      {infoMessage ? <div style={infoBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={errorBannerStyle}>{actionError}</div> : null}

      <div style={getDualPaneStyle(isCompactLayout)}>
        <aside style={leftPaneStyle}>
          <div style={leftPaneHeaderStyle}>
            <h2 style={paneTitleStyle}>Annuaire fournisseurs</h2>
            <p style={paneSubtitleStyle}>{fournisseurs.length} fournisseurs rattaches a votre organisation</p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher nom, categorie ou etat"
            style={searchInputStyle}
          />

          <div style={supplierListStyle}>
            {filteredFournisseurs.length === 0 ? (
              <div style={emptyStateStyle}>Aucun fournisseur ne correspond a votre recherche.</div>
            ) : (
              filteredFournisseurs.map((fournisseur) => {
                const isSelected = fournisseur.id === selectedFournisseurId;

                return (
                  <div
                    key={fournisseur.id}
                    style={getSupplierRowStyle(isSelected)}
                    onClick={() => {
                      setSelectedFournisseurId(fournisseur.id);
                      setMenuFournisseurId(null);
                    }}
                  >
                    <div style={supplierRowHeaderStyle}>
                      <p style={supplierNameStyle}>{fournisseur.nom}</p>
                      <button
                        type="button"
                        style={menuButtonStyle}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuFournisseurId((current) => (current === fournisseur.id ? null : fournisseur.id));
                        }}
                      >
                        ⋮
                      </button>
                    </div>

                    <p style={supplierCategoryStyle}>{fournisseur.categorie_produits ?? "Categorie non renseignee"}</p>

                    <div style={supplierOrderStateRowStyle}>
                      <span style={supplierOrderStateStyle}>{fournisseur.etat_commandes_en_cours}</span>
                      <span style={supplierOrderCountStyle}>{fournisseur.commandes_en_cours}</span>
                    </div>

                    {menuFournisseurId === fournisseur.id ? (
                      <div style={supplierMenuStyle}>
                        <button
                          type="button"
                          style={menuActionStyle}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFournisseurId(fournisseur.id);
                            setMenuFournisseurId(null);
                          }}
                        >
                          Ouvrir la fiche
                        </button>
                        <button
                          type="button"
                          style={menuActionStyle}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFournisseurId(fournisseur.id);
                            setMenuFournisseurId(null);
                            setShowOrderForm(false);
                            setInfoMessage("Fournisseur selectionne. Ouvrez la fiche puis cliquez sur 'Passer une commande'.");
                          }}
                        >
                          Passer une commande
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section style={rightPaneStyle}>
          {!selectedFournisseur ? (
            <div style={emptySelectionStyle}>Selectionnez un fournisseur a gauche pour ouvrir sa fiche detaillee.</div>
          ) : (
            <>
              <article style={supplierCardStyle}>
                <div style={supplierCardTopStyle}>
                  <div>
                    <h2 style={supplierDetailTitleStyle}>{selectedFournisseur.nom}</h2>
                    <p style={supplierDetailCategoryStyle}>{selectedFournisseur.categorie_produits ?? "Categorie non renseignee"}</p>
                  </div>

                  <div style={supplierActionsStyle}>
                    <button type="button" style={primaryActionStyle} onClick={openOrderFormWithPrefill}>
                      Passer une commande
                    </button>
                  </div>
                </div>

                <div style={kpiGridStyle}>
                  <div style={kpiCardStyle}>
                    <span style={kpiLabelStyle}>Articles</span>
                    <strong style={kpiValueStyle}>{kpis.totalArticles}</strong>
                  </div>

                  <div style={kpiCardStyle}>
                    <span style={kpiLabelStyle}>Ruptures</span>
                    <strong style={kpiValueStyle}>{kpis.ruptureCount}</strong>
                  </div>

                  <div style={kpiCardStyle}>
                    <span style={kpiLabelStyle}>Prix achat moyen</span>
                    <strong style={kpiValueStyle}>{euroFormat.format(kpis.totalArticles > 0 ? kpis.montantAchatHt / kpis.totalArticles : 0)}</strong>
                  </div>

                  <div style={kpiCardStyle}>
                    <span style={kpiLabelStyle}>Delai moyen</span>
                    <strong style={kpiValueStyle}>{selectedFournisseur.delai_livraison_jours ?? 0} j</strong>
                  </div>
                </div>

                <div style={supplierInfoGridStyle}>
                  <div style={supplierInfoItemStyle}>
                    <span style={supplierInfoLabelStyle}>Contact</span>
                    <p style={supplierInfoValueStyle}>{selectedFournisseur.contact_nom ?? "Non renseigne"}</p>
                  </div>
                  <div style={supplierInfoItemStyle}>
                    <span style={supplierInfoLabelStyle}>Email</span>
                    <p style={supplierInfoValueStyle}>{selectedFournisseur.contact_email ?? "Non renseigne"}</p>
                  </div>
                  <div style={supplierInfoItemStyle}>
                    <span style={supplierInfoLabelStyle}>Telephone</span>
                    <p style={supplierInfoValueStyle}>{selectedFournisseur.telephone ?? "Non renseigne"}</p>
                  </div>
                  <div style={supplierInfoItemStyle}>
                    <span style={supplierInfoLabelStyle}>Franco de port HT</span>
                    <p style={supplierInfoValueStyle}>{euroFormat.format(toNumber(selectedFournisseur.franco_port_ht))}</p>
                  </div>
                  <div style={supplierInfoItemStyle}>
                    <span style={supplierInfoLabelStyle}>Auto-reappro</span>
                    <p style={supplierInfoValueStyle}>{selectedFournisseur.mode_reappro_auto ? "Automatique" : "Manuel"}</p>
                  </div>
                </div>
              </article>

              {reportingKpis ? (
                <div style={getReportingGridStyle(isCompactLayout)}>
                  <article style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>Statistiques globales</h3>
                    <p style={sectionSubtitleStyle}>Vue annuelle des achats et du risque fournisseur ({reportYear}).</p>

                    <div style={globalKpiGridStyle}>
                      <div style={globalKpiCardStyle}>
                        <span style={kpiLabelStyle}>Total Achats HT (Annuel)</span>
                        <strong style={kpiValueStyle}>{euroFormat.format(reportingKpis.totalAchatsHtAnnuel)}</strong>
                      </div>

                      <div style={globalKpiCardStyle}>
                        <span style={kpiLabelStyle}>Commandes en cours</span>
                        <strong style={kpiValueStyle}>{reportingKpis.commandesEnCours}</strong>
                      </div>

                      <div style={globalKpiCardStyle}>
                        <span style={kpiLabelStyle}>Commandes recues</span>
                        <strong style={kpiValueStyle}>{reportingKpis.commandesRecues}</strong>
                      </div>

                      <div style={globalKpiCardStyle}>
                        <span style={kpiLabelStyle}>Taux litige/retard</span>
                        <strong style={kpiValueStyle}>{formatPercent(reportingKpis.tauxLitigeRetard)}</strong>
                      </div>
                    </div>
                  </article>

                  <article style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>Repartition des categories</h3>
                    <p style={sectionSubtitleStyle}>Poids des familles produits les plus achetees.</p>

                    <div style={categoryChartListStyle}>
                      {reportingKpis.repartitionCategories.map((category) => {
                        const amountHt = (reportingKpis.totalAchatsHtAnnuel * category.part) / 100;
                        return (
                          <div key={category.label} style={categoryChartItemStyle}>
                            <div style={categoryChartRowStyle}>
                              <span style={categoryChartLabelStyle}>{category.label}</span>
                              <strong style={categoryChartValueStyle}>
                                {formatPercent(category.part)} - {euroFormat.format(amountHt)}
                              </strong>
                            </div>
                            <div style={categoryChartTrackStyle}>
                              <div style={getCategoryChartFillStyle(category.color, category.part)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>Top fournisseurs</h3>
                    <p style={sectionSubtitleStyle}>Classement des 3 meilleurs volumes d achat total HT.</p>

                    {topFournisseurs.length === 0 ? (
                      <p style={emptyInlineStyle}>Aucune donnee de ranking disponible.</p>
                    ) : (
                      <div style={topSupplierListStyle}>
                        {topFournisseurs.map((supplier, index) => (
                          <div key={supplier.id} style={topSupplierItemStyle}>
                            <div style={topSupplierIdentityStyle}>
                              <span style={topSupplierRankStyle}>{index + 1}</span>
                              <div>
                                <p style={topSupplierNameStyle}>{supplier.nom}</p>
                                <p style={topSupplierVolumeStyle}>{euroFormat.format(supplier.totalAchatsHt)}</p>
                              </div>
                            </div>
                            {supplier.id === selectedFournisseurId ? <span style={topSupplierBadgeStyle}>Actif</span> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>

                  <article style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>Suivi de livraison</h3>
                    <p style={sectionSubtitleStyle}>Score de ponctualite moyen du fournisseur selectionne.</p>

                    <div style={deliveryScoreHeaderStyle}>
                      <strong style={deliveryScoreValueStyle}>{formatPercent(reportingKpis.scorePonctualite)}</strong>
                      <span style={deliveryScoreTagStyle}>Ponctualite</span>
                    </div>
                    <div style={deliveryProgressTrackStyle}>
                      <div style={getDeliveryProgressFillStyle(reportingKpis.scorePonctualite)} />
                    </div>
                    <p style={deliveryScoreHintStyle}>{getPunctualityHint(reportingKpis.scorePonctualite)}</p>
                  </article>
                </div>
              ) : null}

              {selectedFournisseur.mode_reappro_auto ? (
                <article style={suggestionCardStyle}>
                  <div style={suggestionHeaderStyle}>
                    <div>
                      <h3 style={sectionTitleStyle}>Reapprovisionnement suggere</h3>
                      <p style={sectionSubtitleStyle}>
                        {kpis.suggestionsCount > 0
                          ? `${kpis.suggestionsCount} article(s) sous seuil. Generer un brouillon en 1 clic.`
                          : "Aucune alerte sous seuil sur ce fournisseur."}
                      </p>
                    </div>
                    <button
                      type="button"
                      style={getSuggestionButtonStyle(actionState === "oneClickDraft" || suggestions.length === 0)}
                      disabled={actionState === "oneClickDraft" || suggestions.length === 0}
                      onClick={handleOneClickDraft}
                    >
                      {actionState === "oneClickDraft" ? "Generation..." : "Generer le bon de commande en 1 clic"}
                    </button>
                  </div>

                  {suggestions.length > 0 ? (
                    <div style={suggestionListStyle}>
                      {suggestions.map((suggestion) => (
                        <div key={suggestion.article_id} style={suggestionItemStyle}>
                          <div>
                            <p style={suggestionItemTitleStyle}>{suggestion.article_nom}</p>
                            <p style={suggestionItemMetaStyle}>
                              SKU {suggestion.sku_fournisseur ?? "N/A"} - Stock {suggestion.stock_actuel} / Seuil {suggestion.seuil_alerte}
                            </p>
                          </div>
                          <div style={suggestionItemRightStyle}>
                            <span style={getUrgencyPillStyle(suggestion.urgence)}>{suggestion.urgence}</span>
                            <strong style={suggestedQtyStyle}>+{suggestion.quantite_suggeree}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ) : null}

              {showOrderForm ? (
                <form style={orderFormStyle} onSubmit={handleSubmitManualDraft}>
                  <div style={orderFormHeaderStyle}>
                    <div>
                      <h3 style={sectionTitleStyle}>Bon de commande pre-rempli</h3>
                      <p style={sectionSubtitleStyle}>Le formulaire contient les articles en rupture pour ce fournisseur.</p>
                    </div>
                    <button type="button" style={secondaryActionStyle} onClick={() => setShowOrderForm(false)}>
                      Fermer
                    </button>
                  </div>

                  <div style={orderLineListStyle}>
                    {orderLines.map((line, index) => (
                      <div key={`${line.article_id}-${index}`} style={orderLineItemStyle}>
                        <div style={orderLineNameWrapStyle}>
                          <p style={orderLineNameStyle}>{line.article_nom}</p>
                          <p style={orderLineSkuStyle}>SKU {line.sku_fournisseur ?? "N/A"}</p>
                        </div>

                        <label style={orderLineInputWrapStyle}>
                          <span style={orderLineInputLabelStyle}>Qt</span>
                          <input
                            type="number"
                            min={1}
                            value={line.quantite}
                            onChange={(event) => updateOrderLine(index, "quantite", event.target.value)}
                            style={lineInputStyle}
                          />
                        </label>

                        <label style={orderLineInputWrapStyle}>
                          <span style={orderLineInputLabelStyle}>PU HT</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.prix_achat_ht}
                            onChange={(event) => updateOrderLine(index, "prix_achat_ht", event.target.value)}
                            style={lineInputStyle}
                          />
                        </label>

                        <button type="button" style={removeLineButtonStyle} onClick={() => removeOrderLine(index)}>
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={orderFooterStyle}>
                    <strong style={orderTotalStyle}>Total HT: {euroFormat.format(orderTotalHt)}</strong>
                    <button
                      type="submit"
                      style={getPrimaryButtonStyle(actionState === "manualDraft")}
                      disabled={actionState === "manualDraft"}
                    >
                      {actionState === "manualDraft" ? "Creation..." : "Generer le brouillon"}
                    </button>
                  </div>
                </form>
              ) : null}

              <div style={getDetailGridStyle(isCompactLayout)}>
                <article style={sectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Catalogue rattache</h3>
                  <p style={sectionSubtitleStyle}>Articles relies avec prix d achat HT, SKU fournisseur et niveau de stock.</p>

                  {loadingDetails ? (
                    <p style={loadingInlineStyle}>Chargement du catalogue...</p>
                  ) : catalogue.length === 0 ? (
                    <p style={emptyInlineStyle}>Aucun article lie a ce fournisseur.</p>
                  ) : (
                    <div style={tableWrapStyle}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={tableHeadStyle}>Article</th>
                            <th style={tableHeadStyle}>SKU fournisseur</th>
                            <th style={tableHeadStyle}>Prix achat HT</th>
                            <th style={tableHeadStyle}>Stock</th>
                            <th style={tableHeadStyle}>Seuil alerte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalogue.map((row) => (
                            <tr key={row.id}>
                              <td style={tableCellStyle}>{row.article_nom ?? row.article_id}</td>
                              <td style={tableCellStyle}>{row.sku_fournisseur ?? "N/A"}</td>
                              <td style={tableCellStyle}>{euroFormat.format(toNumber(row.prix_achat_ht))}</td>
                              <td style={tableCellStyle}>{toNumber(row.stock_actuel)}</td>
                              <td style={tableCellStyle}>{toNumber(row.seuil_alerte)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>

                <article style={sectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Historique des commandes</h3>
                  <p style={sectionSubtitleStyle}>Suivi des bons de commande: Brouillon, Envoye, Recu.</p>

                  {loadingDetails ? (
                    <p style={loadingInlineStyle}>Chargement des commandes...</p>
                  ) : commandes.length === 0 ? (
                    <p style={emptyInlineStyle}>Aucune commande d achat sur ce fournisseur.</p>
                  ) : (
                    <div style={orderHistoryListStyle}>
                      {commandes.map((commande) => (
                        <div key={commande.id} style={orderHistoryItemStyle}>
                          <div>
                            <p style={orderHistoryRefStyle}>{commande.reference}</p>
                            <p style={orderHistoryMetaStyle}>
                              {formatDate(commande.date_commande || commande.created_at)} - {euroFormat.format(toNumber(commande.total_ht))}
                            </p>
                          </div>
                          <span style={getOrderStatusStyle(commande.statut)}>{commande.statut}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              <article style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>Lien stock-fournisseur</h3>
                <p style={sectionSubtitleStyle}>Associez un article de la table `articles` a ce fournisseur en conservant le SKU et le prix HT.</p>

                <form style={linkFormStyle} onSubmit={handleLinkArticle}>
                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>article_id</span>
                    <input
                      required
                      value={linkArticleId}
                      onChange={(event) => setLinkArticleId(event.target.value)}
                      placeholder="UUID article"
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>SKU fournisseur</span>
                    <input value={linkSku} onChange={(event) => setLinkSku(event.target.value)} placeholder="SKU externe" style={fieldInputStyle} />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Prix achat HT</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={linkPrix}
                      onChange={(event) => setLinkPrix(event.target.value)}
                      placeholder="0.00"
                      style={fieldInputStyle}
                    />
                  </label>

                  <button
                    type="submit"
                    style={getPrimaryButtonStyle(actionState === "linkArticle")}
                    disabled={actionState === "linkArticle"}
                  >
                    {actionState === "linkArticle" ? "Liaison..." : "Lier article -> fournisseur"}
                  </button>
                </form>
              </article>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Date inconnue";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";

  return date.toLocaleDateString("fr-FR");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const supabaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const lowerMessage = (supabaseError.message ?? "").toLowerCase();

    if (
      supabaseError.code === "42P01" ||
      supabaseError.code === "PGRST205" ||
      lowerMessage.includes("could not find the table 'public.fournisseurs'") ||
      lowerMessage.includes("could not find the table 'public.fournisseur_produits'") ||
      lowerMessage.includes("could not find the table 'public.commandes_achats'")
    ) {
      return "Les tables du module fournisseurs sont absentes. Lancez le script SQL `sql/create_fournisseurs_module.sql` puis rechargez.";
    }

    const message = [supabaseError.message, supabaseError.details, supabaseError.hint].filter(Boolean).join(" | ");
    if (message) {
      return message;
    }
  }

  return "Une erreur inattendue est survenue.";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function getPunctualityHint(score: number): string {
  if (score >= 95) {
    return "Excellent niveau de respect des delais de livraison.";
  }

  if (score >= 88) {
    return "Performance stable, quelques retards ponctuels detectes.";
  }

  return "Surveillez ce fournisseur: retards frequents sur les dernieres livraisons.";
}

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const headerStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "28px",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.08)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.45rem",
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0 0",
  color: "#cbd5e1",
  fontSize: "0.95rem",
};

const infoBannerStyle: React.CSSProperties = {
  borderRadius: "14px",
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  padding: "10px 12px",
  fontSize: "0.86rem",
  fontWeight: 700,
};

const errorBannerStyle: React.CSSProperties = {
  borderRadius: "14px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  padding: "10px 12px",
  fontSize: "0.86rem",
  fontWeight: 700,
};

const leftPaneStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 16px 32px -25px rgba(15, 23, 42, 0.28)",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: "720px",
};

const rightPaneStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 16px 32px -25px rgba(15, 23, 42, 0.28)",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const leftPaneHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const paneTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 900,
  color: "#0f172a",
};

const paneSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "0.8rem",
};

const searchInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "10px 12px",
  fontSize: "0.86rem",
  color: "#0f172a",
  outline: "none",
};

const supplierListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  overflowY: "auto",
  maxHeight: "620px",
  paddingRight: "4px",
};

const supplierRowBaseStyle: React.CSSProperties = {
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  cursor: "pointer",
  position: "relative",
};

const supplierRowSelectedStyle: React.CSSProperties = {
  background: "#eef2ff",
  border: "1px solid #818cf8",
};

const supplierRowHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px",
};

const supplierNameStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  color: "#0f172a",
  fontSize: "0.94rem",
};

const menuButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "1rem",
  lineHeight: 1,
  cursor: "pointer",
  padding: "2px 4px",
};

const supplierCategoryStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "0.8rem",
};

const supplierOrderStateRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const supplierOrderStateStyle: React.CSSProperties = {
  color: "#3730a3",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const supplierOrderCountStyle: React.CSSProperties = {
  minWidth: "26px",
  height: "26px",
  borderRadius: "13px",
  background: "#0f172a",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "0.74rem",
};

const supplierMenuStyle: React.CSSProperties = {
  marginTop: "4px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const menuActionStyle: React.CSSProperties = {
  border: "none",
  background: "#ffffff",
  color: "#0f172a",
  padding: "9px 11px",
  textAlign: "left",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
};

const supplierCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  borderRadius: "20px",
  padding: "18px",
  background: "linear-gradient(155deg, #f8fafc 0%, #eef2ff 100%)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const supplierCardTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const supplierDetailTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.2rem",
  fontWeight: 900,
};

const supplierDetailCategoryStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  color: "#475569",
  fontSize: "0.86rem",
};

const supplierActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const primaryActionStyle: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 14px",
  fontSize: "0.82rem",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryActionStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "9px 12px",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
};

const kpiCardStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "10px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "0.72rem",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const kpiValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "1.26rem",
  fontWeight: 900,
};

const supplierInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const supplierInfoItemStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #dbe3ee",
  background: "#ffffff",
  padding: "9px 10px",
};

const supplierInfoLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  color: "#64748b",
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const supplierInfoValueStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  color: "#0f172a",
  fontSize: "0.86rem",
  fontWeight: 700,
};

const suggestionCardStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const suggestionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1rem",
  fontWeight: 900,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  color: "#475569",
  fontSize: "0.82rem",
};

const suggestionListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const suggestionItemStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #c7d2fe",
  background: "#ffffff",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const suggestionItemTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 800,
  fontSize: "0.86rem",
};

const suggestionItemMetaStyle: React.CSSProperties = {
  margin: "2px 0 0 0",
  color: "#475569",
  fontSize: "0.78rem",
};

const suggestionItemRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
};

const suggestedQtyStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "0.92rem",
  fontWeight: 900,
};

const orderFormStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const orderFormHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
};

const orderLineListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const orderLineItemStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  padding: "8px",
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) 90px 120px auto",
  gap: "8px",
  alignItems: "center",
};

const orderLineNameWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const orderLineNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.83rem",
  fontWeight: 800,
  color: "#0f172a",
};

const orderLineSkuStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.74rem",
  color: "#64748b",
};

const orderLineInputWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const orderLineInputLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
};

const lineInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "7px 8px",
  fontSize: "0.8rem",
  color: "#0f172a",
};

const removeLineButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#fee2e2",
  color: "#b91c1c",
  borderRadius: "8px",
  padding: "7px 10px",
  fontSize: "0.76rem",
  fontWeight: 800,
  cursor: "pointer",
};

const orderFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
};

const orderTotalStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
  fontSize: "0.98rem",
};

const sectionCardStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "14px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const globalKpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "8px",
};

const globalKpiCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  borderRadius: "14px",
  background: "linear-gradient(155deg, #ffffff 0%, #f8fafc 100%)",
  padding: "11px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const categoryChartListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const categoryChartItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const categoryChartRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "baseline",
};

const categoryChartLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const categoryChartValueStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "0.76rem",
  fontWeight: 700,
};

const categoryChartTrackStyle: React.CSSProperties = {
  width: "100%",
  height: "10px",
  borderRadius: "999px",
  background: "#e2e8f0",
  overflow: "hidden",
};

const topSupplierListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const topSupplierItemStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const topSupplierIdentityStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
};

const topSupplierRankStyle: React.CSSProperties = {
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #0f172a 0%, #312e81 100%)",
  color: "#ffffff",
  fontSize: "0.72rem",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const topSupplierNameStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const topSupplierVolumeStyle: React.CSSProperties = {
  margin: "2px 0 0 0",
  color: "#64748b",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const topSupplierBadgeStyle: React.CSSProperties = {
  borderRadius: "999px",
  padding: "4px 9px",
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: "0.7rem",
  fontWeight: 800,
};

const deliveryScoreHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const deliveryScoreValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "1.24rem",
  fontWeight: 900,
};

const deliveryScoreTagStyle: React.CSSProperties = {
  borderRadius: "999px",
  padding: "4px 10px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const deliveryProgressTrackStyle: React.CSSProperties = {
  width: "100%",
  height: "12px",
  borderRadius: "999px",
  background: "#e2e8f0",
  overflow: "hidden",
};

const deliveryScoreHintStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "0.78rem",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeadStyle: React.CSSProperties = {
  textAlign: "left",
  color: "#64748b",
  fontSize: "0.74rem",
  textTransform: "uppercase",
  fontWeight: 800,
  paddingBottom: "8px",
  borderBottom: "1px solid #e2e8f0",
};

const tableCellStyle: React.CSSProperties = {
  padding: "8px 0",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
  fontSize: "0.84rem",
};

const orderHistoryListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const orderHistoryItemStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const orderHistoryRefStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.82rem",
  color: "#0f172a",
  fontWeight: 800,
};

const orderHistoryMetaStyle: React.CSSProperties = {
  margin: "3px 0 0 0",
  fontSize: "0.76rem",
  color: "#64748b",
};

const linkFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(200px, 1fr) minmax(140px, 1fr) minmax(120px, 1fr) auto",
  gap: "8px",
  alignItems: "end",
};

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
};

const fieldInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px 10px",
  fontSize: "0.82rem",
};

const loadingCardStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  padding: "22px",
  color: "#334155",
  fontWeight: 700,
};

const errorCardStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  padding: "22px",
  color: "#b91c1c",
  fontWeight: 700,
};

const emptySelectionStyle: React.CSSProperties = {
  borderRadius: "20px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  minHeight: "220px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#475569",
  fontSize: "0.92rem",
  padding: "20px",
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "0.8rem",
  padding: "12px",
};

const loadingInlineStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const emptyInlineStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "0.82rem",
};

function getDualPaneStyle(isCompactLayout: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(300px, 360px) 1fr",
    alignItems: "start",
  };
}

function getDetailGridStyle(isCompactLayout: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: isCompactLayout ? "1fr" : "1.2fr 1fr",
  };
}

function getReportingGridStyle(isCompactLayout: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: isCompactLayout ? "1fr" : "1fr 1fr",
  };
}

function getSupplierRowStyle(isSelected: boolean): React.CSSProperties {
  return isSelected ? { ...supplierRowBaseStyle, ...supplierRowSelectedStyle } : supplierRowBaseStyle;
}

function getSuggestionButtonStyle(disabled: boolean): React.CSSProperties {
  if (disabled) {
    return {
      border: "none",
      background: "#cbd5e1",
      color: "#475569",
      borderRadius: "12px",
      padding: "10px 12px",
      fontSize: "0.8rem",
      fontWeight: 800,
      cursor: "not-allowed",
    };
  }

  return {
    border: "none",
    background: "linear-gradient(135deg, #4338ca, #312e81)",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "0.8rem",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function getUrgencyPillStyle(urgence: "Rupture" | "Alerte"): React.CSSProperties {
  if (urgence === "Rupture") {
    return {
      borderRadius: "999px",
      padding: "3px 10px",
      background: "#fee2e2",
      color: "#b91c1c",
      fontSize: "0.7rem",
      fontWeight: 800,
    };
  }

  return {
    borderRadius: "999px",
    padding: "3px 10px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "0.7rem",
    fontWeight: 800,
  };
}

function getOrderStatusStyle(status: PurchaseOrderStatus): React.CSSProperties {
  if (status === "Recu") {
    return {
      borderRadius: "999px",
      padding: "4px 10px",
      background: "#dcfce7",
      color: "#166534",
      fontSize: "0.74rem",
      fontWeight: 800,
    };
  }

  if (status === "Envoye") {
    return {
      borderRadius: "999px",
      padding: "4px 10px",
      background: "#dbeafe",
      color: "#1e40af",
      fontSize: "0.74rem",
      fontWeight: 800,
    };
  }

  return {
    borderRadius: "999px",
    padding: "4px 10px",
    background: "#ede9fe",
    color: "#5b21b6",
    fontSize: "0.74rem",
    fontWeight: 800,
  };
}

function getCategoryChartFillStyle(color: string, part: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, part))}%`,
    height: "100%",
    borderRadius: "999px",
    background: `linear-gradient(120deg, ${color} 0%, #0f172a 180%)`,
  };
}

function getDeliveryProgressFillStyle(score: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, score))}%`,
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(120deg, #22c55e 0%, #2563eb 100%)",
  };
}

function getPrimaryButtonStyle(disabled: boolean): React.CSSProperties {
  if (disabled) {
    return {
      border: "none",
      background: "#cbd5e1",
      color: "#475569",
      borderRadius: "12px",
      padding: "10px 14px",
      fontSize: "0.8rem",
      fontWeight: 800,
      cursor: "not-allowed",
      height: "38px",
    };
  }

  return {
    border: "none",
    background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "0.8rem",
    fontWeight: 800,
    cursor: "pointer",
    height: "38px",
  };
}
