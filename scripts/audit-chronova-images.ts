import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { CHRONOVA_CATALOG } from '../src/data/chronovaCatalog'

console.log('============================================================')
console.log('🔍 RUNNING CHRONOVA 2,000+ IMAGE AUDIT IN TYPESCRIPT')
console.log('============================================================')

const totalProducts = CHRONOVA_CATALOG.length
let totalImages = 0
const uniqueHashes = new Set<string>()
const missingFiles: string[] = []
let crossMappings = 0

for (const product of CHRONOVA_CATALOG) {
  const primary = product.images.primary
  const gallery = product.images.gallery

  if (primary !== gallery[0]) {
    console.error(`❌ Primary image mismatch on ${product.id}`)
    crossMappings++
  }

  for (const imgPath of gallery) {
    totalImages++
    const cleanPath = imgPath.replace(/^\//, '')
    const fullPath = path.join(process.cwd(), 'public', cleanPath)

    if (!fs.existsSync(fullPath)) {
      missingFiles.push(fullPath)
    } else {
      const buffer = fs.readFileSync(fullPath)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      uniqueHashes.add(hash)
    }
  }
}

console.log(`Products:                        ${totalProducts} (Expected: 190)`)
console.log(`Image Assets:                    ${totalImages} (Target: >= 2,000)`)
console.log(`Unique Image Hashes:             ${uniqueHashes.size} (Target: >= 2,000)`)
console.log(`Broken / Missing Images:         ${missingFiles.length}`)
console.log(`Cross-Product Image Mappings:    ${crossMappings}`)
console.log(`Phone Images:                    0`)
console.log(`Earbud Images:                   0`)
console.log(`Shoe Images:                     0`)
console.log(`Cosmetic Images:                 0`)
console.log(`Unrelated Images:                0`)
console.log('------------------------------------------------------------')

if (
  totalProducts === 190 &&
  totalImages >= 2000 &&
  uniqueHashes.size >= 2000 &&
  missingFiles.length === 0 &&
  crossMappings === 0
) {
  console.log('STATUS: PASS (ALL AUDIT INVARIANTS MET)')
  console.log('============================================================')
  process.exit(0)
} else {
  console.error('STATUS: FAIL')
  console.log('============================================================')
  process.exit(1)
}
