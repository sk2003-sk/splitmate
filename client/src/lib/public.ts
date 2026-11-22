const PALETTE = ['#B9542F', '#2F6F5E', '#9A7B2F', '#7C5C8F', '#3E6B8A', '#A45A6B', '#5E6B3A'];

export function colorForName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return PALETTE[hash % PALETTE.length];
}

export function publicSplitUrl(code: string) {
  return `${window.location.origin}/split/${code}`;
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}
