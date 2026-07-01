import numeral from "numeral";
import { format, parseISO, isValid } from "date-fns";

/**
 * Format a number as currency.
 * Defaults to Indian Rupee (INR) with Indian grouping (1,23,456.78).
 * Pass currency="USD" for US Dollar formatting ($1,234.56).
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: "INR" | "USD" = "INR"
): string {
  if (value == null || isNaN(value)) return "--";

  if (currency === "INR") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    // Indian numbering: last 3 digits, then groups of 2
    const [intPart, decPart] = abs.toFixed(2).split(".");
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted =
      rest.length > 0
        ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
        : lastThree;

    return `${sign}₹${formatted}.${decPart}`;
  }

  return `$${numeral(value).format("0,0.00")}`;
}

/**
 * Format a number with comma separators.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";
  return numeral(value).format("0,0");
}

/**
 * Format a number as a percentage with up to 2 decimal places.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";
  return `${numeral(value).format("0,0.[00]")}%`;
}

/**
 * Format a date value (string, Date, or timestamp) to dd MMM yyyy.
 */
export function formatDate(
  value: string | Date | number | null | undefined,
  pattern: string = "dd MMM yyyy"
): string {
  if (value == null) return "--";

  let date: Date;
  if (typeof value === "string") {
    date = parseISO(value);
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    date = value;
  }

  if (!isValid(date)) return "--";
  return format(date, pattern);
}

/**
 * Format large numbers compactly: 1.2M, 45.3K, etc.
 */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "--";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    // Crore
    return `${sign}${numeral(abs / 1_00_00_000).format("0.[0]")}Cr`;
  }
  if (abs >= 1_00_000) {
    // Lakh
    return `${sign}${numeral(abs / 1_00_000).format("0.[0]")}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${numeral(abs / 1_000).format("0.[0]")}K`;
  }
  return numeral(value).format("0.[00]");
}

/**
 * Convert an Excel serial date number to a JavaScript Date.
 * Excel serial date 1 = Jan 1 1900 (with the Lotus 1-2-3 leap-year bug).
 */
export function excelDateToJS(serial: number): Date {
  // Excel epoch: Jan 0 1900 (Dec 31 1899)
  // Adjust for Lotus 1-2-3 bug: Excel thinks 1900 is a leap year
  const epoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  return new Date(epoch.getTime() + serial * msPerDay);
}

/**
 * Returns an aging bucket label for a given number of days overdue.
 */
export function getAgingBucket(days: number): string {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 Days";
  if (days <= 60) return "31-60 Days";
  if (days <= 90) return "61-90 Days";
  if (days <= 120) return "91-120 Days";
  return "120+ Days";
}
