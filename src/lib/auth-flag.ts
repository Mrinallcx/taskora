export function authDisabled() {
  return (
    process.env.DISABLE_AUTH === "1" ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH === "1"
  )
}
