/** Join a Chinese + English label as "中文 / English" — the app-wide convention. */
export function bi(zh: string, en: string): string {
  return `${zh} / ${en}`;
}
