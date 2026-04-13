"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { normalizeCompanySlug } from "@/app/utils/companySlug";
import { createEnterpriseAccess, type CreateOrganisationActionState } from "./actions";
import { createOrganisationSchema } from "./schema";

const initialState: CreateOrganisationActionState = {
  message: "",
  fieldErrors: {},
  success: false,
};

export default function SetupCompanyForm() {
  const [serverState, formAction] = useActionState(createEnterpriseAccess, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [isSlugLocked, setIsSlugLocked] = useState(true);
  const [clientErrors, setClientErrors] = useState<CreateOrganisationActionState["fieldErrors"]>({});

  const onNameChange = (value: string) => {
    setName(value);
    if (isSlugLocked) {
      setSlug(normalizeCompanySlug(value));
    }
    if (clientErrors.name) {
      setClientErrors((current) => ({ ...current, name: undefined }));
    }
  };

  const onSlugChange = (value: string) => {
    setSlug(normalizeCompanySlug(value));
    if (clientErrors.slug) {
      setClientErrors((current) => ({ ...current, slug: undefined }));
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const validation = createOrganisationSchema.safeParse({
      name,
      slug,
      adminEmail,
      adminPassword,
      primaryColor,
    });

    if (validation.success) {
      setClientErrors({});
      return;
    }

    event.preventDefault();
    const fieldErrors = validation.error.flatten().fieldErrors;
    setClientErrors({
      name: fieldErrors.name?.[0],
      slug: fieldErrors.slug?.[0],
      adminEmail: fieldErrors.adminEmail?.[0],
      adminPassword: fieldErrors.adminPassword?.[0],
      primaryColor: fieldErrors.primaryColor?.[0],
    });
  };

  const nameError = clientErrors.name ?? serverState.fieldErrors.name;
  const slugError = clientErrors.slug ?? serverState.fieldErrors.slug;
  const adminEmailError = clientErrors.adminEmail ?? serverState.fieldErrors.adminEmail;
  const adminPasswordError = clientErrors.adminPassword ?? serverState.fieldErrors.adminPassword;
  const primaryColorError = clientErrors.primaryColor ?? serverState.fieldErrors.primaryColor;

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700">
            Nom de l entreprise
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Ex: Acme Corp"
          />
          {nameError ? <p className="mt-2 text-xs font-medium text-rose-600">{nameError}</p> : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="slug" className="mb-2 block text-sm font-semibold text-slate-700">
            Slug
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => onSlugChange(event.target.value)}
                readOnly={isSlugLocked}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-16 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="acme-corp"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                /companies/{slug || "slug"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSlugLocked((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              title={isSlugLocked ? "Deverrouiller le slug" : "Verrouiller le slug"}
              aria-label={isSlugLocked ? "Deverrouiller le slug" : "Verrouiller le slug"}
            >
              {isSlugLocked ? <LockIcon /> : <UnlockIcon />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isSlugLocked
              ? "Le slug est genere automatiquement depuis le nom."
              : "Le slug est editable manuellement (kebab-case)."}
          </p>
          {slugError ? <p className="mt-1 text-xs font-medium text-rose-600">{slugError}</p> : null}
        </div>

        <div>
          <label htmlFor="adminEmail" className="mb-2 block text-sm font-semibold text-slate-700">
            Email de connexion admin
          </label>
          <input
            id="adminEmail"
            name="adminEmail"
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="admin@acme.com"
          />
          {adminEmailError ? <p className="mt-2 text-xs font-medium text-rose-600">{adminEmailError}</p> : null}
        </div>

        <div>
          <label htmlFor="adminPassword" className="mb-2 block text-sm font-semibold text-slate-700">
            Mot de passe temporaire
          </label>
          <input
            id="adminPassword"
            name="adminPassword"
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="TempPass#2026"
          />
          {adminPasswordError ? <p className="mt-2 text-xs font-medium text-rose-600">{adminPasswordError}</p> : null}
        </div>

        <div>
          <label htmlFor="primaryColor" className="mb-2 block text-sm font-semibold text-slate-700">
            Couleur principale
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value.toLowerCase())}
              className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="text-sm font-medium text-slate-700">{primaryColor}</span>
          </div>
          {primaryColorError ? <p className="mt-2 text-xs font-medium text-rose-600">{primaryColorError}</p> : null}
        </div>
      </div>

      {serverState.message ? (
        <p
          className={
            serverState.success
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
          aria-live="polite"
        >
          {serverState.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <a
          href="/hq/organisations"
          className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Annuler
        </a>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-52 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
    >
      {pending ? "Creation en cours..." : "Creer organisation + administrateur"}
    </button>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.2-2.3" />
    </svg>
  );
}
