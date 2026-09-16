import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "work-evidence";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "zip",
];

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
};

export type WorkSession = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
  is_public: boolean;
  created_at: string;
  profiles?: Profile | null;
  attachments?: Attachment[];
};

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatDurationHuman(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isImage(a: Attachment): boolean {
  if (a.file_type?.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(fileExtension(a.file_name));
}

export function validateFile(file: File): string | null {
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" is not a supported file type.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is larger than 20 MB.`;
  }
  return null;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Human-readable message for auth / database errors. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  const m = message.toLowerCase();
  if (!message) return fallback;
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (m.includes("invalid login credentials")) return "That email or password is incorrect.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try logging in instead.";
  if (m.includes("password") && m.includes("6")) return "Your password must be at least 6 characters.";
  if (m.includes("pwned") || m.includes("compromised"))
    return "That password has appeared in a known data breach. Please choose a different one.";
  if (m.includes("invalid email") || m.includes("email address")) return "Please enter a valid email address.";
  if (m.includes("jwt") || m.includes("session")) return "Your session expired. Please log in again.";
  if (m.includes("row-level security") || m.includes("permission"))
    return "You don't have permission to do that.";
  if (m.includes("exceeded the maximum allowed size")) return "That file is too large (20 MB maximum).";
  return message;
}
