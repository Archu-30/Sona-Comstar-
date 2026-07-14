export function calculateInventoryAge(grIssueDateMs) {
  if (!grIssueDateMs || grIssueDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - grIssueDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getAgeBucket(days) {
  if (days <= 0) return 'Unknown';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  if (days <= 730) return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}

export function calculateGitAge(invoiceDateMs) {
  if (!invoiceDateMs || invoiceDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - invoiceDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getGitAgeBucket(days) {
  if (days <= 0) return '0-30 Days';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  if (days <= 730) return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}
