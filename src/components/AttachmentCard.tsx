import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { fileExtension, formatBytes, isImage, signedUrl, type Attachment } from "@/lib/work";

export function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const { data: url } = useQuery({
    queryKey: ["signed-url", attachment.file_path],
    queryFn: () => signedUrl(attachment.file_path),
    staleTime: 1000 * 60 * 30,
  });

  const image = isImage(attachment);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      {image && url ? (
        <img
          src={url}
          alt={attachment.file_name}
          loading="lazy"
          className="size-14 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-secondary font-mono text-[10px] font-semibold uppercase text-muted-foreground">
          {fileExtension(attachment.file_name) || <FileText className="size-5" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatBytes(attachment.file_size)}
          {attachment.file_size ? " · " : ""}
          {fileExtension(attachment.file_name).toUpperCase()}
        </p>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-secondary"
        >
          <Download className="size-3.5" />
          {image ? "Open" : "Download"}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      )}
    </div>
  );
}
