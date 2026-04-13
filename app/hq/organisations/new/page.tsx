import OrganisationCreateForm from "./OrganisationCreateForm";

export default function NewOrganisationPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">HQ Dashboard</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Provisioning organisation multi-tenant</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Creez l organisation et son premier compte administrateur en une seule action atomique.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <OrganisationCreateForm />
        </section>
      </div>
    </main>
  );
}
