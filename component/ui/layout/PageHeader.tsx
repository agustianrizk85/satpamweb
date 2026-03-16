// src/components/ui/shared/PageHeader.tsx
"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";

export type PageHeaderProps = {
  title?: string;
  description?: string;
  titleKey?: string;
  descriptionKey?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  titleKey,
  descriptionKey,
  actions,
  onBack,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation();

  const finalTitle = title ?? (titleKey ? t(titleKey) : "");
  const finalDescription =
    description ?? (descriptionKey ? t(descriptionKey) : undefined);

  return (
    <div
      className={clsx(
        // ❌ tidak ada px-4 / sm:px-6 / lg:px-3 lagi
        "mb-4 flex flex-col gap-2 pt-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <div>
            {finalTitle && (
              <h1 className="text-[22px] font-semibold text-neutral-900">
                {finalTitle}
              </h1>
            )}
            {finalDescription ? (
              <p className="mt-1 text-[13px] text-neutral-600">
                {finalDescription}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
