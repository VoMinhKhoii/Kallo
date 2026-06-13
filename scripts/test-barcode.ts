import { fetchProductFromOpenFoodFacts } from '../lib/barcode/openfoodfacts';

const barcode = process.argv[2];

if (!barcode) {
  console.error('Usage: bun scripts/test-barcode.ts <barcode-number>');
  process.exit(1);
}

console.log(`Fetching product information for barcode: ${barcode}...`);

fetchProductFromOpenFoodFacts(barcode)
  .then((product) => {
    if (product) {
      console.log('\nSuccess! Parsed Product Data:');
      console.log(JSON.stringify(product, null, 2));
    } else {
      console.log('\nProduct not found or failed to parse.');
    }
  })
  .catch((err) => {
    console.error('An error occurred:', err);
  });
