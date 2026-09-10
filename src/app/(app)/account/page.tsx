import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/account";
import { recoveryCodesLeft } from "@/lib/auth/recovery";
import { relyingParty, serializePasskey } from "@/lib/auth/webauthn";
import { AccountManager } from "@/components/account/AccountManager";
import { TotpSection } from "@/components/account/TotpSection";
import { PasskeySection } from "@/components/account/PasskeySection";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const { user, sessionId } = auth;
  const hasPassword = Boolean(user.passwordHash);
  const [sessions, recoveryLeft, passkeys] = await Promise.all([
    listSessions(user.id, sessionId),
    recoveryCodesLeft(user.id),
    db.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);
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
      sessions={sessions}
    >
      <PasskeySection initial={passkeys.map(serializePasskey)} hasPassword={hasPassword} rpID={relyingParty().rpID} />
      <TotpSection initial={{ enabled: Boolean(user.totpEnabledAt), recoveryLeft }} hasPassword={hasPassword} />
    </AccountManager>
  );
}
