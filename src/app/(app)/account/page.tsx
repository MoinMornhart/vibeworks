import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { listSessions } from "@/lib/account";
import { recoveryCodesLeft } from "@/lib/auth/recovery";
import { relyingParty, serializePasskey } from "@/lib/auth/webauthn";
import { credentialList } from "@/lib/git/token";
import { AccountManager } from "@/components/account/AccountManager";
import { TotpSection } from "@/components/account/TotpSection";
import { PasskeySection } from "@/components/account/PasskeySection";
import { GitConnectionsSection } from "@/components/account/GitConnectionsSection";
import { LanguageSection } from "@/components/account/LanguageSection";
import { DataSection } from "@/components/account/DataSection";
import { NotificationsSection } from "@/components/account/NotificationsSection";
import { notificationView } from "@/lib/notify";
import { smtpReady } from "@/lib/notify/mail";
import { ApiTokensSection } from "@/components/account/ApiTokensSection";
import { serializeApiToken } from "@/lib/mcp/token";
import { config } from "@/lib/config";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT("account");
  return { title: t("page.title") };
}

export default async function AccountPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const { user, sessionId } = auth;
  const hasPassword = Boolean(user.passwordHash);
  const [sessions, recoveryLeft, passkeys, connections, notifications, mailReady, apiTokens] = await Promise.all([
    listSessions(user.id, sessionId),
    recoveryCodesLeft(user.id),
    db.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    credentialList(user.id),
    db.notificationSettings.findUnique({ where: { userId: user.id } }),
    smtpReady(),
    db.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
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
      <LanguageSection />
      <PasskeySection initial={passkeys.map(serializePasskey)} hasPassword={hasPassword} rpID={relyingParty().rpID} />
      <TotpSection initial={{ enabled: Boolean(user.totpEnabledAt), recoveryLeft }} hasPassword={hasPassword} />
      <GitConnectionsSection initial={connections} />
      <ApiTokensSection initial={apiTokens.map(serializeApiToken)} appUrl={config.appUrl} />
      <NotificationsSection initial={notificationView(notifications)} smtpReady={mailReady} isAdmin={user.role === "ADMIN"} />
      <DataSection />
    </AccountManager>
  );
}
