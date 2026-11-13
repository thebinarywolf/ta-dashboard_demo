import { normalizeSheetDate } from "@/lib/connectors/google-sheets/normalize";
import type { EmployeeRow } from "@/lib/supabase/types";
import type { QandleUser } from "./client";

function text(raw: QandleUser, key: string): string | null {
  const value = raw[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** First + middle + last name, single-spaced; null if Qandle has none. */
function fullName(raw: QandleUser): string | null {
  const parts = [text(raw, "first_name"), text(raw, "middle_name"), text(raw, "last_name")].filter(
    (p): p is string => !!p
  );
  const name = parts.join(" ").replace(/\s+/g, " ").trim();
  return name || null;
}

/**
 * Picks ONLY the fields attrition needs: the name (so the list can say who
 * left), code, department, dates and status. Phone numbers, emails, addresses,
 * PAN numbers and photos in the Qandle response are never read, so they can't
 * leak into storage or logs. Dates arrive as "20 July 2017".
 */
export function mapQandleEmployee(raw: QandleUser): Omit<EmployeeRow, "id" | "synced_at"> {
  return {
    employee_code: text(raw, "employee_code"),
    full_name: fullName(raw),
    department: text(raw, "department"),
    location: text(raw, "location"),
    designation: text(raw, "designation"),
    date_of_joining: normalizeSheetDate(text(raw, "date_of_joining")),
    date_of_birth: normalizeSheetDate(text(raw, "date_of_birth")),
    relieving_date: normalizeSheetDate(text(raw, "relieving_date")),
    employee_status: text(raw, "employee_status"),
  };
}
