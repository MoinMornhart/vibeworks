import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/account";
import { AccountManager } from "@/components/account/AccountManager";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const { user, sessionId } = auth;
  return (
    <AccountManager
      profile={{
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        hasPassword: Boolean(user.passwordHash),
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      }}
      sessions={await listSessions(user.id, sessionId)}
    />
  );
}
