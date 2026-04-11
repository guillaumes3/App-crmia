import type { SupabaseClient } from "@supabase/supabase-js";

export type HqProfileLookupRow = {
  id: string | number;
  role_hq: string | null;
  is_hq_staff: boolean | null;
  nom?: string | null;
  prenom?: string | null;
};

type LookupIdentity = {
  userId: string;
  email?: string | null;
};

type QueryResult = {
  data: HqProfileLookupRow | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

export async function findHqProfileByIdentity(
  supabase: SupabaseClient,
  identity: LookupIdentity,
): Promise<HqProfileLookupRow | null> {
  const selectFields = "id, role_hq, is_hq_staff, nom, prenom";

  const attempts: Array<() => Promise<QueryResult>> = [
    async () => await supabase.from("profiles").select(selectFields).eq("id", identity.userId).maybeSingle<HqProfileLookupRow>(),
    async () =>
      await supabase
        .from("profiles")
        .select(selectFields)
        .eq("user_id", identity.userId)
        .maybeSingle<HqProfileLookupRow>(),
    async () =>
      await supabase
        .from("profiles")
        .select(selectFields)
        .eq("auth_user_id", identity.userId)
        .maybeSingle<HqProfileLookupRow>(),
  ];

  if (identity.email) {
    attempts.push(async () =>
      await supabase
        .from("profiles")
        .select(selectFields)
        .ilike("email", identity.email ?? "")
        .maybeSingle<HqProfileLookupRow>(),
    );
  }

  for (const attempt of attempts) {
    const { data, error } = await attempt();
    if (data) return data;
    if (error && !isRecoverableLookupError(error)) return null;
  }

  return null;
}

function isRecoverableLookupError(error: { code?: string; message?: string }) {
  const raw = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return raw.includes("22p02") || raw.includes("42703") || raw.includes("column");
}
