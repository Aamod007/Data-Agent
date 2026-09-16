"use client";

import { useEffect } from "react";
import { PipelineWorkspace } from "@/components/pipeline-workspace";

interface PipelineStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PipelineStudioModal({ isOpen, onClose }: PipelineStudioModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="pipeline-studio-modal-backdrop" onClick={onClose}>
      <div
        className="pipeline-studio-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pipeline Studio"
      >
        <PipelineWorkspace onClose={onClose} />
      </div>
    </div>
  );
}
