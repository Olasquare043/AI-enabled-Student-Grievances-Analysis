import { redirect } from "next/navigation";

export default async function GrievanceDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/grievances/${id}`);
}
