import { readFileSync } from 'node:fs'

/**
 * Ширина и высота JPEG из маркера SOF — чтобы width/height у <img> лендинга были правдой о файле.
 * Только для спек (node:fs): спеки текстов лендинга сверяют размеры, записанные в content/*.ts,
 * с настоящими файлами в src/assets/images/landing/<язык>/.
 */
export function jpegSize(file: string): { width: number; height: number } {
  const d = readFileSync(file)
  let i = 2
  while (i < d.length) {
    const marker = d[i + 1] ?? 0
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { height: d.readUInt16BE(i + 5), width: d.readUInt16BE(i + 7) }
    }
    i += 2 + d.readUInt16BE(i + 2)
  }
  throw new Error(`нет SOF в ${file}`)
}
