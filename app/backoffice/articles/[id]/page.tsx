"use client";

import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";
import { supabase } from "@/utils/supabase";

interface ArticleDetailRow {
  id: string;
  organisation_id: string;
  nom: string;
  ean: string;
  reference_interne: string;
  prix_ht: number;
  prix_achat_ht: number;
  marge: number;
  seuil_alerte: number;
  stock_disponible: number;
  stock_bloque: number;
  stock_sav: number;
  quantite_actuelle: number;
  fournisseur_id: string | null;
  location_id: string | null;
  mode_reappro_auto: boolean;
  seuil_reappro_auto: number;
  prix_promotionnel: number;
  promotion_date_debut: string;
  promotion_date_fin: string;
  description: string;
}

interface ReferenceOption {
  id: string;
  nom: string;
}

type StockTarget = "stock_disponible" | "stock_bloque" | "stock_sav";

export default function DetailArticle({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  const [organisationId, setOrganisationId] = useState("");
  const [article, setArticle] = useState<ArticleDetailRow | null>(null);
  const [locations, setLocations] = useState<ReferenceOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<ReferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const [nom, setNom] = useState("");
  const [ean, setEan] = useState("");
  const [referenceInterne, setReferenceInterne] = useState("");
  const [prixHt, setPrixHt] = useState("0");
  const [marge, setMarge] = useState("0");
  const [seuilAlerte, setSeuilAlerte] = useState("0");
  const [stockDisponible, setStockDisponible] = useState("0");
  const [stockBloque, setStockBloque] = useState("0");
  const [stockSav, setStockSav] = useState("0");
  const [fournisseurId, setFournisseurId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [reapproAutoEnabled, setReapproAutoEnabled] = useState(false);
  const [reapproThreshold, setReapproThreshold] = useState("0");
  const [promoPrice, setPromoPrice] = useState("0");
  const [promoStartDate, setPromoStartDate] = useState("");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [description, setDescription] = useState("");

  const [isRectifyOpen, setIsRectifyOpen] = useState(false);
  const [rectifyTarget, setRectifyTarget] = useState<StockTarget>("stock_disponible");
  const [rectifyDelta, setRectifyDelta] = useState("0");
  const [rectifyReason, setRectifyReason] = useState("Rectification inventaire");
  const [rectifying, setRectifying] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  const loadReferenceData = useCallback(async (orgId: string) => {
    const { data: fournisseursData, error: fournisseursError } = await supabase
      .from("fournisseurs")
      .select("id, nom")
      .eq("organisation_id", orgId)
      .order("nom", { ascending: true });

    if (fournisseursError && !isMissingRelationError(fournisseursError.message)) {
      throw new Error(fournisseursError.message);
    }

    const mappedFournisseurs = mapReferenceRows(fournisseursData);

    const { data: locationsData, error: locationsError } = await supabase
      .from("locations")
      .select("id, nom")
      .eq("organisation_id", orgId)
      .order("nom", { ascending: true });

    if (!locationsError) {
      setLocations(mapReferenceRows(locationsData));
    } else if (isMissingRelationError(locationsError.message)) {
      const { data: emplacementsData, error: emplacementsError } = await supabase
        .from("emplacements")
        .select("id, nom")
        .eq("organisation_id", orgId)
        .order("nom", { ascending: true });

      if (emplacementsError && !isMissingRelationError(emplacementsError.message)) {
        throw new Error(emplacementsError.message);
      }

      setLocations(mapReferenceRows(emplacementsData));
    } else {
      throw new Error(locationsError.message);
    }

    setFournisseurs(mappedFournisseurs);
  }, []);

  const loadArticle = useCallback(async (orgId: string, articleId: string) => {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("organisation_id", orgId)
      .eq("id", articleId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Article introuvable pour cette organisation.");
    }

    setArticle(mapArticleRow(data));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setLoadingError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Session utilisateur introuvable.");
        }

        if (isKipiloteStaff(session.user)) {
          setActiveUniverse("hq");
          throw new Error("Acces staff HQ interdit sur le stock client.");
        }

        setActiveUniverse("client");
        const orgId = getOrganisationId(session.user);

        if (!orgId) {
          throw new Error("organisation_id manquant dans la session.");
        }

        if (!isMounted) {
          return;
        }

        setOrganisationId(orgId);
        await Promise.all([loadArticle(orgId, id), loadReferenceData(orgId)]);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadingError(getErrorMessage(error));
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
  }, [id, loadArticle, loadReferenceData]);

  useEffect(() => {
    if (!article) {
      return;
    }

    setNom(article.nom);
    setEan(article.ean);
    setReferenceInterne(article.reference_interne);
    setPrixHt(String(article.prix_ht));
    setMarge(String(resolveMargeValue(article.prix_ht, article.prix_achat_ht, article.marge)));
    setSeuilAlerte(String(article.seuil_alerte));
    setStockDisponible(String(article.stock_disponible));
    setStockBloque(String(article.stock_bloque));
    setStockSav(String(article.stock_sav));
    setFournisseurId(article.fournisseur_id ?? "");
    setLocationId(article.location_id ?? "");
    setReapproAutoEnabled(article.mode_reappro_auto);
    setReapproThreshold(String(article.seuil_reappro_auto));
    setPromoPrice(String(article.prix_promotionnel));
    setPromoStartDate(article.promotion_date_debut);
    setPromoEndDate(article.promotion_date_fin);
    setDescription(article.description);
  }, [article]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!article || !organisationId) {
      return;
    }

    const prixHtNumber = Math.max(0, toNumber(prixHt));
    const promoPriceNumber = Math.max(0, toNumber(promoPrice));

    if (promoPriceNumber > 0 && promoPriceNumber >= prixHtNumber) {
      setActionError("Le prix promotionnel doit etre strictement inferieur au prix HT.");
      return;
    }

    if (promoStartDate && promoEndDate && promoStartDate > promoEndDate) {
      setActionError("La date de fin de promotion doit etre apres la date de debut.");
      return;
    }

    setSaving(true);
    setActionError(null);
    setInfoMessage(null);

    const payload = {
      prix_ht: prixHtNumber,
      marge: resolveMargeValue(prixHtNumber, article.prix_achat_ht, toNumber(marge)),
      seuil_alerte: Math.max(0, toNumber(seuilAlerte)),
      stock_disponible: Math.max(0, toNumber(stockDisponible)),
      stock_bloque: Math.max(0, toNumber(stockBloque)),
      stock_sav: Math.max(0, toNumber(stockSav)),
      quantite_actuelle: Math.max(0, toNumber(stockDisponible)),
      fournisseur_id: toNullableText(fournisseurId),
      location_id: toNullableText(locationId),
      emplacement_id: toNullableText(locationId),
      mode_reappro_auto: reapproAutoEnabled,
      seuil_reappro_auto: reapproAutoEnabled ? Math.max(0, toNumber(reapproThreshold)) : 0,
      prix_promotionnel: promoPriceNumber > 0 ? promoPriceNumber : null,
      promotion_date_debut: promoStartDate || null,
      promotion_date_fin: promoEndDate || null,
      description,
    };

    const { error } = await supabase
      .from("articles")
      .update(payload)
      .eq("organisation_id", organisationId)
      .eq("id", article.id);

    if (error) {
      setSaving(false);
      setActionError(error.message);
      return;
    }

    await loadArticle(organisationId, article.id);
    setSaving(false);
    setInfoMessage("Fiche article enregistree.");
  };

  const handleRectifyStock = async () => {
    if (!article || !organisationId) {
      return;
    }

    const delta = toNumber(rectifyDelta);
    if (delta === 0) {
      setActionError("Le mouvement doit etre different de 0.");
      return;
    }

    const currentDisponible = Math.max(0, toNumber(stockDisponible));
    const currentBloque = Math.max(0, toNumber(stockBloque));
    const currentSav = Math.max(0, toNumber(stockSav));

    const nextStocks = {
      stock_disponible: currentDisponible,
      stock_bloque: currentBloque,
      stock_sav: currentSav,
    };

    const nextTargetValue = toNumber(nextStocks[rectifyTarget]) + delta;
    if (nextTargetValue < 0) {
      setActionError("Le stock ne peut pas devenir negatif.");
      return;
    }

    nextStocks[rectifyTarget] = nextTargetValue;

    setRectifying(true);
    setActionError(null);
    setInfoMessage(null);

    const previousDisponible = currentDisponible;

    const { error } = await supabase
      .from("articles")
      .update({
        stock_disponible: nextStocks.stock_disponible,
        stock_bloque: nextStocks.stock_bloque,
        stock_sav: nextStocks.stock_sav,
        quantite_actuelle: nextStocks.stock_disponible,
      })
      .eq("organisation_id", organisationId)
      .eq("id", article.id);

    if (error) {
      setRectifying(false);
      setActionError(error.message);
      return;
    }

    const nextDisponible = nextStocks.stock_disponible;
    if (nextDisponible !== previousDisponible) {
      const { error: stockLogError } = await supabase.from("stock_logs").insert([
        {
          organisation_id: organisationId,
          article_id: article.id,
          old_quantite: previousDisponible,
          new_quantite: nextDisponible,
          delta_quantite: nextDisponible - previousDisponible,
          reason: rectifyReason.trim() || "Mouvement de stock",
        },
      ]);

      if (stockLogError) {
        // Non bloquant: certaines bases n'ont pas encore la table stock_logs.
      }
    }

    await loadArticle(organisationId, article.id);
    setRectifying(false);
    setRectifyDelta("0");
    setInfoMessage("Mouvement de stock enregistre.");
  };

  if (loading) {
    return <div style={loadingStyle}>Chargement...</div>;
  }

  if (loadingError) {
    return <div style={errorBannerStyle}>Erreur: {loadingError}</div>;
  }

  if (!article) {
    return <div style={errorBannerStyle}>Article introuvable.</div>;
  }

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Pilotage article</h1>
          <p style={pageSubtitleStyle}>{article.nom}</p>
        </div>
        <button onClick={() => window.location.assign("/backoffice/articles")} style={ghostButtonStyle}>
          Retour
        </button>
      </header>

      {infoMessage ? <div style={successBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={errorBannerStyle}>{actionError}</div> : null}

      <section style={kpiGridStyle}>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Marge</span>
          <strong style={kpiValueStyle}>{toNumber(marge).toFixed(2)}%</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Prix HT</span>
          <strong style={kpiValueStyle}>{toNumber(prixHt).toFixed(2)} EUR</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Stock disponible</span>
          <strong style={kpiValueStyle}>{stockDisponible} U.</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Seuil alerte</span>
          <strong style={kpiValueStyle}>{seuilAlerte} U.</strong>
        </article>
      </section>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Edition de la fiche produit</h2>

          <form style={formStyle} onSubmit={handleSave}>
            <label style={fieldLabelStyle} htmlFor="article-nom">
              Nom
            </label>
            <input id="article-nom" value={nom} disabled style={{ ...fieldInputStyle, ...readonlyInputStyle }} />

            <label style={fieldLabelStyle} htmlFor="article-ean">
              EAN
            </label>
            <input id="article-ean" value={ean} disabled style={{ ...fieldInputStyle, ...readonlyInputStyle }} />

            <label style={fieldLabelStyle} htmlFor="article-reference">
              Reference interne
            </label>
            <input id="article-reference" value={referenceInterne} disabled style={{ ...fieldInputStyle, ...readonlyInputStyle }} />

            <label style={fieldLabelStyle} htmlFor="article-prix-ht">
              Prix HT
            </label>
            <input
              id="article-prix-ht"
              type="number"
              min={0}
              step="0.01"
              value={prixHt}
              onChange={(event) => setPrixHt(event.target.value)}
              style={fieldInputStyle}
            />

            <label style={fieldLabelStyle} htmlFor="article-marge">
              Marge (%)
            </label>
            <input
              id="article-marge"
              type="number"
              min={0}
              step="0.01"
              value={marge}
              onChange={(event) => setMarge(event.target.value)}
              style={fieldInputStyle}
            />

            <label style={fieldLabelStyle} htmlFor="article-seuil">
              Seuil alerte
            </label>
            <input
              id="article-seuil"
              type="number"
              min={0}
              value={seuilAlerte}
              onChange={(event) => setSeuilAlerte(event.target.value)}
              style={fieldInputStyle}
            />

            <label style={fieldLabelStyle} htmlFor="article-location">
              Emplacement
            </label>
            <select
              id="article-location"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              style={fieldInputStyle}
            >
              <option value="">Aucun emplacement</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.nom}
                </option>
              ))}
            </select>

            <label style={fieldLabelStyle} htmlFor="article-fournisseur">
              Fournisseur
            </label>
            <div style={inlineActionFieldStyle}>
              <select
                id="article-fournisseur"
                value={fournisseurId}
                onChange={(event) => setFournisseurId(event.target.value)}
                style={{ ...fieldInputStyle, ...inlineActionMainStyle }}
              >
                <option value="">Aucun fournisseur</option>
                {fournisseurs.map((fournisseur) => (
                  <option key={fournisseur.id} value={fournisseur.id}>
                    {fournisseur.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={iconActionButtonStyle}
                onClick={() => window.location.assign("/backoffice/fournisseurs")}
                title="Creer un fournisseur"
              >
                +
              </button>
            </div>

            <label style={checkboxRowStyle} htmlFor="article-reappro-auto">
              <input
                id="article-reappro-auto"
                type="checkbox"
                checked={reapproAutoEnabled}
                onChange={(event) => setReapproAutoEnabled(event.target.checked)}
              />
              Reapprovisionnement automatique
            </label>

            <label style={fieldLabelStyle} htmlFor="article-reappro-seuil">
              Seuil de reappro auto
            </label>
            <input
              id="article-reappro-seuil"
              type="number"
              min={0}
              value={reapproThreshold}
              disabled={!reapproAutoEnabled}
              onChange={(event) => setReapproThreshold(event.target.value)}
              style={{ ...fieldInputStyle, ...(!reapproAutoEnabled ? readonlyInputStyle : {}) }}
            />

            <section style={moduleBoxStyle}>
              <h3 style={moduleTitleStyle}>Promotion</h3>

              <label style={fieldLabelStyle} htmlFor="promo-prix">
                Prix promotionnel
              </label>
              <input
                id="promo-prix"
                type="number"
                min={0}
                step="0.01"
                value={promoPrice}
                onChange={(event) => setPromoPrice(event.target.value)}
                style={fieldInputStyle}
              />

              <label style={fieldLabelStyle} htmlFor="promo-start-date">
                Date debut
              </label>
              <input
                id="promo-start-date"
                type="date"
                value={promoStartDate}
                onChange={(event) => setPromoStartDate(event.target.value)}
                style={fieldInputStyle}
              />

              <label style={fieldLabelStyle} htmlFor="promo-end-date">
                Date fin
              </label>
              <input
                id="promo-end-date"
                type="date"
                value={promoEndDate}
                onChange={(event) => setPromoEndDate(event.target.value)}
                style={fieldInputStyle}
              />
            </section>

            <div style={actionsRowStyle}>
              <button type="submit" style={primaryButtonStyle} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </article>

        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Stock & contenu</h2>

          <section style={stockBoxStyle}>
            <h3 style={moduleTitleStyle}>Qualites de stock</h3>
            <p style={stockLineStyle}>Disponible: {stockDisponible}</p>
            <p style={stockLineStyle}>Bloque: {stockBloque}</p>
            <p style={stockLineStyle}>SAV: {stockSav}</p>

            <button type="button" style={secondaryButtonStyle} onClick={() => setIsRectifyOpen((current) => !current)}>
              Rectifier le stock
            </button>

            {isRectifyOpen ? (
              <div style={rectifyPanelStyle}>
                <label style={fieldLabelStyle} htmlFor="rectify-target">
                  Type de stock
                </label>
                <select
                  id="rectify-target"
                  value={rectifyTarget}
                  onChange={(event) => setRectifyTarget(event.target.value as StockTarget)}
                  style={fieldInputStyle}
                >
                  <option value="stock_disponible">Stock disponible</option>
                  <option value="stock_bloque">Stock bloque</option>
                  <option value="stock_sav">Stock SAV</option>
                </select>

                <label style={fieldLabelStyle} htmlFor="rectify-delta">
                  Mouvement (+/-)
                </label>
                <input
                  id="rectify-delta"
                  type="number"
                  value={rectifyDelta}
                  onChange={(event) => setRectifyDelta(event.target.value)}
                  style={fieldInputStyle}
                />

                <label style={fieldLabelStyle} htmlFor="rectify-reason">
                  Motif
                </label>
                <input
                  id="rectify-reason"
                  value={rectifyReason}
                  onChange={(event) => setRectifyReason(event.target.value)}
                  style={fieldInputStyle}
                />

                <button type="button" style={primaryButtonStyle} onClick={() => void handleRectifyStock()} disabled={rectifying}>
                  {rectifying ? "Rectification..." : "Valider le mouvement"}
                </button>
              </div>
            ) : null}
          </section>

          <section style={moduleBoxStyle}>
            <h3 style={moduleTitleStyle}>Descriptif & SEO</h3>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={textAreaStyle} />
          </section>

          <section style={moduleBoxStyle}>
            <h3 style={moduleTitleStyle}>Assistant IA</h3>
            <p style={panelTextStyle}>Generez une fiche optimisee Amazon et Shopify pour harmoniser votre catalogue.</p>
            <button onClick={() => setDescription("Texte optimise pour Amazon et Shopify...")} style={primaryButtonStyle} type="button">
              Generer la fiche
            </button>
          </section>
        </article>
      </div>
    </div>
  );
}

function mapReferenceRows(value: unknown): ReferenceOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const source = row as Record<string, unknown>;
    const id = source.id;
    const nom = source.nom;

    if (typeof id !== "string" || typeof nom !== "string") {
      return [];
    }

    return [{ id, nom }];
  });
}

function mapArticleRow(value: unknown): ArticleDetailRow {
  if (!value || typeof value !== "object") {
    throw new Error("Format de fiche article invalide.");
  }

  const source = value as Record<string, unknown>;
  const id = source.id;
  const organisationId = source.organisation_id;
  const nom = source.nom;

  if (typeof id !== "string" || typeof organisationId !== "string" || typeof nom !== "string") {
    throw new Error("Article incomplet: id, organisation_id ou nom manquant.");
  }

  const prixHt = Math.max(0, toNumber(source.prix_ht ?? source.prix ?? 0));
  const prixAchatHt = Math.max(0, toNumber(source.prix_achat_ht ?? source.cout_ht ?? 0));

  return {
    id,
    organisation_id: organisationId,
    nom,
    ean: normalizeText(source.ean ?? source.code_barres),
    reference_interne: normalizeText(source.reference_interne ?? source.reference ?? source.sku),
    prix_ht: prixHt,
    prix_achat_ht: prixAchatHt,
    marge: resolveMargeValue(prixHt, prixAchatHt, toNumber(source.marge ?? 0)),
    seuil_alerte: Math.max(0, toNumber(source.seuil_alerte ?? source.seuil ?? source.min_stock ?? 0)),
    stock_disponible: Math.max(0, toNumber(source.stock_disponible ?? source.quantite_actuelle ?? source.stock ?? 0)),
    stock_bloque: Math.max(0, toNumber(source.stock_bloque ?? source.stock_bloquee ?? source.stock_bloqué ?? 0)),
    stock_sav: Math.max(0, toNumber(source.stock_sav ?? 0)),
    quantite_actuelle: Math.max(0, toNumber(source.quantite_actuelle ?? source.stock_disponible ?? source.stock ?? 0)),
    fournisseur_id: toNullableText(source.fournisseur_id),
    location_id: toNullableText(source.location_id ?? source.emplacement_id),
    mode_reappro_auto: toBoolean(source.mode_reappro_auto),
    seuil_reappro_auto: Math.max(0, toNumber(source.seuil_reappro_auto ?? source.seuil_reapprovisionnement ?? 0)),
    prix_promotionnel: Math.max(0, toNumber(source.prix_promotionnel ?? source.prix_promo ?? 0)),
    promotion_date_debut: normalizeDate(source.promotion_date_debut ?? source.promo_date_debut),
    promotion_date_fin: normalizeDate(source.promotion_date_fin ?? source.promo_date_fin),
    description: normalizeText(source.description),
  };
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.slice(0, 10);
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function resolveMargeValue(prixHt: number, prixAchatHt: number, fallbackMarge: number): number {
  if (prixHt > 0 && prixAchatHt > 0 && prixHt > prixAchatHt) {
    const ratio = ((prixHt - prixAchatHt) / prixHt) * 100;
    return Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : 0;
  }

  return Math.max(0, fallbackMarge);
}

function isMissingRelationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("relation") ||
    normalized.includes("could not find the table")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue.";
}

const cardShadow = "0 16px 32px -25px rgba(15, 23, 42, 0.28)";
const actionGradient = "linear-gradient(135deg, #4338ca 0%, #312e81 100%)";

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const loadingStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const pageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "1.52rem",
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontWeight: 600,
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.35)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
};

const kpiCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  background: "#ffffff",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  boxShadow: cardShadow,
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 800,
  fontSize: "0.72rem",
};

const kpiValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(360px, 1fr) 0.9fr",
  gap: "16px",
});

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  background: "#ffffff",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 900,
};

const panelTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "0.88rem",
  outline: "none",
};

const readonlyInputStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#475569",
  cursor: "not-allowed",
};

const inlineActionFieldStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const inlineActionMainStyle: React.CSSProperties = {
  flex: 1,
};

const iconActionButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#e0e7ff",
  color: "#312e81",
  fontWeight: 900,
  fontSize: "1rem",
  cursor: "pointer",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#334155",
  fontWeight: 700,
  fontSize: "0.84rem",
};

const moduleBoxStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  background: "#f8fafc",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const stockBoxStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "16px",
  background: "#f8fafc",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const stockLineStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 700,
};

const moduleTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 900,
  fontSize: "0.95rem",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "0.88rem",
  outline: "none",
  resize: "vertical",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: actionGradient,
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
  width: "fit-content",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  width: "fit-content",
};

const actionsRowStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  justifyContent: "flex-end",
};

const rectifyPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const successBannerStyle: React.CSSProperties = {
  background: "#d1fae5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
  borderRadius: "16px",
  padding: "10px 12px",
  fontWeight: 700,
};

const errorBannerStyle: React.CSSProperties = {
  background: "#ffe4e6",
  color: "#9f1239",
  border: "1px solid #fecdd3",
  borderRadius: "16px",
  padding: "10px 12px",
  fontWeight: 700,
};
