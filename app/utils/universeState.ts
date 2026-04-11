export type UserUniverse = "hq" | "client";

const ACTIVE_UNIVERSE_KEY = "kipilote_active_universe";

const CLIENT_STATE_KEYS_TO_CLEAR: string[] = [
  "mes_produits",
  "impersonated_org_id",
  "maintenance_override",
  "maintenance_org_id",
];

const CLIENT_STATE_PATTERNS: RegExp[] = [/stock/i, /fournisseur/i, /supplier/i];

export function setActiveUniverse(nextUniverse: UserUniverse) {
  if (typeof window === "undefined") {
    return;
  }

  const previousUniverse = window.localStorage.getItem(ACTIVE_UNIVERSE_KEY);
  if (previousUniverse !== nextUniverse && nextUniverse === "hq") {
    clearClientScopedVisualState();
  }

  window.localStorage.setItem(ACTIVE_UNIVERSE_KEY, nextUniverse);
}

export function clearClientScopedVisualState() {
  if (typeof window === "undefined") {
    return;
  }

  const { localStorage } = window;

  CLIENT_STATE_KEYS_TO_CLEAR.forEach((key) => {
    localStorage.removeItem(key);
  });

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key) continue;

    if (CLIENT_STATE_PATTERNS.some((pattern) => pattern.test(key))) {
      localStorage.removeItem(key);
    }
  }
}
