const formatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const fullFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function formatDate(value) {
  return formatter.format(new Date(value));
}

export function formatRelativeDate(value) {
  const timestamp = new Date(value).getTime();
  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 604_800_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return formatDate(value);
}

export function formatDateTime(value) {
  return fullFormatter.format(new Date(value));
}
