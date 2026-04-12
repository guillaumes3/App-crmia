"use client";

import React, { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import Papa, { type ParseError } from "papaparse";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "../../../utils/supabase";

const MAX_ROWS = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU_REGEX = /^[A-Za-z0-9._-]{2,64}$/;

type ImportStage = "idle" | "parsing" | "validating" | "syncing" | "success" | "error";

interface ImportState {
  stage: ImportStage;
  message: string;
  percent: number;
}

interface CsvArticleRawRow {
  id?: string;
  sku?: string;
  nom?: string;
  quantite_actuelle?: string | number;
  seuil_alerte?: string | number;
}

interface ValidatedArticleRow {
  sourceRow: number;
  id?: string;
  sku?: string;
  nom: string;
  quantiteActuelle: number;
  seuilAlerte: number;
}

interface ExistingArticleRecord {
  id: string;
  sku?: string | null;
}

interface ArticleMutationPayload {
  id?: string;
  sku?: string;
  nom: string;
  quantite_actuelle: number;
  seuil_alerte: number;
  organisation_id: string;
}

export interface ImportSummary {
  created: number;
  updated: number;
  total: number;
}

export interface StockBulkImportProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId: string;
  disabled?: boolean;
  onImportComplete?: (summary: ImportSummary) => void;
}

interface SyncRowsParams {
  rows: ValidatedArticleRow[];
  organisationId: string;
  canUseSku: boolean;
  onProgress: (processed: number, total: number) => void;
}

export default function StockBulkImport({ isOpen, onClose, organisationId, disabled = false, onImportComplete }: StockBulkImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<ImportState>(initialImportState);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = importState.stage === "parsing" || importState.stage === "validating" || importState.stage === "syncing";

  const canImport = useMemo(() => {
    return !disabled && !isBusy && Boolean(selectedFile) && organisationId.length > 0;
  }, [disabled, isBusy, selectedFile, organisationId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setValidationErrors([]);
    setImportState(initialImportState);
  };

  const handleImport = async () => {
    if (!selectedFile || !organisationId) {
      return;
    }

    setValidationErrors([]);

    try {
      setImportState({ stage: "parsing", message: "Lecture du fichier CSV...", percent: 5 });
      const rawRows = await parseCsvFile(selectedFile);

      if (rawRows.length === 0) {
        throw new Error("Le fichier est vide.");
      }

      if (rawRows.length > MAX_ROWS) {
        throw new Error(`Le fichier contient ${rawRows.length} lignes. Maximum autorise: ${MAX_ROWS}.`);
      }

      setImportState({ stage: "validating", message: "Validation stricte des donnees...", percent: 20 });
      const rows = validateRows(rawRows);

      const canUseSku = await detectSkuColumn(organisationId);
      if (!canUseSku) {
        const rowsWithoutId = rows.filter((row) => !row.id);
        if (rowsWithoutId.length > 0) {
          throw new Error(
            "La colonne SKU n'existe pas dans la table articles. Ajoutez un id UUID pour chaque ligne ou ajoutez la colonne sku en base."
          );
        }
      }

      setImportState({ stage: "syncing", message: "Synchronisation en cours...", percent: 30 });

      const summary = await syncRows({
        rows,
        organisationId,
        canUseSku,
        onProgress: (processed, total) => {
          const percent = 30 + Math.round((processed / total) * 70);
          setImportState({ stage: "syncing", message: `Synchronisation ${processed}/${total}`, percent });
        },
      });

      setImportState({ stage: "success", message: `Import termine: ${summary.created} crees, ${summary.updated} mis a jour.`, percent: 100 });
      onImportComplete?.(summary);
    } catch (error) {
      const message = getErrorMessage(error);
      const lines = message
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      setValidationErrors(lines.slice(0, 8));
      setImportState({ stage: "error", message: lines[0] ?? "Erreur lors de l'import.", percent: 0 });
    }
  };

  const handleCancel = () => {
    if (isBusy) {
      return;
    }

    setSelectedFile(null);
    setValidationErrors([]);
    setImportState(initialImportState);
    setIsDragActive(false);
    onClose();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || isBusy) {
      return;
    }

    const file = event.dataTransfer.files?.[0] ?? null;
    setSelectedFile(file);
    setValidationErrors([]);
    setImportState(initialImportState);
    setIsDragActive(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || isBusy) {
      return;
    }
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Importation de stock">
      <section style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Importation de stock</h2>
            <p style={descriptionStyle}>
              Colonnes attendues: <code>id</code>, <code>sku</code>, <code>nom</code>, <code>quantite_actuelle</code>, <code>seuil_alerte</code>.
            </p>
          </div>
        </div>

        <div
          style={{ ...dropZoneStyle, ...(isDragActive ? dropZoneActiveStyle : {}), ...(disabled ? disabledControlStyle : {}) }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            if (!disabled && !isBusy) {
              fileInputRef.current?.click();
            }
          }}
        >
          <strong style={dropZoneTitleStyle}>Glissez-deposez votre fichier CSV ici</strong>
          <span style={dropZoneSubtitleStyle}>ou cliquez pour selectionner un fichier</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            onChange={handleFileChange}
            disabled={disabled || isBusy}
            style={hiddenInputStyle}
          />
        </div>

        <p style={fileInfoStyle}>{selectedFile ? `Fichier: ${selectedFile.name}` : "Aucun fichier selectionne"}</p>

        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${importState.percent}%` }} />
        </div>

        <p style={{ ...statusStyle, ...resolveStatusColor(importState.stage) }}>{importState.message}</p>

        {validationErrors.length > 0 ? (
          <div style={errorBoxStyle}>
            {validationErrors.map((error) => (
              <p key={error} style={errorLineStyle}>
                {error}
              </p>
            ))}
          </div>
        ) : null}

        <div style={controlsRowStyle}>
          <button type="button" onClick={handleCancel} disabled={isBusy} style={{ ...cancelButtonStyle, ...(isBusy ? disabledControlStyle : {}) }}>
            Annuler
          </button>
          <button type="button" onClick={handleImport} disabled={!canImport} style={{ ...importButtonStyle, ...(!canImport ? disabledControlStyle : {}) }}>
            Lancer l&apos;import
          </button>
        </div>
      </section>
    </div>
  );
}

async function syncRows({ rows, organisationId, canUseSku, onProgress }: SyncRowsParams): Promise<ImportSummary> {
  const ids = dedupe(rows.map((row) => row.id).filter((value): value is string => Boolean(value)));
  const skus = dedupe(rows.map((row) => row.sku).filter((value): value is string => Boolean(value)));

  const [existingById, existingBySku] = await Promise.all([
    loadExistingById(organisationId, ids),
    canUseSku ? loadExistingBySku(organisationId, skus) : Promise.resolve(new Map<string, ExistingArticleRecord>()),
  ]);

  let created = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const existing = resolveExistingRecord(row, existingById, existingBySku);

    const payload: ArticleMutationPayload = {
      nom: row.nom,
      quantite_actuelle: row.quantiteActuelle,
      seuil_alerte: row.seuilAlerte,
      organisation_id: organisationId,
    };

    if (canUseSku && row.sku) {
      payload.sku = row.sku;
    }

    if (existing) {
      const { error } = await supabase
        .from("articles")
        .update(payload)
        .eq("organisation_id", organisationId)
        .eq("id", existing.id);

      if (error) {
        throw new Error(`Ligne ${row.sourceRow}: ${error.message}`);
      }

      updated += 1;
    } else {
      if (row.id) {
        payload.id = row.id;
      }

      const { error } = await supabase.from("articles").insert([payload]);

      if (error) {
        throw new Error(`Ligne ${row.sourceRow}: ${error.message}`);
      }

      created += 1;
    }

    onProgress(index + 1, rows.length);
  }

  return {
    created,
    updated,
    total: rows.length,
  };
}

function resolveExistingRecord(
  row: ValidatedArticleRow,
  existingById: Map<string, ExistingArticleRecord>,
  existingBySku: Map<string, ExistingArticleRecord>
): ExistingArticleRecord | undefined {
  if (row.id) {
    const byId = existingById.get(row.id);
    if (byId) {
      return byId;
    }
  }

  if (row.sku) {
    return existingBySku.get(row.sku);
  }

  return undefined;
}

async function loadExistingById(
  organisationId: string,
  ids: string[]
): Promise<Map<string, ExistingArticleRecord>> {
  if (ids.length === 0) {
    return new Map<string, ExistingArticleRecord>();
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id")
    .eq("organisation_id", organisationId)
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  const records = (data ?? []) as ExistingArticleRecord[];
  return new Map(records.map((record) => [record.id, record]));
}

async function loadExistingBySku(organisationId: string, skus: string[]): Promise<Map<string, ExistingArticleRecord>> {
  if (skus.length === 0) {
    return new Map<string, ExistingArticleRecord>();
  }

  const encodedOrgId = encodeURIComponent(organisationId);
  const skuInClause = skus.map((sku) => `"${sku.replace(/"/g, '\\"')}"`).join(",");
  const encodedInClause = encodeURIComponent(skuInClause);
  const headers = await getRestHeaders();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?select=id,sku&organisation_id=eq.${encodedOrgId}&sku=in.(${encodedInClause})`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const message = await extractRestError(response);
    throw new Error(message);
  }

  const payload = (await response.json()) as unknown;
  const records = mapExistingRecords(payload);
  const mapped: Array<[string, ExistingArticleRecord]> = records
    .filter((record) => Boolean(record.sku))
    .map((record) => [record.sku as string, record]);

  return new Map(mapped);
}

function validateRows(rawRows: CsvArticleRawRow[]): ValidatedArticleRow[] {
  const errors: string[] = [];
  const idSet = new Set<string>();
  const skuSet = new Set<string>();
  const rows: ValidatedArticleRow[] = [];

  rawRows.forEach((row, index) => {
    const sourceRow = index + 2;
    const id = normalizeOptionalText(row.id);
    const sku = normalizeOptionalText(row.sku);
    const nom = normalizeOptionalText(row.nom);
    const quantite = parseInteger(row.quantite_actuelle);
    const seuil = parseInteger(row.seuil_alerte);

    if (!id && !sku) {
      errors.push(`Ligne ${sourceRow}: id ou sku est obligatoire.`);
    }

    if (id && !UUID_REGEX.test(id)) {
      errors.push(`Ligne ${sourceRow}: id doit etre un UUID valide.`);
    }

    if (sku && !SKU_REGEX.test(sku)) {
      errors.push(`Ligne ${sourceRow}: sku invalide (2 a 64 caracteres alpha-numeriques, . _ -).`);
    }

    if (!nom) {
      errors.push(`Ligne ${sourceRow}: nom est obligatoire.`);
    }

    if (quantite === null) {
      errors.push(`Ligne ${sourceRow}: quantite_actuelle doit etre un entier.`);
    }

    if (seuil === null || seuil < 0) {
      errors.push(`Ligne ${sourceRow}: seuil_alerte doit etre un entier >= 0.`);
    }

    if (id) {
      if (idSet.has(id)) {
        errors.push(`Ligne ${sourceRow}: id duplique dans le fichier (${id}).`);
      }
      idSet.add(id);
    }

    if (sku) {
      if (skuSet.has(sku)) {
        errors.push(`Ligne ${sourceRow}: sku duplique dans le fichier (${sku}).`);
      }
      skuSet.add(sku);
    }

    if (!nom || quantite === null || seuil === null || seuil < 0) {
      return;
    }

    rows.push({
      sourceRow,
      id,
      sku,
      nom,
      quantiteActuelle: quantite,
      seuilAlerte: seuil,
    });
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return rows;
}

async function detectSkuColumn(organisationId: string): Promise<boolean> {
  const encodedOrgId = encodeURIComponent(organisationId);
  const headers = await getRestHeaders();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=sku&organisation_id=eq.${encodedOrgId}&limit=1`, {
    method: "GET",
    headers,
  });

  if (response.ok) {
    return true;
  }

  const message = await extractRestError(response);
  if (isMissingColumnError(message)) {
    return false;
  }

  throw new Error(message);
}

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("does not exist") && normalized.includes("sku");
}

function parseCsvFile(file: File): Promise<CsvArticleRawRow[]> {
  return new Promise<CsvArticleRawRow[]>((resolve, reject) => {
    Papa.parse<CsvArticleRawRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(formatParseErrors(result.errors)));
          return;
        }

        resolve(result.data);
      },
      error: (error) => {
        reject(new Error(error.message));
      },
    });
  });
}

function formatParseErrors(errors: ParseError[]): string {
  const firstError = errors[0];
  return `CSV invalide (ligne ${firstError.row ?? "inconnue"}): ${firstError.message}`;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function parseInteger(value: unknown): number | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue.";
}

function resolveStatusColor(stage: ImportStage): React.CSSProperties {
  switch (stage) {
    case "error":
      return errorStatusStyle;
    case "success":
      return successStatusStyle;
    default:
      return neutralStatusStyle;
  }
}

async function getRestHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
  };
}

function mapExistingRecords(payload: unknown): ExistingArticleRecord[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const source = item as Record<string, unknown>;
    const id = source.id;
    const sku = source.sku;

    if (typeof id !== "string" || id.length === 0) {
      return [];
    }

    return [
      {
        id,
        sku: typeof sku === "string" && sku.length > 0 ? sku : undefined,
      },
    ];
  });
}

async function extractRestError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === "object") {
      const source = payload as Record<string, unknown>;
      const message = source.message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  } catch {
    // Ignore JSON parsing errors and return a fallback message below.
  }

  return `Erreur REST Supabase (${response.status})`;
}

const initialImportState: ImportState = {
  stage: "idle",
  message: "Selectionnez un fichier CSV pour demarrer.",
  percent: 0,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 1100,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "720px",
  background: "#ffffff",
  border: "1px solid #dbe3ee",
  borderRadius: "18px",
  padding: "20px",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.3)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 800,
  color: "#0f172a",
};

const descriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "0.82rem",
  lineHeight: 1.5,
  color: "#475569",
};

const controlsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const dropZoneStyle: React.CSSProperties = {
  border: "1px dashed #a5b4fc",
  borderRadius: "14px",
  background: "#eef2ff",
  minHeight: "132px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  textAlign: "center",
  padding: "16px",
  cursor: "pointer",
};

const dropZoneActiveStyle: React.CSSProperties = {
  borderColor: "#4338ca",
  background: "#e0e7ff",
};

const dropZoneTitleStyle: React.CSSProperties = {
  color: "#312e81",
  fontSize: "0.95rem",
  fontWeight: 800,
};

const dropZoneSubtitleStyle: React.CSSProperties = {
  color: "#312e81",
  fontSize: "0.82rem",
};

const hiddenInputStyle: React.CSSProperties = {
  display: "none",
};

const importButtonStyle: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #4338ca, #312e81)",
  color: "#ffffff",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#1e293b",
  border: "1px solid #dbe3ee",
  borderRadius: "12px",
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.9rem",
};

const disabledControlStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const fileInfoStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  color: "#334155",
};

const progressTrackStyle: React.CSSProperties = {
  width: "100%",
  height: "10px",
  borderRadius: "999px",
  background: "#e2e8f0",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #4338ca, #312e81)",
  transition: "width 0.2s ease",
};

const statusStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.82rem",
  fontWeight: 700,
};

const neutralStatusStyle: React.CSSProperties = {
  color: "#475569",
};

const successStatusStyle: React.CSSProperties = {
  color: "#166534",
};

const errorStatusStyle: React.CSSProperties = {
  color: "#b91c1c",
};

const errorBoxStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const errorLineStyle: React.CSSProperties = {
  margin: 0,
  color: "#7f1d1d",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};
