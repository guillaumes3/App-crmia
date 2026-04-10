import { supabase } from "../utils/supabase";

export type PlanCode = "STARTER" | "PRO" | "ENTERPRISE";
export type OrganisationStatus = "actif" | "suspendu";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export const PLAN_PRICES: Record<PlanCode, number> = {
  STARTER: 29,
  PRO: 79,
  ENTERPRISE: 199,
};

export type OrganisationRow = {
  id: string;
  nom: string;
  plan: PlanCode | null;
  statut: OrganisationStatus | null;
  maintenance_mode: boolean | null;
  billing_email: string | null;
  owner_name: string | null;
  owner_email: string | null;
  seat_count: number | null;
  trial_ends_at: string | null;
  last_seen_at: string | null;
  temp_access_code: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type BillingInvoiceRow = {
  id: string;
  organisation_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount_ht: number;
  tax_rate: number;
  amount_ttc: number;
  status: InvoiceStatus;
  external_ref: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformVolume = {
  clients: number | null;
  produits: number | null;
  profiles: number | null;
};

export async function fetchOrganisations(): Promise<OrganisationRow[]> {
  const { data, error } = await supabase
    .from("organisations")
    .select(
      "id, nom, plan, statut, maintenance_mode, billing_email, owner_name, owner_email, seat_count, trial_ends_at, last_seen_at, temp_access_code, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrganisationRow[];
}

export async function updateOrganisationPlan(id: string, plan: PlanCode): Promise<void> {
  const { error } = await supabase.from("organisations").update({ plan }).eq("id", id);
  if (error) throw error;
}

export async function updateOrganisationStatus(id: string, status: OrganisationStatus): Promise<void> {
  const { error } = await supabase.from("organisations").update({ statut: status }).eq("id", id);
  if (error) throw error;
}

export async function updateOrganisationMaintenance(id: string, maintenanceMode: boolean): Promise<void> {
  const { error } = await supabase.from("organisations").update({ maintenance_mode: maintenanceMode }).eq("id", id);
  if (error) throw error;
}

export async function updateOrganisationOwner(
  id: string,
  payload: { ownerName?: string; ownerEmail?: string; billingEmail?: string },
): Promise<void> {
  const { error } = await supabase
    .from("organisations")
    .update({
      owner_name: payload.ownerName ?? null,
      owner_email: payload.ownerEmail ?? null,
      billing_email: payload.billingEmail ?? payload.ownerEmail ?? null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function removeOrganisation(id: string): Promise<void> {
  const { error } = await supabase.from("organisations").delete().eq("id", id);
  if (error) throw error;
}

export async function requestTemporaryAccessCode(id: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { error } = await supabase.from("organisations").update({ temp_access_code: code }).eq("id", id);
  if (error) throw error;
  return code;
}

export async function clearTemporaryAccessCode(id: string): Promise<void> {
  const { error } = await supabase.from("organisations").update({ temp_access_code: null }).eq("id", id);
  if (error) throw error;
}

export async function fetchBillingInvoices(): Promise<BillingInvoiceRow[]> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BillingInvoiceRow[];
}

export async function createBillingInvoice(input: {
  organisationId: string;
  amountHt: number;
  taxRate?: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): Promise<BillingInvoiceRow> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .insert([
      {
        organisation_id: input.organisationId,
        amount_ht: input.amountHt,
        tax_rate: input.taxRate ?? 20,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        due_date: input.dueDate,
        status: "pending",
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data as BillingInvoiceRow;
}

export async function markInvoiceAsPaid(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from("billing_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (error) throw error;
}

export async function markInvoiceAsPending(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from("billing_invoices")
    .update({ status: "pending", paid_at: null })
    .eq("id", invoiceId);

  if (error) throw error;
}

export async function sendOrganisationAdminInvite(input: {
  email: string;
  organisationId: string;
  ownerName: string;
}): Promise<void> {
  const { error } = await supabase.auth.admin.inviteUserByEmail(input.email, {
    data: {
      organisation_id: input.organisationId,
      role: "Administrateur",
      nom: input.ownerName,
      nom_complet: input.ownerName,
      autorisations: "Global",
    },
  });

  if (error) throw error;
}

export async function fetchPlatformVolumes(): Promise<PlatformVolume> {
  const [clients, produits, profiles] = await Promise.all([
    getTableCount("clients"),
    getTableCount("produits"),
    getTableCount("profiles"),
  ]);

  return {
    clients,
    produits,
    profiles,
  };
}

async function getTableCount(tableName: string): Promise<number | null> {
  const { count, error } = await supabase.from(tableName).select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}
