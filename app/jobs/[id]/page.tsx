import { redirect } from "next/navigation"

export default async function JobRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/${id}`)
}
