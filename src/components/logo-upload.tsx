"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES } from "@/lib/constants";
import { removeEntityLogo, uploadEntityLogo } from "@/lib/actions/entities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoUpload({
  entityId,
  logoUrl,
  companyName,
}: {
  entityId: string;
  logoUrl: string | null;
  companyName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [dragging, setDragging] = useState(false);
  const [lastLogoUrl, setLastLogoUrl] = useState(logoUrl);

  // Adjust during render rather than in an effect: when router.refresh() lands
  // a new signed URL, drop any optimistic local preview and fall back to it.
  if (logoUrl !== lastLogoUrl) {
    setLastLogoUrl(logoUrl);
    setPreview(logoUrl);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be smaller than 2 MB.");
      return;
    }
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPEG, WebP or SVG file.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const body = new FormData();
    body.append("logo", file);

    startTransition(async () => {
      const result = await uploadEntityLogo(entityId, body);

      if (result.error) {
        toast.error(result.error);
        setPreview(logoUrl);
        return;
      }

      toast.success("Logo updated");
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeEntityLogo(entityId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPreview(null);
      toast.success("Logo removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex items-center gap-4 rounded-lg border border-dashed p-4 transition-colors",
          dragging ? "border-primary bg-primary/5" : "bg-muted/30",
        )}
      >
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Company logo"
              className="size-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/50" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Company logo</p>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP or SVG up to 2 MB. Appears in the header of every
            generated PDF.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              {preview ? "Replace" : "Upload"}
            </Button>

            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error hover:text-error"
                disabled={isPending}
                onClick={handleRemove}
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
          aria-label="Upload company logo"
        />
      </div>

      {!preview && (
        <p className="text-xs text-muted-foreground">
          Without a logo, PDFs use the text header for {companyName}.
        </p>
      )}
    </div>
  );
}
