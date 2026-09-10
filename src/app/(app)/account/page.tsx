import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/account";
import { recoveryCodesLeft } from "@/lib/auth/recovery";
import { AccountManager } from "@/components/account/AccountManager";
import { TotpSection } from "@/components/account/TotpSection";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const { user, sessionId } = auth;
  const hasPassword = Boolean(user.passwordHash);
  return (
    <AccountManager
      profile={{
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        hasPassword,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      }}
      sessions={await listSessions(user.id, sessionId)}
    >
      <TotpSection initial={{ enabled: Boolean(user.totpEnabledAt), recoveryLeft: await recoveryCodesLeft(user.id) }} hasPassword={hasPassword} />
    </AccountManager>
  );
}
