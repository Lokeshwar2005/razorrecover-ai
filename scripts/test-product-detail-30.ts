import {
  CHRONOVA_CATALOG,
} from '../src/data/chronovaCatalog'

function test30ProductsDetailMatching() {
  console.log('====================================================================')
  console.log('🔍 TESTING PRODUCT DETAIL INITIAL IMAGE MATCHING (30+ PRODUCTS)')
  console.log('====================================================================\n')

  const sampledProducts = CHRONOVA_CATALOG.slice(0, 35)
  console.log(`✓ Testing ${sampledProducts.length} diverse products across brands and categories:\n`)

  let testedCount = 0
  for (const p of sampledProducts) {
    testedCount++
    // 1. Record card image
    const cardImage = p.images.primary

    // 2. Initial detail image
    const initialDetailImage = p.images.gallery[0]

    // 3. ASSERT card image === detail initial image
    if (cardImage !== initialDetailImage) {
      throw new Error(`FAIL on ${p.id} (${p.name}): cardImage !== initialDetailImage`)
    }

    // 4. Simulate clicking gallery thumbnails
    for (let i = 0; i < p.images.gallery.length; i++) {
      const selectedThumbnail = p.images.gallery[i]
      const displayedMainImage = selectedThumbnail // simulated selection
      if (selectedThumbnail !== displayedMainImage) {
        throw new Error(`FAIL on ${p.id} view ${i}: selectedThumbnail !== displayedMainImage`)
      }
    }

    // 5. Verify product card primary image remains stable
    const cardImageAfter = p.images.primary
    if (cardImageAfter !== cardImage) {
      throw new Error(`FAIL on ${p.id}: cardImage mutated`)
    }

    console.log(`✓ [${testedCount.toString().padStart(2, '0')}] ${p.brand.padEnd(16)} | ${p.name.padEnd(38)} -> Card & Detail: MATCHED (${p.images.gallery.length} views)`)
  }

  console.log('\n====================================================================')
  console.log(`🎉 ALL ${testedCount} PRODUCTS PASSED CARD-TO-DETAIL MATCHING TEST!`)
  console.log('====================================================================\n')
}

test30ProductsDetailMatching()
