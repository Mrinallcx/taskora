import { redirect } from "next/navigation"

export default async function TaskRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/${id}`)
}
