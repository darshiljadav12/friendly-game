import { redirect } from "next/navigation";

// Invite links look like /join/ABCDE; the lobby reads the code from ?join=
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 5);
  redirect(clean ? `/?join=${clean}` : "/");
}
