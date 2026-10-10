export function validUrl(value) {
  if (!/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password && new TextEncoder().encode(value).length <= 1000;
  } catch { return false; }
}
