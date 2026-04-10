import { supabase } from "../utils/supabase";

export type ClientSource = "Shopify" | "Amazon" | "Site";
export type ClientStatus = "VIP" | "Actif" | "A relancer" | "Inactif";

export type ClientRow = {
  id: string;
  organisation_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  source: ClientSource;
  status: ClientStatus;
  segment: string | null;
  orders_count: number | null;
  average_basket: number | null;
  total_spent: number | null;
  last_order_date: string | null;
  churn_risk: number | null;
  next_actions: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateClientPayload = {
  organisationId: string;
  fullName: string;
  email: string;
  phone?: string;
  source: ClientSource;
  status: ClientStatus;
  segment?: string;
  ordersCount?: number;
  averageBasket?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  churnRisk?: number;
  nextActions?: string[];
};

export async function getClientsByOrganisation(organisationId: string): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClientRow[];
}

export async function createClient(payload: CreateClientPayload): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .insert([
      {
        organisation_id: payload.organisationId,
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || null,
        source: payload.source,
        status: payload.status,
        segment: payload.segment?.trim() || "Non defini",
        orders_count: payload.ordersCount ?? 0,
        average_basket: payload.averageBasket ?? 0,
        total_spent: payload.totalSpent ?? 0,
        last_order_date: payload.lastOrderDate || null,
        churn_risk: payload.churnRisk ?? 0,
        next_actions: payload.nextActions ?? [],
      },
    ])
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ClientRow;
}
