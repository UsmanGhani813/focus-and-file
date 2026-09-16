import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AttachmentCard } from "@/components/AttachmentCard";
import {
  formatDateTime,
  formatDuration,
  initials,
  type WorkSession,
} from "@/lib/work";

export function WorkDetailDialog({
  session,
  onOpenChange,
}: {
  session: WorkSession | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {session ? (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-left text-2xl leading-tight tracking-tight">
                {session.title}
              </DialogTitle>
            </DialogHeader>

            {session.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{session.description}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No description was added.</p>
            )}

            <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              <Field label="Started" value={formatDateTime(session.started_at)} />
              <Field label="Stopped" value={formatDateTime(session.stopped_at)} />
              <Field label="Duration" value={formatDuration(session.duration_seconds)} strong />
              <Field label="Logged" value={formatDateTime(session.created_at)} />
            </dl>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Completed by
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(session.profiles?.full_name ?? "?")}
                </span>
                <span className="text-sm font-medium">{session.profiles?.full_name ?? "Unknown"}</span>
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Attachments
              </p>
              {session.attachments && session.attachments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {session.attachments.map((a) => (
                    <AttachmentCard key={a.id} attachment={a} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No files attached.</p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-card p-3">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-mono text-sm tnum ${strong ? "font-semibold text-foreground" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
