import { supabase } from "@/app/utils/supabase";

export type PurchaseOrderStatus = "Brouillon" | "Envoye" | "Recu";

export type SupplierRow = {
  id: string;
  organisation_id: string;
  nom: string;
  categorie_produits: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  telephone: string | null;
  franco_port_ht: number | null;
  delai_livraison_jours: number | null;
  mode_reappro_auto: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type SupplierDirectoryRow = SupplierRow & {
  commandes_en_cours: number;
  etat_commandes_en_cours: string;
};

export type SupplierCatalogRow = {
  id: string;
  organisation_id: string;
  fournisseur_id: string;
  article_id: string;
  article_nom: string | null;
  stock_actuel: number | null;
  seuil_alerte: number | null;
  sku_fournisseur: string | null;
  prix_achat_ht: number | null;
  mode_reappro_auto: boolean | null;
};

export type PurchaseOrderRow = {
  id: string;
  organisation_id: string;
  fournisseur_id: string;
  reference: string;
  statut: PurchaseOrderStatus;
  total_ht: number | null;
  lignes: Array<{
    article_id: string;
    article_nom: string;
    quantite: number;
    prix_achat_ht: number;
    sku_fournisseur: string | null;
  }>;
  source: string | null;
  date_commande: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReorderSuggestion = {
  article_id: string;
  article_nom: string;
  sku_fournisseur: string | null;
  prix_achat_ht: number;
  stock_actuel: number;
  seuil_alerte: number;
  quantite_suggeree: number;
  urgence: "Rupture" | "Alerte";
};

export type DraftOrderLineInput = {
  article_id: string;
  article_nom: string;
  sku_fournisseur?: string | null;
  prix_achat_ht: number;
  quantite: number;
};

export async function getFournisseursByOrganisation(organisationId: string): Promise<SupplierDirectoryRow[]> {
  const { data: fournisseursData, error: fournisseursError } = await supabase
    .from("fournisseurs")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("nom", { ascending: true });

  if (fournisseursError) {
    throw toError(
      fournisseursError,
      "Impossible de charger les fournisseurs. Verifiez la table fournisseurs et vos policies RLS.",
    );
  }

  const fournisseurs = (fournisseursData ?? []) as SupplierRow[];

  const { data: commandesData, error: commandesError } = await supabase
    .from("commandes_achats")
    .select("fournisseur_id, statut")
    .eq("organisation_id", organisationId)
    .in("statut", ["Brouillon", "Envoye"]);

  if (commandesError) {
    throw toError(
      commandesError,
      "Impossible de charger les commandes d'achat fournisseurs.",
    );
  }

  const statusBySupplier = new Map<string, PurchaseOrderStatus[]>();

  (commandesData ?? []).forEach((commande: { fournisseur_id: string; statut: PurchaseOrderStatus }) => {
    const current = statusBySupplier.get(commande.fournisseur_id) ?? [];
    current.push(commande.statut);
    statusBySupplier.set(commande.fournisseur_id, current);
  });

  return fournisseurs.map((fournisseur) => {
    const statuses = statusBySupplier.get(fournisseur.id) ?? [];
    const etat = statuses.includes("Envoye")
      ? "Commande envoyee"
      : statuses.includes("Brouillon")
        ? "Brouillon en cours"
        : "Aucune commande en cours";

    return {
      ...fournisseur,
      commandes_en_cours: statuses.length,
      etat_commandes_en_cours: etat,
    };
  });
}

export async function getSupplierCatalog(organisationId: string, fournisseurId: string): Promise<SupplierCatalogRow[]> {
  const { data, error } = await supabase
    .from("v_fournisseur_articles")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("fournisseur_id", fournisseurId)
    .order("article_nom", { ascending: true });

  if (error) {
    throw toError(
      error,
      "Impossible de charger le catalogue du fournisseur.",
    );
  }

  return (data ?? []) as SupplierCatalogRow[];
}

export async function getSupplierOrders(organisationId: string, fournisseurId: string): Promise<PurchaseOrderRow[]> {
  const { data, error } = await supabase
    .from("commandes_achats")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("fournisseur_id", fournisseurId)
    .order("created_at", { ascending: false });

  if (error) {
    throw toError(
      error,
      "Impossible de charger l'historique des commandes fournisseurs.",
    );
  }

  return (data ?? []) as PurchaseOrderRow[];
}

export async function linkArticleToSupplier(payload: {
  organisationId: string;
  articleId: string;
  fournisseurId: string;
  skuFournisseur?: string;
  prixAchatHt?: number;
}) {
  const { error: articleError } = await supabase
    .from("articles")
    .update({ fournisseur_id: payload.fournisseurId })
    .eq("organisation_id", payload.organisationId)
    .eq("id", payload.articleId);

  if (articleError && isMissingRelationError(articleError)) {
    const { error: produitsError } = await supabase
      .from("produits")
      .update({ fournisseur_id: payload.fournisseurId })
      .eq("organisation_id", payload.organisationId)
      .eq("id", payload.articleId);

    if (produitsError) {
      throw produitsError;
    }
  } else if (articleError) {
    throw toError(
      articleError,
      "Impossible de lier l'article au fournisseur.",
    );
  }

  const { data, error } = await supabase
    .from("fournisseur_produits")
    .upsert(
      [
        {
          organisation_id: payload.organisationId,
          fournisseur_id: payload.fournisseurId,
          article_id: payload.articleId,
          sku_fournisseur: payload.skuFournisseur?.trim() || null,
          prix_achat_ht: payload.prixAchatHt ?? null,
        },
      ],
      { onConflict: "organisation_id,fournisseur_id,article_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw toError(
      error,
      "Impossible d'enregistrer le mapping fournisseur-produit.",
    );
  }

  return data;
}

export async function checkAutoReorder(params: {
  organisationId: string;
  fournisseurId?: string;
}): Promise<ReorderSuggestion[]> {
  let query = supabase
    .from("v_fournisseur_articles")
    .select("*")
    .eq("organisation_id", params.organisationId)
    .eq("mode_reappro_auto", true);

  if (params.fournisseurId) {
    query = query.eq("fournisseur_id", params.fournisseurId);
  }

  const { data, error } = await query;

  if (error) {
    throw toError(
      error,
      "Impossible de verifier les suggestions de reapprovisionnement automatique.",
    );
  }

  const rows = (data ?? []) as SupplierCatalogRow[];

  return rows
    .filter((item) => {
      const stockActuel = toNumber(item.stock_actuel);
      const seuilAlerte = toNumber(item.seuil_alerte);
      return seuilAlerte > 0 && stockActuel < seuilAlerte;
    })
    .map((item) => {
      const stockActuel = toNumber(item.stock_actuel);
      const seuilAlerte = toNumber(item.seuil_alerte);
      const quantiteSuggeree = Math.max(1, seuilAlerte * 2 - stockActuel);
      const urgence: ReorderSuggestion["urgence"] = stockActuel <= 0 ? "Rupture" : "Alerte";

      return {
        article_id: item.article_id,
        article_nom: item.article_nom ?? "Article sans nom",
        sku_fournisseur: item.sku_fournisseur,
        prix_achat_ht: toNumber(item.prix_achat_ht),
        stock_actuel: stockActuel,
        seuil_alerte: seuilAlerte,
        quantite_suggeree: quantiteSuggeree,
        urgence,
      };
    })
    .sort((a, b) => a.stock_actuel - b.stock_actuel);
}

export async function createPurchaseOrderDraft(payload: {
  organisationId: string;
  fournisseurId: string;
  lignes: DraftOrderLineInput[];
  source: "manuel" | "auto" | "suggestion";
}) {
  const validLines = payload.lignes
    .map((line) => ({
      article_id: line.article_id,
      article_nom: line.article_nom,
      quantite: Math.max(1, Math.floor(toNumber(line.quantite))),
      prix_achat_ht: toNumber(line.prix_achat_ht),
      sku_fournisseur: line.sku_fournisseur ?? null,
    }))
    .filter((line) => line.article_id && line.article_nom);

  if (validLines.length === 0) {
    throw new Error("Aucune ligne valide pour generer le bon de commande.");
  }

  const totalHt = validLines.reduce((sum, line) => sum + line.quantite * line.prix_achat_ht, 0);
  const reference = `BA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;

  const { data, error } = await supabase
    .from("commandes_achats")
    .insert([
      {
        organisation_id: payload.organisationId,
        fournisseur_id: payload.fournisseurId,
        reference,
        statut: "Brouillon",
        source: payload.source,
        total_ht: totalHt,
        lignes: validLines,
        date_commande: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error) {
    throw toError(
      error,
      "Impossible de creer le brouillon de bon de commande.",
    );
  }

  return data as PurchaseOrderRow;
}

export function buildPrefilledLinesFromRupture(catalogue: SupplierCatalogRow[]): DraftOrderLineInput[] {
  return catalogue
    .filter((item) => toNumber(item.stock_actuel) <= 0)
    .map((item) => {
      const seuil = Math.max(1, toNumber(item.seuil_alerte));

      return {
        article_id: item.article_id,
        article_nom: item.article_nom ?? "Article sans nom",
        sku_fournisseur: item.sku_fournisseur,
        prix_achat_ht: toNumber(item.prix_achat_ht),
        quantite: seuil,
      };
    });
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

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as { code?: string; message?: string };
  const message = (supabaseError.message ?? "").toLowerCase();

  return (
    supabaseError.code === "42P01" ||
    supabaseError.code === "PGRST205" ||
    message.includes("could not find the table 'public.articles'") ||
    message.includes("could not find the table 'public.produits'")
  );
}

function toError(error: unknown, fallbackMessage: string): Error {
  const normalized = normalizeSupabaseError(error, fallbackMessage);
  return new Error(normalized);
}

function normalizeSupabaseError(error: unknown, fallbackMessage: string): string {
  if (!error || typeof error !== "object") {
    return fallbackMessage;
  }

  const supabaseError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  const message = (supabaseError.message ?? "").toLowerCase();

  if (
    supabaseError.code === "42P01" ||
    supabaseError.code === "PGRST205" ||
    message.includes("could not find the table 'public.fournisseurs'") ||
    message.includes("could not find the table 'public.fournisseur_produits'") ||
    message.includes("could not find the table 'public.commandes_achats'")
  ) {
    return "Les tables du module fournisseurs n'existent pas encore. Executez `sql/create_fournisseurs_module.sql` dans Supabase puis rechargez.";
  }

  if (supabaseError.code === "42501") {
    return "Acces refuse par les policies RLS. Verifiez que l'utilisateur est bien rattache a l'organisation.";
  }

  const detailsMessage = [supabaseError.message, supabaseError.details, supabaseError.hint].filter(Boolean).join(" | ");
  return detailsMessage || fallbackMessage;
}
