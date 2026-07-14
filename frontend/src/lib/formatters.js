import numeral from "numeral";
import { format, parseISO, isValid } from "date-fns";

export function formatCurrency(value, currency = "INR") {
  if (value == null || isNaN(value)) return "--";

  if (currency === "INR") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    const intPart = Math.round(abs).toString();
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted =
      rest.length > 0
        ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
        : lastThree;

    return `${sign}₹${formatted}`;
  }

  return `$${numeral(value).format("0,0")}`;
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return "--";
  return numeral(value).format("0,0");
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return "--";
  return `${numeral(value).format("0,0.[00]")}%`;
}

export function formatDate(value, pattern = "dd MMM yyyy") {
  if (value == null) return "--";

  let date;
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

export function formatCompact(value) {
  if (value == null || isNaN(value)) return "--";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}${numeral(abs / 1_00_00_000).format("0.[0]")}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}${numeral(abs / 1_00_000).format("0.[0]")}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${numeral(abs / 1_000).format("0.[0]")}K`;
  }
  return numeral(value).format("0.[00]");
}

export function excelDateToJS(serial) {
  const epoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  return new Date(epoch.getTime() + serial * msPerDay);
}

export function getAgingBucket(days) {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 Days";
  if (days <= 60) return "31-60 Days";
  if (days <= 90) return "61-90 Days";
  if (days <= 120) return "91-120 Days";
  return "120+ Days";
}
