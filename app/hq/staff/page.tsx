"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";
import type { HqRole } from "../../utils/hqSession";
import { setActiveUniverse } from "@/app/utils/universeState";

type StaffRole = HqRole | "Admin HQ";
type StaffRoleOption = "Admin HQ" | "Support" | "Account_Manager";
type ModuleKey = "support" | "account" | "finance" | "staff";
type TicketPriority = "Urgent" | "High" | "Medium" | "Low";
type OrganisationPlan = "Starter" | "Ultra";
type PortfolioTab = "clients" | "prospects";
type LeadTemperature = "Froid" | "Tiede" | "Chaud";
type LeadSource = "Pub" | "Recommandation" | "Prospection directe";

interface Ticket {
  id: string;
  client: string;
  subject: string;
  priority: TicketPriority;
  createdAt: string;
}

interface ClientOrg {
  id: string;
  name: string;
  plan: OrganisationPlan;
  ownerEmail: string;
  status: string;
  lastSeenAt: string | null;
  updatedAt: string | null;
}

interface StaffMember {
  id: string;
  fullName: string;
  roleHq: string;
  email: string;
  matriculeInterne: string;
}

interface CreateStaffResponse {
  ok?: boolean;
  message?: string;
  error?: string;
  temporaryPassword?: string;
}

interface Invoice {
  id: string;
  organisationId: string;
  amountTtc: number;
  status: string;
  dueDate: string;
}

interface Prospect {
  id: string;
  companyName: string;
  mainContact: string;
  phone: string;
  source: LeadSource;
  sector: string;
  temperature: LeadTemperature;
  createdAt: string;
}

interface ProspectDraft {
  companyName: string;
  mainContact: string;
  phone: string;
  source: LeadSource;
  sector: string;
  temperature: LeadTemperature;
}

interface HqMeResponse {
  userId: string;
  role: StaffRole;
  name: string;
}

interface SearchHit {
  id: string;
  label: string;
  section: "Client" | "Prospect" | "Ticket" | "Staff";
  sublabel: string;
}

const PLAN_MRR: Record<OrganisationPlan, number> = {
  Starter: 49,
  Ultra: 149,
};

const MODULES: Array<{ key: ModuleKey; icon: string; label: string }> = [
  { key: "support", icon: "SUP", label: "Support" },
  { key: "account", icon: "AM", label: "Account" },
  { key: "finance", icon: "FIN", label: "Finance" },
  { key: "staff", icon: "HQ", label: "Staff" },
];

const FALLBACK_TICKETS: Ticket[] = [
  { id: "T-4201", client: "Maison Lenoir", subject: "Erreur impression", priority: "Urgent", createdAt: "2026-04-10" },
  { id: "T-4194", client: "Atelier Pasteur", subject: "API timeout", priority: "High", createdAt: "2026-04-09" },
  { id: "T-4188", client: "Boulangerie Lys", subject: "Question TVA", priority: "Medium", createdAt: "2026-04-08" },
];

const FALLBACK_PROSPECTS: Prospect[] = [
  {
    id: "prospect-1",
    companyName: "Boucherie Dupont",
    mainContact: "Louis Dupont",
    phone: "06 11 22 33 44",
    source: "Recommandation",
    sector: "Boucherie",
    temperature: "Chaud",
    createdAt: "2026-04-10T09:30:00.000Z",
  },
  {
    id: "prospect-2",
    companyName: "Boulangerie des Halles",
    mainContact: "Maya Colin",
    phone: "06 98 45 21 10",
    source: "Pub",
    sector: "Boulangerie",
    temperature: "Tiede",
    createdAt: "2026-04-08T15:00:00.000Z",
  },
  {
    id: "prospect-3",
    companyName: "Fromagerie Pernet",
    mainContact: "Rene Pernet",
    phone: "07 44 21 98 11",
    source: "Prospection directe",
    sector: "Fromagerie",
    temperature: "Froid",
    createdAt: "2026-04-04T08:20:00.000Z",
  },
];

const PROSPECTS_STORAGE_KEY = "kipilote_hq_prospects_v1";
const SECTOR_OPTIONS = ["Boucherie", "Boulangerie", "Charcuterie", "Epicerie", "Fromagerie", "Traiteur"];

const INITIAL_PROSPECT_DRAFT: ProspectDraft = {
  companyName: "",
  mainContact: "",
  phone: "",
  source: "Pub",
  sector: "Boucherie",
  temperature: "Tiede",
};

export default function HqStaffPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");

  const [role, setRole] = useState<StaffRole | null>(null);
  const [memberName, setMemberName] = useState("Membre HQ");
  const [activeModule, setActiveModule] = useState<ModuleKey>("support");
  const [globalSearch, setGlobalSearch] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [organisations, setOrganisations] = useState<ClientOrg[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [quickReply, setQuickReply] = useState("");
  const [replyLog, setReplyLog] = useState<string[]>([]);

  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("clients");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [accountNoteDraft, setAccountNoteDraft] = useState("");
  const [accountJournalByEntity, setAccountJournalByEntity] = useState<Record<string, string>>({});
  const [journalSavedAtByEntity, setJournalSavedAtByEntity] = useState<Record<string, string>>({});
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
  const [accountFeedback, setAccountFeedback] = useState("");
  const [copyingInvite, setCopyingInvite] = useState(false);

  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [prospectDraft, setProspectDraft] = useState<ProspectDraft>(INITIAL_PROSPECT_DRAFT);

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPrenom, setStaffPrenom] = useState("");
  const [staffNom, setStaffNom] = useState("");
  const [staffRoleToAdd, setStaffRoleToAdd] = useState<StaffRoleOption>("Support");
  const [staffMatriculeInterne, setStaffMatriculeInterne] = useState("");
  const [staffCreationLoading, setStaffCreationLoading] = useState(false);
  const [createdTemporaryPassword, setCreatedTemporaryPassword] = useState("");
  const [staffActionFeedback, setStaffActionFeedback] = useState("");

  const isAdmin = role === "Admin" || role === "Admin HQ";
  const activeModuleForRole = useMemo<ModuleKey>(() => {
    if (isAdmin) return activeModule;
    if (role === "Support") return "support";
    if (role === "Account_Manager") return "account";
    return "finance";
  }, [activeModule, isAdmin, role]);

  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, client_name, subject, urgency, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) {
      setTickets(FALLBACK_TICKETS);
      setSelectedTicketId(FALLBACK_TICKETS[0]?.id ?? "");
      return;
    }

    const mapped: Ticket[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      client: String(row.client_name ?? "Client inconnu"),
      subject: String(row.subject ?? "Sans objet"),
      priority: normalizePriority(String(row.urgency ?? "")),
      createdAt: formatDate(String(row.created_at ?? "")),
    }));

    setTickets(mapped);
    setSelectedTicketId(mapped[0]?.id ?? "");
  }, []);

  const loadOrganisations = useCallback(async () => {
    const { data, error } = await supabase
      .from("organisations")
      .select("id, nom, plan, owner_email, statut, last_seen_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      setOrganisations([]);
      return;
    }

    const mapped: ClientOrg[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.nom ?? "Organisation"),
      plan: normalizePlan(String(row.plan ?? "")),
      ownerEmail: String(row.owner_email ?? "-"),
      status: String(row.statut ?? "actif"),
      lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    }));

    setOrganisations(mapped);
  }, []);

  const loadInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id, organisation_id, amount_ttc, status, due_date")
      .order("id", { ascending: false })
      .limit(60);

    if (error || !data) {
      setInvoices([]);
      return;
    }

    const mapped: Invoice[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      organisationId: String(row.organisation_id ?? ""),
      amountTtc: toNumber(row.amount_ttc),
      status: String(row.status ?? "pending"),
      dueDate: formatDate(String(row.due_date ?? "")),
    }));

    setInvoices(mapped);
  }, []);

  const loadProspects = useCallback(async () => {
    const { data, error } = await supabase
      .from("hq_prospects")
      .select("id, company_name, main_contact, phone, source, sector, temperature, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      const stored = readStoredProspects();
      setProspects(stored.length > 0 ? stored : FALLBACK_PROSPECTS);
      return;
    }

    const mapped = data
      .map((row: Record<string, unknown>) => mapProspectRow(row))
      .filter((row): row is Prospect => row !== null);

    if (mapped.length > 0) {
      setProspects(mapped);
      return;
    }

    const stored = readStoredProspects();
    setProspects(stored.length > 0 ? stored : FALLBACK_PROSPECTS);
  }, []);

  const loadStaff = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nom, prenom, role_hq, email, matricule_interne, matricule")
      .eq("is_hq_staff", true)
      .order("id", { ascending: true });

    if (error || !data) {
      setStaff([]);
      return;
    }

    const mapped: StaffMember[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      fullName: [String(row.prenom ?? ""), String(row.nom ?? "")].filter(Boolean).join(" ").trim() || `Profil ${String(row.id)}`,
      roleHq: String(row.role_hq ?? "-"),
      email: String(row.email ?? "-"),
      matriculeInterne: String(row.matricule_interne ?? row.matricule ?? "-"),
    }));

    setStaff(mapped);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setLoadingError("");

      try {
        const meResponse = await fetch("/api/hq/me");
        if (!meResponse.ok) {
          await supabase.auth.signOut();
          router.replace("/staff-portal-access");
          return;
        }

        const me = (await meResponse.json()) as HqMeResponse;
        if (!isMounted) return;

        setActiveUniverse("hq");
        setRole(me.role);
        setMemberName(me.name || "Membre HQ");
        if (me.role === "Support") setActiveModule("support");
        if (me.role === "Account_Manager") setActiveModule("account");
        if (me.role === "Admin" || me.role === "Admin HQ") setActiveModule("support");

        if (me.role === "Admin" || me.role === "Admin HQ") {
          await Promise.all([loadTickets(), loadOrganisations(), loadInvoices(), loadProspects(), loadStaff()]);
        } else if (me.role === "Support") {
          await Promise.all([loadTickets(), loadProspects()]);
          setOrganisations([]);
          setInvoices([]);
          setStaff([]);
        } else if (me.role === "Account_Manager") {
          await Promise.all([loadOrganisations(), loadProspects()]);
          setTickets([]);
          setInvoices([]);
          setStaff([]);
        } else {
          await loadInvoices();
          setTickets([]);
          setOrganisations([]);
          setProspects([]);
          setStaff([]);
        }
      } catch {
        if (!isMounted) return;
        setLoadingError("Impossible de charger le portail HQ.");
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
  }, [loadInvoices, loadOrganisations, loadProspects, loadStaff, loadTickets, router]);

  const filteredTickets = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !isAdmin) return tickets;
    return tickets.filter((ticket) => `${ticket.id} ${ticket.client} ${ticket.subject}`.toLowerCase().includes(query));
  }, [globalSearch, isAdmin, tickets]);

  const filteredOrganisations = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !isAdmin) return organisations;
    return organisations.filter((org) => `${org.name} ${org.ownerEmail} ${org.plan}`.toLowerCase().includes(query));
  }, [globalSearch, isAdmin, organisations]);

  const filteredProspects = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !isAdmin) return prospects;
    return prospects.filter((prospect) => {
      const bucket = `${prospect.companyName} ${prospect.mainContact} ${prospect.phone} ${prospect.source} ${prospect.sector} ${prospect.temperature}`;
      return bucket.toLowerCase().includes(query);
    });
  }, [globalSearch, isAdmin, prospects]);

  const filteredStaff = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !isAdmin) return staff;
    return staff.filter((member) => {
      const value = `${member.fullName} ${member.roleHq} ${member.id} ${member.email} ${member.matriculeInterne}`;
      return value.toLowerCase().includes(query);
    });
  }, [globalSearch, isAdmin, staff]);

  useEffect(() => {
    if (filteredOrganisations.length === 0) {
      setSelectedClientId("");
      return;
    }

    const stillExists = filteredOrganisations.some((org) => org.id === selectedClientId);
    if (!stillExists) {
      setSelectedClientId(filteredOrganisations[0].id);
    }
  }, [filteredOrganisations, selectedClientId]);

  useEffect(() => {
    if (filteredProspects.length === 0) {
      setSelectedProspectId("");
      return;
    }

    const stillExists = filteredProspects.some((prospect) => prospect.id === selectedProspectId);
    if (!stillExists) {
      setSelectedProspectId(filteredProspects[0].id);
    }
  }, [filteredProspects, selectedProspectId]);

  useEffect(() => {
    writeStoredProspects(prospects);
  }, [prospects]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0] ?? null;
  const selectedClient = filteredOrganisations.find((org) => org.id === selectedClientId) ?? filteredOrganisations[0] ?? null;
  const selectedProspect = filteredProspects.find((prospect) => prospect.id === selectedProspectId) ?? filteredProspects[0] ?? null;

  const selectedEntityKey = portfolioTab === "clients" && selectedClient
    ? `client-${selectedClient.id}`
    : portfolioTab === "prospects" && selectedProspect
      ? `prospect-${selectedProspect.id}`
      : "";

  useEffect(() => {
    if (!selectedEntityKey) {
      setAccountNoteDraft("");
      return;
    }

    setAccountNoteDraft(accountJournalByEntity[selectedEntityKey] ?? "");
  }, [accountJournalByEntity, selectedEntityKey]);

  const mrr = useMemo(() => {
    return organisations.reduce((sum, org) => sum + PLAN_MRR[org.plan], 0);
  }, [organisations]);

  const accountManagerMrr = useMemo(() => {
    return organisations
      .filter((org) => org.status.toLowerCase() !== "suspendu")
      .reduce((sum, org) => sum + PLAN_MRR[org.plan], 0);
  }, [organisations]);

  const pendingInvoices = useMemo(() => {
    return invoices.filter((invoice) => isInvoiceUnpaid(invoice.status));
  }, [invoices]);

  const financeBars = useMemo(() => {
    const values = invoices.map((invoice) => invoice.amountTtc).filter((amount) => amount > 0).slice(0, 6).reverse();
    const max = Math.max(...values, 1);
    return values.map((value, index) => ({
      id: `bar-${index}`,
      value,
      height: `${Math.max(16, Math.round((value / max) * 100))}%`,
    }));
  }, [invoices]);

  const selectedClientInvoices = useMemo(() => {
    if (!selectedClient) return [];
    return invoices.filter((invoice) => invoice.organisationId === selectedClient.id);
  }, [invoices, selectedClient]);

  const selectedClientUnpaidInvoices = useMemo(() => {
    return selectedClientInvoices.filter((invoice) => isInvoiceUnpaid(invoice.status));
  }, [selectedClientInvoices]);

  const selectedClientAiUsageRate = useMemo(() => {
    return estimateAiUsageRate(selectedClient?.lastSeenAt ?? null);
  }, [selectedClient?.lastSeenAt]);

  const autoFollowUpClients = useMemo(() => {
    return organisations
      .map((org) => ({
        org,
        daysSinceSeen: getDaysSince(org.lastSeenAt),
      }))
      .filter((row) => row.daysSinceSeen === null || row.daysSinceSeen > 7)
      .sort((a, b) => {
        const aScore = a.daysSinceSeen ?? 999;
        const bScore = b.daysSinceSeen ?? 999;
        return bScore - aScore;
      })
      .slice(0, 8);
  }, [organisations]);

  const hotProspectsCount = useMemo(() => {
    return prospects.filter((prospect) => prospect.temperature === "Chaud").length;
  }, [prospects]);

  const globalHits = useMemo<SearchHit[]>(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query || !isAdmin) return [];

    const ticketHits = tickets
      .filter((ticket) => `${ticket.id} ${ticket.client} ${ticket.subject}`.toLowerCase().includes(query))
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        label: `${ticket.id} - ${ticket.client}`,
        section: "Ticket" as const,
        sublabel: `${ticket.subject} · ${ticket.priority}`,
      }));

    const clientHits = organisations
      .filter((org) => `${org.name} ${org.ownerEmail}`.toLowerCase().includes(query))
      .map((org) => ({
        id: `org-${org.id}`,
        label: org.name,
        section: "Client" as const,
        sublabel: `${org.plan} · ${org.ownerEmail}`,
      }));

    const prospectHits = prospects
      .filter((prospect) => `${prospect.companyName} ${prospect.mainContact} ${prospect.phone}`.toLowerCase().includes(query))
      .map((prospect) => ({
        id: `prospect-${prospect.id}`,
        label: prospect.companyName,
        section: "Prospect" as const,
        sublabel: `${prospect.sector} · ${prospect.temperature}`,
      }));

    const staffHits = staff
      .filter((member) => {
        const value = `${member.fullName} ${member.roleHq} ${member.id} ${member.email} ${member.matriculeInterne}`;
        return value.toLowerCase().includes(query);
      })
      .map((member) => ({
        id: `staff-${member.id}`,
        label: member.fullName,
        section: "Staff" as const,
        sublabel: `${toRoleLabel(member.roleHq)} · ${member.email}`,
      }));

    return [...ticketHits, ...clientHits, ...prospectHits, ...staffHits].slice(0, 14);
  }, [globalSearch, isAdmin, organisations, prospects, staff, tickets]);

  const submitQuickReply = () => {
    if (!selectedTicket || !quickReply.trim()) return;
    const line = `${new Date().toLocaleTimeString("fr-FR")} - ${selectedTicket.id} - ${quickReply.trim()}`;
    setReplyLog((current) => [line, ...current].slice(0, 6));
    setQuickReply("");
  };

  const saveAccountJournal = () => {
    if (!selectedEntityKey) return;

    setAccountJournalByEntity((current) => ({
      ...current,
      [selectedEntityKey]: accountNoteDraft,
    }));

    setJournalSavedAtByEntity((current) => ({
      ...current,
      [selectedEntityKey]: new Date().toISOString(),
    }));

    setAccountFeedback("Journal d'echanges enregistre.");
  };

  const handleGenerateInviteLink = () => {
    const refName = portfolioTab === "clients" ? selectedClient?.name : selectedProspect?.companyName;
    const refId = portfolioTab === "clients" ? selectedClient?.id : selectedProspect?.id;

    if (!refName) {
      setAccountFeedback("Selectionnez un client ou prospect pour generer le lien.");
      return;
    }

    const slug = buildOrganisationSlug(refName);
    const uniqueSuffix = (refId ?? `${Date.now()}`).slice(0, 6);
    const finalSlug = `${slug}-${uniqueSuffix}`.replace(/-+/g, "-");
    const link = `https://kipilote.com/signup?org=${encodeURIComponent(finalSlug)}`;

    setGeneratedInviteLink(link);
    setAccountFeedback("Lien d'inscription unique genere.");
  };

  const copyInviteLink = async () => {
    if (!generatedInviteLink) return;

    setCopyingInvite(true);
    try {
      await navigator.clipboard.writeText(generatedInviteLink);
      setAccountFeedback("Lien copie dans le presse-papiers.");
    } catch {
      setAccountFeedback("Impossible de copier le lien automatiquement.");
    } finally {
      setCopyingInvite(false);
    }
  };

  const updateClientPlan = async (organisationId: string, targetPlan: OrganisationPlan) => {
    const dbPlan = targetPlan === "Starter" ? "STARTER" : "ULTRA";

    const { error } = await supabase.from("organisations").update({ plan: dbPlan }).eq("id", organisationId);

    if (error) {
      setAccountFeedback(error.message);
      return;
    }

    setOrganisations((current) => current.map((org) => (org.id === organisationId ? { ...org, plan: targetPlan } : org)));
    setAccountFeedback(`Plan ${targetPlan} applique.`);
  };

  const toggleClientSuspension = async (org: ClientOrg) => {
    const nextStatus = org.status.toLowerCase() === "suspendu" ? "actif" : "suspendu";
    const { error } = await supabase.from("organisations").update({ statut: nextStatus }).eq("id", org.id);

    if (error) {
      setAccountFeedback(error.message);
      return;
    }

    setOrganisations((current) => current.map((item) => (item.id === org.id ? { ...item, status: nextStatus } : item)));
    setAccountFeedback(nextStatus === "suspendu" ? "Acces client suspendu." : "Acces client reactive.");
  };

  const createProspect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountFeedback("");

    const nextDraft: ProspectDraft = {
      companyName: prospectDraft.companyName.trim(),
      mainContact: prospectDraft.mainContact.trim(),
      phone: prospectDraft.phone.trim(),
      source: prospectDraft.source,
      sector: prospectDraft.sector,
      temperature: prospectDraft.temperature,
    };

    if (!nextDraft.companyName || !nextDraft.mainContact || !nextDraft.phone) {
      setAccountFeedback("Nom entreprise, contact principal et telephone sont obligatoires.");
      return;
    }

    const localProspect: Prospect = {
      id: `local-${Date.now()}`,
      companyName: nextDraft.companyName,
      mainContact: nextDraft.mainContact,
      phone: nextDraft.phone,
      source: nextDraft.source,
      sector: nextDraft.sector,
      temperature: nextDraft.temperature,
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("hq_prospects")
      .insert([
        {
          company_name: nextDraft.companyName,
          main_contact: nextDraft.mainContact,
          phone: nextDraft.phone,
          source: nextDraft.source,
          sector: nextDraft.sector,
          temperature: nextDraft.temperature,
        },
      ])
      .select("id, company_name, main_contact, phone, source, sector, temperature, created_at")
      .maybeSingle();

    const createdProspect = mapProspectRow(data as Record<string, unknown> | null) ?? localProspect;

    if (error) {
      setAccountFeedback("Prospect ajoute localement (table hq_prospects indisponible). ");
    } else {
      setAccountFeedback("Nouveau prospect enregistre.");
    }

    setProspects((current) => [createdProspect, ...current]);
    setPortfolioTab("prospects");
    setSelectedProspectId(createdProspect.id);
    setProspectDraft(INITIAL_PROSPECT_DRAFT);
    setIsProspectModalOpen(false);
  };

  const updateProspectTemperature = async (prospectId: string, temperature: LeadTemperature) => {
    setProspects((current) => current.map((prospect) => (prospect.id === prospectId ? { ...prospect, temperature } : prospect)));

    const { error } = await supabase.from("hq_prospects").update({ temperature }).eq("id", prospectId);

    if (error) {
      setAccountFeedback("Temperature mise a jour localement uniquement.");
      return;
    }

    setAccountFeedback("Temperature du lead mise a jour.");
  };

  const convertProspect = async (prospect: Prospect) => {
    setPortfolioTab("prospects");
    setSelectedProspectId(prospect.id);
    setProspects((current) => current.map((item) => (item.id === prospect.id ? { ...item, temperature: "Chaud" } : item)));
    await updateProspectTemperature(prospect.id, "Chaud");
    handleGenerateInviteLink();
  };

  const addStaffMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStaffActionFeedback("");
    setCreatedTemporaryPassword("");

    const email = staffEmail.trim().toLowerCase();
    const prenom = staffPrenom.trim();
    const nom = staffNom.trim();
    const matriculeInterne = staffMatriculeInterne.trim();

    if (!email || !prenom || !nom || !matriculeInterne) {
      setStaffActionFeedback("Tous les champs sont obligatoires.");
      return;
    }

    setStaffCreationLoading(true);

    try {
      const response = await fetch("/api/hq/staff/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          prenom,
          nom,
          roleHq: staffRoleToAdd,
          matriculeInterne,
        }),
      });

      const body = (await response.json().catch(() => null)) as CreateStaffResponse | null;
      if (!response.ok) {
        setStaffActionFeedback(body?.error || "Creation du collaborateur impossible.");
        return;
      }

      setStaffActionFeedback(body?.message || "Collaborateur HQ cree.");
      setCreatedTemporaryPassword(body?.temporaryPassword ?? "");
      setStaffEmail("");
      setStaffPrenom("");
      setStaffNom("");
      setStaffMatriculeInterne("");
      await loadStaff();
    } catch {
      setStaffActionFeedback("Erreur reseau pendant la creation du compte.");
    } finally {
      setStaffCreationLoading(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    await supabase.auth.signOut();
    router.replace("/staff-portal-access");
  };

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={stateCardStyle}>Chargement...</div>
      </main>
    );
  }

  if (!role || loadingError) {
    return (
      <main style={pageStyle}>
        <div style={errorCardStyle}>{loadingError || "Acces refuse."}</div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={logoWrapStyle}>
          <span style={logoMarkStyle}>KP</span>
          <div>
            <div style={logoTextStyle}>KIPILOTE</div>
            <div style={logoSubStyle}>Maison Mere HQ</div>
          </div>
        </div>

        <div style={headerActionsStyle}>
          <span style={memberTagStyle}>{memberName}</span>
          <button type="button" onClick={signOut} style={ghostButtonStyle}>
            Quitter
          </button>
        </div>
      </header>

      <div style={hqModeIndicatorStyle}>MODE MAISON MERE</div>

      {isAdmin ? (
        <section style={adminTopBarStyle}>
          <div style={searchWrapStyle}>
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Recherche globale: client, prospect, ticket, collaborateur..."
              style={searchInputStyle}
            />
          </div>
          <div style={moduleTabsStyle}>
            {MODULES.map((module) => (
              <button
                key={module.key}
                type="button"
                onClick={() => setActiveModule(module.key)}
                style={moduleTabStyle(activeModuleForRole === module.key)}
              >
                {module.icon} {module.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin && globalSearch.trim() ? (
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resultats Instantanes</h2>
          <div style={globalHitsGridStyle}>
            {globalHits.length === 0 ? <span style={mutedTextStyle}>Aucun resultat.</span> : null}
            {globalHits.map((hit) => (
              <div key={hit.id} style={hitCardStyle}>
                <strong style={hitTitleStyle}>{hit.label}</strong>
                <span style={hitMetaStyle}>{hit.section}</span>
                <span style={hitMetaStyle}>{hit.sublabel}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={gridStyle}>
        {activeModuleForRole === "support" ? (
          <>
            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Support / Tickets</h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Priorite</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} style={rowStyle(ticket.id === selectedTicket?.id)} onClick={() => setSelectedTicketId(ticket.id)}>
                      <td style={tdStyle}>{ticket.id}</td>
                      <td style={tdStyle}>{ticket.client}</td>
                      <td style={tdStyle}>
                        <span style={priorityBadgeStyle(ticket.priority)}>{ticket.priority}</span>
                      </td>
                      <td style={tdStyle}>{ticket.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Quick Reply</h2>
              <div style={stackStyle}>
                <span style={mutedTextStyle}>Ticket cible: {selectedTicket ? `${selectedTicket.id} - ${selectedTicket.client}` : "-"}</span>
                <textarea
                  value={quickReply}
                  onChange={(event) => setQuickReply(event.target.value)}
                  rows={4}
                  placeholder="Reponse rapide au client"
                  style={textareaStyle}
                />
                <button type="button" onClick={submitQuickReply} style={primaryButtonStyle}>
                  Envoyer
                </button>
                <div style={thinDividerStyle} />
                <div style={stackStyle}>
                  {replyLog.length === 0 ? <span style={mutedTextStyle}>Aucune reponse envoyee.</span> : null}
                  {replyLog.map((line) => (
                    <span key={line} style={replyItemStyle}>
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </>
        ) : null}

        {activeModuleForRole === "account" ? (
          <article style={accountMainCardStyle}>
            <h2 style={cardTitleStyle}>Account Manager CRM</h2>

            <div style={accountSummaryRowStyle}>
              <div style={accountSummaryPillStyle}>Portefeuille clients: {filteredOrganisations.length}</div>
              <div style={accountSummaryPillStyle}>Prospects chauds: {hotProspectsCount}</div>
              <div style={accountSummaryPillStyle}>MRR portefeuille: {formatCurrency(accountManagerMrr)}</div>
            </div>

            <div style={dualPaneStyle}>
              <aside style={leftPaneStyle}>
                <div style={portfolioTabsWrapStyle}>
                  <button
                    type="button"
                    onClick={() => setPortfolioTab("clients")}
                    style={portfolioTabButtonStyle(portfolioTab === "clients")}
                  >
                    Clients Actifs ({filteredOrganisations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortfolioTab("prospects")}
                    style={portfolioTabButtonStyle(portfolioTab === "prospects")}
                  >
                    Prospects ({filteredProspects.length})
                  </button>
                </div>

                <button type="button" onClick={() => setIsProspectModalOpen(true)} style={secondaryButtonStyle}>
                  Nouveau Prospect
                </button>

                <div style={portfolioListStyle}>
                  {portfolioTab === "clients"
                    ? filteredOrganisations.map((org) => {
                        const isSelected = selectedClient?.id === org.id;
                        return (
                          <button
                            key={org.id}
                            type="button"
                            style={portfolioItemStyle(isSelected)}
                            onClick={() => {
                              setSelectedClientId(org.id);
                              setGeneratedInviteLink("");
                            }}
                          >
                            <div style={portfolioItemTopRowStyle}>
                              <strong style={portfolioItemTitleStyle}>{org.name}</strong>
                              <span style={planBadgeStyle(org.plan)}>{org.plan}</span>
                            </div>
                            <span style={portfolioItemMetaStyle}>Dernier contact: {formatDate(org.updatedAt ?? "")}</span>
                            <span style={portfolioItemMetaStyle}>{org.ownerEmail}</span>
                          </button>
                        );
                      })
                    : filteredProspects.map((prospect) => {
                        const isSelected = selectedProspect?.id === prospect.id;
                        return (
                          <button
                            key={prospect.id}
                            type="button"
                            style={portfolioItemStyle(isSelected)}
                            onClick={() => {
                              setSelectedProspectId(prospect.id);
                              setGeneratedInviteLink("");
                            }}
                          >
                            <div style={portfolioItemTopRowStyle}>
                              <strong style={portfolioItemTitleStyle}>{prospect.companyName}</strong>
                              <span style={temperatureBadgeStyle(prospect.temperature)}>{prospect.temperature}</span>
                            </div>
                            <span style={portfolioItemMetaStyle}>{prospect.sector}</span>
                            <span style={portfolioItemMetaStyle}>{prospect.mainContact}</span>
                          </button>
                        );
                      })}
                </div>
              </aside>

              <section style={rightPaneStyle}>
                {portfolioTab === "clients" ? (
                  selectedClient ? (
                    <>
                      <div style={detailsHeaderStyle}>
                        <div style={stackStyle}>
                          <h3 style={detailsNameStyle}>{selectedClient.name}</h3>
                          <span style={mutedTextStyle}>Contact principal: {selectedClient.ownerEmail}</span>
                        </div>
                        <span style={statusBadgeStyle(selectedClient.status)}>{selectedClient.status === "suspendu" ? "Suspendu" : "Actif"}</span>
                      </div>

                      <div style={healthGridStyle}>
                        <div style={healthCardStyle}>
                          <span style={healthLabelStyle}>Taux d'utilisation IA</span>
                          <strong style={healthValueStyle}>{selectedClientAiUsageRate}%</strong>
                        </div>
                        <div style={healthCardStyle}>
                          <span style={healthLabelStyle}>Factures impayees</span>
                          <strong style={healthValueStyle}>{selectedClientUnpaidInvoices.length}</strong>
                        </div>
                        <div style={healthCardStyle}>
                          <span style={healthLabelStyle}>Derniere activite</span>
                          <strong style={healthValueStyle}>{formatDate(selectedClient.lastSeenAt ?? "")}</strong>
                        </div>
                      </div>

                      <div style={actionsRowStyle}>
                        <button
                          type="button"
                          style={primaryButtonStyle}
                          disabled={selectedClient.plan === "Ultra"}
                          onClick={() => void updateClientPlan(selectedClient.id, "Ultra")}
                        >
                          {selectedClient.plan === "Ultra" ? "Plan Ultra actif" : "Passer en Ultra"}
                        </button>
                        <button type="button" style={dangerButtonStyle} onClick={() => void toggleClientSuspension(selectedClient)}>
                          {selectedClient.status.toLowerCase() === "suspendu" ? "Reactiver acces" : "Suspendre acces"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <span style={mutedTextStyle}>Aucun client selectionne.</span>
                  )
                ) : selectedProspect ? (
                  <>
                    <div style={detailsHeaderStyle}>
                      <div style={stackStyle}>
                        <h3 style={detailsNameStyle}>{selectedProspect.companyName}</h3>
                        <span style={mutedTextStyle}>Contact: {selectedProspect.mainContact}</span>
                        <span style={mutedTextStyle}>Telephone: {selectedProspect.phone}</span>
                      </div>
                      <span style={temperatureBadgeStyle(selectedProspect.temperature)}>{selectedProspect.temperature}</span>
                    </div>

                    <div style={prospectInfoGridStyle}>
                      <div style={healthCardStyle}>
                        <span style={healthLabelStyle}>Secteur</span>
                        <strong style={healthValueStyle}>{selectedProspect.sector}</strong>
                      </div>
                      <div style={healthCardStyle}>
                        <span style={healthLabelStyle}>Source du lead</span>
                        <strong style={healthValueStyle}>{selectedProspect.source}</strong>
                      </div>
                      <div style={healthCardStyle}>
                        <span style={healthLabelStyle}>Cree le</span>
                        <strong style={healthValueStyle}>{formatDate(selectedProspect.createdAt)}</strong>
                      </div>
                    </div>

                    <div style={temperatureActionsWrapStyle}>
                      <button
                        type="button"
                        style={temperatureActionButtonStyle(selectedProspect.temperature === "Froid")}
                        onClick={() => void updateProspectTemperature(selectedProspect.id, "Froid")}
                      >
                        Froid
                      </button>
                      <button
                        type="button"
                        style={temperatureActionButtonStyle(selectedProspect.temperature === "Tiede")}
                        onClick={() => void updateProspectTemperature(selectedProspect.id, "Tiede")}
                      >
                        Tiede
                      </button>
                      <button
                        type="button"
                        style={temperatureActionButtonStyle(selectedProspect.temperature === "Chaud")}
                        onClick={() => void updateProspectTemperature(selectedProspect.id, "Chaud")}
                      >
                        Chaud
                      </button>
                    </div>

                    <button type="button" style={primaryButtonStyle} onClick={() => void convertProspect(selectedProspect)}>
                      Convertir ce prospect
                    </button>
                  </>
                ) : (
                  <span style={mutedTextStyle}>Aucun prospect selectionne.</span>
                )}

                <div style={inviteCardStyle}>
                  <h4 style={miniTitleStyle}>Generateur de lien d'inscription</h4>
                  <span style={mutedTextStyle}>Exemple: kipilote.com/signup?org=boucherie-dupont</span>
                  <div style={inviteActionsStyle}>
                    <button type="button" style={secondaryButtonStyle} onClick={handleGenerateInviteLink}>
                      Generer URL d'invitation
                    </button>
                    <button type="button" style={ghostButtonStyle} onClick={() => void copyInviteLink()} disabled={!generatedInviteLink || copyingInvite}>
                      {copyingInvite ? "Copie..." : "Copier"}
                    </button>
                  </div>
                  <input value={generatedInviteLink} readOnly placeholder="Le lien apparaitra ici" style={inputStyle} />
                </div>

                <div style={journalCardStyle}>
                  <h4 style={miniTitleStyle}>Journal d'echanges</h4>
                  <textarea
                    value={accountNoteDraft}
                    onChange={(event) => setAccountNoteDraft(event.target.value)}
                    rows={4}
                    placeholder="Resume du dernier appel / rendez-vous"
                    style={textareaStyle}
                  />
                  <div style={journalFooterStyle}>
                    <button type="button" style={primaryButtonStyle} onClick={saveAccountJournal}>
                      Enregistrer note
                    </button>
                    {selectedEntityKey && journalSavedAtByEntity[selectedEntityKey] ? (
                      <span style={mutedTextStyle}>Sauvegarde: {formatDateTime(journalSavedAtByEntity[selectedEntityKey])}</span>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>

            <div style={accountToolsGridStyle}>
              <article style={toolCardStyle}>
                <h3 style={miniTitleStyle}>Suivi des commissions</h3>
                <strong style={toolMetricStyle}>{formatCurrency(accountManagerMrr)}</strong>
                <span style={mutedTextStyle}>MRR genere par ce gestionnaire de compte</span>
              </article>

              <article style={toolCardStyle}>
                <h3 style={miniTitleStyle}>Relances automatiques</h3>
                <div style={followUpListStyle}>
                  {autoFollowUpClients.length === 0 ? <span style={mutedTextStyle}>Aucun client inactif au-dela de 7 jours.</span> : null}
                  {autoFollowUpClients.map(({ org, daysSinceSeen }) => (
                    <div key={org.id} style={followUpItemStyle}>
                      <strong style={followUpNameStyle}>{org.name}</strong>
                      <span style={followUpMetaStyle}>
                        {daysSinceSeen === null ? "Jamais connecte" : `${daysSinceSeen} jours sans utilisation`}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {accountFeedback ? <span style={feedbackPillStyle}>{accountFeedback}</span> : null}
          </article>
        ) : null}

        {activeModuleForRole === "finance" ? (
          <>
            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Finance SaaS</h2>
              <div style={financeGridStyle}>
                <div style={metricCardStyle}>
                  <span style={metricLabelStyle}>MRR</span>
                  <strong style={metricValueStyle}>{formatCurrency(mrr)}</strong>
                </div>
                <div style={metricCardStyle}>
                  <span style={metricLabelStyle}>Factures en attente</span>
                  <strong style={metricValueStyle}>{pendingInvoices.length}</strong>
                </div>
              </div>
            </article>

            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Tendance Revenus</h2>
              <div style={barChartStyle}>
                {financeBars.length === 0 ? <span style={mutedTextStyle}>Pas de donnees facture.</span> : null}
                {financeBars.map((bar) => (
                  <div key={bar.id} style={barWrapStyle}>
                    <div style={barStyleWithHeight(bar.height)} />
                    <span style={barLabelStyle}>{Math.round(bar.value)}EUR</span>
                  </div>
                ))}
              </div>
            </article>
          </>
        ) : null}

        {activeModuleForRole === "staff" ? (
          <>
            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Staff Interne</h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nom</th>
                    <th style={thStyle}>Role HQ</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Matricule</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((member) => (
                    <tr key={member.id} style={rowStyle(false)}>
                      <td style={tdStyle}>{member.fullName}</td>
                      <td style={tdStyle}>{toRoleLabel(member.roleHq)}</td>
                      <td style={tdStyle}>{member.email}</td>
                      <td style={tdStyle}>{member.matriculeInterne}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article style={cardStyle}>
              <h2 style={cardTitleStyle}>Ajouter un membre interne</h2>
              <form onSubmit={addStaffMember} style={stackStyle}>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(event) => setStaffEmail(event.target.value)}
                  placeholder="Email professionnel"
                  style={inputStyle}
                />
                <input
                  value={staffPrenom}
                  onChange={(event) => setStaffPrenom(event.target.value)}
                  placeholder="Prenom"
                  style={inputStyle}
                />
                <input
                  value={staffNom}
                  onChange={(event) => setStaffNom(event.target.value)}
                  placeholder="Nom"
                  style={inputStyle}
                />
                <input
                  value={staffMatriculeInterne}
                  onChange={(event) => setStaffMatriculeInterne(event.target.value)}
                  placeholder="Matricule interne"
                  style={inputStyle}
                />
                <select
                  value={staffRoleToAdd}
                  onChange={(event) => setStaffRoleToAdd(event.target.value as StaffRoleOption)}
                  style={inputStyle}
                >
                  <option value="Support">Tech Support</option>
                  <option value="Account_Manager">Account Manager</option>
                  <option value="Admin HQ">Admin HQ</option>
                </select>
                <button type="submit" style={primaryButtonStyle} disabled={staffCreationLoading}>
                  {staffCreationLoading ? "Creation..." : "Enregistrer"}
                </button>
                {staffActionFeedback ? <span style={mutedTextStyle}>{staffActionFeedback}</span> : null}
                {createdTemporaryPassword ? (
                  <span style={temporaryPasswordStyle}>Mot de passe temporaire: {createdTemporaryPassword}</span>
                ) : null}
              </form>
            </article>
          </>
        ) : null}
      </section>

      {isProspectModalOpen ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 style={modalTitleStyle}>Nouveau Prospect</h3>
            <form onSubmit={createProspect} style={stackStyle}>
              <input
                value={prospectDraft.companyName}
                onChange={(event) => setProspectDraft((current) => ({ ...current, companyName: event.target.value }))}
                placeholder="Nom entreprise"
                style={inputStyle}
              />
              <input
                value={prospectDraft.mainContact}
                onChange={(event) => setProspectDraft((current) => ({ ...current, mainContact: event.target.value }))}
                placeholder="Contact principal"
                style={inputStyle}
              />
              <input
                value={prospectDraft.phone}
                onChange={(event) => setProspectDraft((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Telephone"
                style={inputStyle}
              />
              <select
                value={prospectDraft.source}
                onChange={(event) =>
                  setProspectDraft((current) => ({ ...current, source: normalizeLeadSource(event.target.value) }))
                }
                style={inputStyle}
              >
                <option value="Pub">Pub</option>
                <option value="Recommandation">Recommandation</option>
                <option value="Prospection directe">Prospection directe</option>
              </select>
              <select
                value={prospectDraft.sector}
                onChange={(event) => setProspectDraft((current) => ({ ...current, sector: event.target.value }))}
                style={inputStyle}
              >
                {SECTOR_OPTIONS.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
              <select
                value={prospectDraft.temperature}
                onChange={(event) =>
                  setProspectDraft((current) => ({ ...current, temperature: normalizeLeadTemperature(event.target.value) }))
                }
                style={inputStyle}
              >
                <option value="Froid">Froid</option>
                <option value="Tiede">Tiede</option>
                <option value="Chaud">Chaud</option>
              </select>

              <div style={modalActionsStyle}>
                <button
                  type="button"
                  style={ghostButtonStyle}
                  onClick={() => {
                    setIsProspectModalOpen(false);
                    setProspectDraft(INITIAL_PROSPECT_DRAFT);
                  }}
                >
                  Annuler
                </button>
                <button type="submit" style={primaryButtonStyle}>
                  Enregistrer le prospect
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function normalizePriority(value: string): TicketPriority {
  const normalized = value.toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("crit")) return "Urgent";
  if (normalized.includes("high") || normalized.includes("haute")) return "High";
  if (normalized.includes("low") || normalized.includes("basse")) return "Low";
  return "Medium";
}

function normalizePlan(value: string): OrganisationPlan {
  const normalized = value.toUpperCase();
  if (normalized === "STARTER") return "Starter";
  return "Ultra";
}

function normalizeLeadTemperature(value: string): LeadTemperature {
  const normalized = value.toLowerCase();
  if (normalized.includes("chaud")) return "Chaud";
  if (normalized.includes("froid")) return "Froid";
  return "Tiede";
}

function normalizeLeadSource(value: string): LeadSource {
  if (value === "Recommandation") return "Recommandation";
  if (value === "Prospection directe") return "Prospection directe";
  return "Pub";
}

function mapProspectRow(row: Record<string, unknown> | null): Prospect | null {
  if (!row) return null;

  return {
    id: String(row.id ?? `prospect-${Date.now()}`),
    companyName: String(row.company_name ?? row.companyName ?? "Prospect"),
    mainContact: String(row.main_contact ?? row.mainContact ?? "-"),
    phone: String(row.phone ?? "-"),
    source: normalizeLeadSource(String(row.source ?? "Pub")),
    sector: String(row.sector ?? "Commerce"),
    temperature: normalizeLeadTemperature(String(row.temperature ?? "Tiede")),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function readStoredProspects(): Prospect[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PROSPECTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => mapProspectRow((row ?? null) as Record<string, unknown> | null))
      .filter((row): row is Prospect => row !== null);
  } catch {
    return [];
  }
}

function writeStoredProspects(prospects: Prospect[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(prospects));
  } catch {
    // ignore local storage write failures
  }
}

function getDaysSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function estimateAiUsageRate(lastSeenAt: string | null): number {
  const days = getDaysSince(lastSeenAt);
  if (days === null) return 12;
  if (days <= 1) return 92;
  if (days <= 3) return 76;
  if (days <= 7) return 58;
  if (days <= 14) return 34;
  return 16;
}

function isInvoiceUnpaid(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "pending" || normalized === "overdue" || normalized === "en_attente";
}

function buildOrganisationSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function toRoleLabel(role: string): string {
  if (role === "Account_Manager") return "Account Manager";
  if (role === "Admin HQ") return "Admin HQ";
  if (role === "Support") return "Support";
  return role || "-";
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at 15% 5%, #fdf2f8 0%, #f8fafc 42%, #f1f5f9 100%)",
  padding: "24px",
  color: "#1e293b",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const logoWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const logoMarkStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: "0.95rem",
  fontWeight: 900,
  background: "#e0e7ff",
  padding: "8px 10px",
  borderRadius: "12px",
};

const logoTextStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "1.3rem",
  color: "#3730a3",
  letterSpacing: "0.02em",
};

const logoSubStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "#64748b",
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const hqModeIndicatorStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #facc15",
  background: "#fef9c3",
  color: "#713f12",
  borderRadius: "999px",
  padding: "8px 14px",
  fontSize: "0.76rem",
  fontWeight: 900,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: "12px",
};

const memberTagStyle: React.CSSProperties = {
  fontSize: "0.86rem",
  color: "#475569",
  background: "#e2e8f0",
  padding: "8px 12px",
  borderRadius: "999px",
};

const adminTopBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr",
  gap: "12px",
  marginBottom: "16px",
};

const searchWrapStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  padding: "10px",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "11px 12px",
  fontSize: "0.92rem",
  outline: "none",
  color: "#334155",
};

const moduleTabsStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  padding: "10px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  padding: "20px",
};

const accountMainCardStyle: React.CSSProperties = {
  ...cardStyle,
  gridColumn: "1 / -1",
  background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e2e8f0",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: "0.95rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
  fontWeight: 700,
};

const stateCardStyle: React.CSSProperties = {
  ...cardStyle,
  maxWidth: "420px",
  margin: "120px auto 0",
  textAlign: "center",
};

const errorCardStyle: React.CSSProperties = {
  ...cardStyle,
  maxWidth: "480px",
  margin: "120px auto 0",
  textAlign: "center",
  color: "#be123c",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  fontSize: "0.78rem",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "11px 8px",
  fontSize: "0.87rem",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};

const thinDividerStyle: React.CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  width: "100%",
};

const stackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "10px 12px",
  fontSize: "0.9rem",
  color: "#334155",
  outline: "none",
  background: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "14px",
  padding: "10px 12px",
  background: "#6366f1",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #c7d2fe",
  borderRadius: "14px",
  padding: "10px 12px",
  background: "#eef2ff",
  color: "#4338ca",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecdd3",
  borderRadius: "14px",
  padding: "10px 12px",
  background: "#fff1f2",
  color: "#be123c",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "8px 12px",
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer",
  fontWeight: 600,
};

const mutedTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "0.84rem",
};

const replyItemStyle: React.CSSProperties = {
  ...mutedTextStyle,
  background: "#f8fafc",
  borderRadius: "12px",
  padding: "8px 10px",
};

const financeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
  gap: "10px",
};

const metricCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#64748b",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  color: "#334155",
};

const barChartStyle: React.CSSProperties = {
  height: "180px",
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
};

const barWrapStyle: React.CSSProperties = {
  flex: 1,
  minWidth: "40px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  justifyContent: "flex-end",
  height: "100%",
};

const barStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "46px",
  borderRadius: "10px 10px 6px 6px",
  background: "#a5b4fc",
};

const barStyleWithHeight = (height: string): React.CSSProperties => ({
  ...barStyle,
  height,
});

const barLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "#64748b",
};

const globalHitsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const hitCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const hitTitleStyle: React.CSSProperties = {
  fontSize: "0.88rem",
  color: "#334155",
};

const hitMetaStyle: React.CSSProperties = {
  fontSize: "0.76rem",
  color: "#64748b",
};

const accountSummaryRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: "14px",
};

const accountSummaryPillStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "0.82rem",
  color: "#334155",
  fontWeight: 600,
};

const dualPaneStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
};

const leftPaneStyle: React.CSSProperties = {
  flex: "1 1 320px",
  minWidth: "280px",
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const rightPaneStyle: React.CSSProperties = {
  flex: "2 1 420px",
  minWidth: "300px",
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const portfolioTabsWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
  gap: "8px",
};

const portfolioListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "560px",
  overflowY: "auto",
  paddingRight: "4px",
};

const portfolioItemTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const portfolioItemTitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#334155",
};

const portfolioItemMetaStyle: React.CSSProperties = {
  fontSize: "0.76rem",
  color: "#64748b",
  textAlign: "left",
};

const detailsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const detailsNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  color: "#1e293b",
};

const healthGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
};

const prospectInfoGridStyle: React.CSSProperties = {
  ...healthGridStyle,
};

const healthCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const healthLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#64748b",
};

const healthValueStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "#1e293b",
  fontWeight: 700,
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const inviteCardStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "18px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const journalCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbeafe",
  borderRadius: "18px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const miniTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.88rem",
  color: "#334155",
  fontWeight: 700,
};

const inviteActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const journalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const accountToolsGridStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const toolCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const toolMetricStyle: React.CSSProperties = {
  fontSize: "1.28rem",
  color: "#1d4ed8",
};

const followUpListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const followUpItemStyle: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: "14px",
  padding: "9px 10px",
  border: "1px solid #e2e8f0",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const followUpNameStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#334155",
};

const followUpMetaStyle: React.CSSProperties = {
  fontSize: "0.74rem",
  color: "#64748b",
};

const feedbackPillStyle: React.CSSProperties = {
  marginTop: "12px",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: "12px",
  padding: "8px 10px",
  fontSize: "0.84rem",
  display: "inline-flex",
};

const temperatureActionsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const temporaryPasswordStyle: React.CSSProperties = {
  fontSize: "0.84rem",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "#fff7ed",
  color: "#9a3412",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 100,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "18px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.18)",
};

const modalTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: "1.1rem",
  color: "#1e293b",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
};

const moduleTabStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: "12px",
  padding: "8px 10px",
  background: active ? "#6366f1" : "#eef2ff",
  color: active ? "#ffffff" : "#475569",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "0.8rem",
});

const rowStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "#f8fafc" : "#ffffff",
  cursor: "pointer",
});

const portfolioItemStyle = (active: boolean): React.CSSProperties => ({
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  background: active ? "#eef2ff" : "#ffffff",
  cursor: "pointer",
  textAlign: "left",
});

const portfolioTabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "8px 10px",
  background: active ? "#e0e7ff" : "#ffffff",
  color: active ? "#3730a3" : "#475569",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.8rem",
});

const priorityBadgeStyle = (priority: TicketPriority): React.CSSProperties => {
  if (priority === "Urgent") {
    return {
      background: "#ffe4e6",
      color: "#be123c",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "0.74rem",
      fontWeight: 700,
    };
  }
  if (priority === "High") {
    return {
      background: "#ffedd5",
      color: "#c2410c",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "0.74rem",
      fontWeight: 700,
    };
  }
  if (priority === "Low") {
    return {
      background: "#d1fae5",
      color: "#047857",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "0.74rem",
      fontWeight: 700,
    };
  }
  return {
    background: "#e2e8f0",
    color: "#334155",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "0.74rem",
    fontWeight: 700,
  };
};

const planBadgeStyle = (plan: OrganisationPlan): React.CSSProperties => ({
  background: plan === "Ultra" ? "#ede9fe" : "#e0f2fe",
  color: plan === "Ultra" ? "#5b21b6" : "#0f766e",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "0.75rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
});

const statusBadgeStyle = (status: string): React.CSSProperties => ({
  background: status.toLowerCase() === "suspendu" ? "#fff1f2" : "#ecfdf5",
  color: status.toLowerCase() === "suspendu" ? "#be123c" : "#047857",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "0.74rem",
  fontWeight: 700,
});

const temperatureBadgeStyle = (temperature: LeadTemperature): React.CSSProperties => {
  if (temperature === "Chaud") {
    return {
      background: "#ffedd5",
      color: "#c2410c",
      borderRadius: "999px",
      padding: "4px 9px",
      fontSize: "0.72rem",
      fontWeight: 700,
    };
  }

  if (temperature === "Froid") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderRadius: "999px",
      padding: "4px 9px",
      fontSize: "0.72rem",
      fontWeight: 700,
    };
  }

  return {
    background: "#fef9c3",
    color: "#a16207",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "0.72rem",
    fontWeight: 700,
  };
};

const temperatureActionButtonStyle = (active: boolean): React.CSSProperties => ({
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "8px 10px",
  background: active ? "#e0e7ff" : "#ffffff",
  color: active ? "#3730a3" : "#475569",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.8rem",
});
