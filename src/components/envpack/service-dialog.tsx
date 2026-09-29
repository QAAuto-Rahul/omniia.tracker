"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createService, updateService } from "@/lib/envpack/actions";
import { DESCRIPTION_MAX, NAME_MAX } from "@/lib/envpack/validation";

type EditableService = { id: number; name: string; description: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Environment to open the new service in after creating it. */
  environmentId: number;
  /** Edit this service; omit to create a new one. */
  service?: EditableService | null;
};

export function ServiceDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServiceForm {...rest} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({
  environmentId,
  service,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (service) {
        const res = await updateService(service.id, { name, description });
        if (!res.ok) return setError(res.error);
        toast.success("Service updated");
        onDone();
        return;
      }

      const res = await createService({ name, description });
      if (!res.ok) return setError(res.error);
      toast.success(`Service "${name.trim()}" added`);
      onDone();
      router.push(`/env-pack/${environmentId}/services/${res.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{service ? "Edit service" : "Add service"}</DialogTitle>
        <DialogDescription>
          {service
            ? "Changes apply in every environment."
            : "Services are shared by all environments; each environment keeps its own values."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="service-name">Name</Label>
        <Input
          id="service-name"
          autoFocus
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="auth-service"
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="service-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="service-description"
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Handles login, tokens and sessions"
          disabled={pending}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          {service ? "Save changes" : "Add service"}
        </Button>
      </DialogFooter>
    </form>
  );
}
