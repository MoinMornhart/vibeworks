"use client";

import { Languages } from "lucide-react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useT } from "@/lib/i18n/client";
import { AccountSection } from "./AccountManager";

export function LanguageSection() {
  const t = useT("common");
  return (
    <AccountSection icon={<Languages size={18} />} title={t("language.title")} description={t("language.description")}>
      <LanguageSwitch />
    </AccountSection>
  );
}
