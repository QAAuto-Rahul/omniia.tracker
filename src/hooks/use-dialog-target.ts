"use client";

import { useState } from "react";

/**
 * Open/close state for a dialog that acts on one item. The item is kept after
 * closing so the dialog's content doesn't blank out during its exit animation.
 */
export function useDialogTarget<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  return {
    target,
    open,
    show(item: T) {
      setTarget(item);
      setOpen(true);
    },
    onOpenChange(next: boolean) {
      setOpen(next);
    },
  };
}
