import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative size-8 shrink-0", className)}
    >
      <Image src="/brand/omniia-logo-gold@2x.png" alt="Omniia" fill sizes="40px" className="object-contain" priority />
    </div>
  );
}
