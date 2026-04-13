import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyEntryPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/companies/${slug}/login`);
}
