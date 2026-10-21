/** First letters of the first two words, uppercased: "Ana María López" -> "AM"; empty for a blank name. */
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
}
