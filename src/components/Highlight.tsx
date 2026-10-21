import { highlightParts } from '@/lib/highlight'

/** Text with the parts that match the search in bold (case and accents ignored). */
export function Highlight({ text, query }: { text: string | undefined; query: string }) {
  if (!text) {
    return null
  }
  return (
    <>
      {highlightParts(text, query).map((part, index) => part.match
        ? <mark key={index} className="rounded-sm bg-primary/10 font-semibold text-inherit">{part.text}</mark>
        : <span key={index}>{part.text}</span>)}
    </>
  )
}
