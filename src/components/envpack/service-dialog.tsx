"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import type { ServiceDeveloper } from "@/lib/envpack/types";

type EditableService = { id: number; name: string; description: string; developers: ServiceDeveloper[] };

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
        <ServiceForm key={rest.service?.id ?? "new"} {...rest} onDone={() => onOpenChange(false)} />
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
  const [developers, setDevelopers] = useState<ServiceDeveloper[]>(service?.developers ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (service) {
        const res = await updateService(service.id, { name, description, developers });
        if (!res.ok) return setError(res.error);
        toast.success("Service updated");
        onDone();
        return;
      }

      const res = await createService({ name, description, developers });
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
        <div className="flex items-center justify-between">
          <Label>Backend developers <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Button type="button" variant="outline" size="sm" disabled={pending || developers.length >= 20}
            onClick={() => setDevelopers((current) => [...current, { name: "", email: "" }])}>
            <Plus /> Add developer
          </Button>
        </div>
        {developers.map((developer, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input aria-label={`Developer ${index + 1} name`} maxLength={100} placeholder="Name"
              value={developer.name} disabled={pending}
              onChange={(e) => setDevelopers((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
            <Input aria-label={`Developer ${index + 1} email`} type="email" maxLength={254} placeholder="Email address"
              value={developer.email} disabled={pending}
              onChange={(e) => setDevelopers((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove developer ${index + 1}`} disabled={pending}
              onClick={() => setDevelopers((current) => current.filter((_, i) => i !== index))}>
              <Trash2 />
            </Button>
          </div>
        ))}
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
