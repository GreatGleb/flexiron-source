/**
 * Ordering document numbers — order numbers, batch numbers, movement numbers.
 *
 * A document number is text with a counter inside it, and sorting that text as
 * text puts the thousandth document between the hundredth and the hundred and
 * first: `…099, 100, 1000, 1001, … 101, 102`. Zero-padding hides it exactly until
 * the counter outgrows the padding, which is to say until the system is real —
 * measured here at 1 050 orders, first disagreement at position 100. And it is
 * the first column a person searches by.
 *
 * Padding wider only moves the cliff, and moving it does not repair numbers
 * already printed on a waybill. So the comparison is width-independent: digit
 * runs compare as numbers, everything between them as text. That also keeps the
 * year in charge — `ORD-2027-1` still follows all of 2026, which comparing the
 * trailing counter alone would not.
 *
 * Deliberately not `localeCompare(…, { numeric: true })`: this file is the
 * reference the backend is written from, and locale-sensitive collation is not
 * something a database index will reproduce. On the server the honest shapes are
 * the counter in a column of its own, or an index over the parsed parts.
 */
export function compareDocumentNumbers(a: string, b: string): number {
  const left = a.split(/(\d+)/)
  const right = b.split(/(\d+)/)
  const chunks = Math.max(left.length, right.length)
  for (let i = 0; i < chunks; i++) {
    const l = left[i] ?? ''
    const r = right[i] ?? ''
    if (l === r) continue
    if (/^\d+$/.test(l) && /^\d+$/.test(r)) {
      // Equal as numbers ("01" and "1") is not equal as text: keep reading.
      if (Number(l) !== Number(r)) return Number(l) < Number(r) ? -1 : 1
      continue
    }
    return l < r ? -1 : 1
  }
  return 0
}
