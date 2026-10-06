"use client";

import { Modal, dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import type { ReactNode } from "react";

/** ยืนยันการกระทำ — ปุ่มยืนยันเขียนคำกริยาจริง (ui-design-system.md ข้อ 8.3) */
export default function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3 text-body-md text-on-surface-variant">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={`${danger ? dangerButtonClass : primaryButtonClass} relative ${busy ? "btn-loading" : ""}`}
        >
          <span className="btn-text">{confirmLabel}</span>
          {!danger && (
            <span className="dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          )}
        </button>
      </div>
    </Modal>
  );
}
