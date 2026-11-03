#!/bin/bash

API_URL="https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=30&page=1&sparkline=false"
OUTPUT_DIR="./scripts/data"
OUTPUT_FILE="${OUTPUT_DIR}/import-cripto.json"

mkdir -p "$OUTPUT_DIR"

echo "Fetching from CoinGecko..."

LIVE_DATA=$(curl -s "$API_URL" | jq '.')

# Add group fields (not in CoinGecko API)
# Use jq to add extra fields to each document
ENRICHED_DATA=$(echo "$LIVE_DATA" | jq '[ .[] |
  {
    id: .id,
    symbol: .symbol,
    name: .name,
    image: .image,
    current_price: .current_price,
    market_cap: .market_cap,
    market_cap_rank: .market_cap_rank,
    fully_diluted_valuation: .fully_diluted_valuation,
    total_volume: .total_volume,
    high_24h: .high_24h,
    low_24h: .low_24h,
    price_change_24h: .price_change_24h,
    price_change_percentage_24h: .price_change_percentage_24h,
    market_cap_change_24h: .market_cap_change_24h,
    market_cap_change_percentage_24h: .market_cap_change_percentage_24h,
    circulating_supply: .circulating_supply,
    total_supply: .total_supply,
    max_supply: .max_supply,
    ath: .ath,
    ath_change_percentage: .ath_change_percentage,
    ath_date: .ath_date,
    atl: .atl,
    atl_change_percentage: .atl_change_percentage,
    atl_date: .atl_date,
    roi: .roi,
    favorito: false,
    nota: "",
    comentario: "",
    atualizadoEm: null,
    criadoEm: .current_price and .name? | date -u -d "+00h" or . or now | if instanceof(Array) then .[0]? else . end | tostring,
    _grupo: "cripto-finder",
    _version: "1.0"
  }
]')

echo "$ENRICHED_DATA" > "$OUTPUT_FILE"
COUNT=$(echo "$ENRICHED_DATA" | jq 'length')
echo "Generated $COUNT documents in $OUTPUT_FILE"

echo ""
echo "To import into MongoDB:"
echo "  1. Open MongoDB Compass"
echo "  2. Connect to: mongodb://localhost:27017"
echo "  3. Create database 'cripto-db', create collection 'cripto-finder'"
echo "  4. Delete existing data in the collection"
echo "  5. Switch to 'Data Import' tab"
echo "  6. Select 'JSON Imports Common Formats'"
echo "  7. Browse and select: $OUTPUT_FILE"
echo "  8. Click 'Import'"

echo ""
echo "Or use RestHeart UI"
echo "  http://localhost:8080/docs"
echo "  Navigate to POST /data/cripto-db/cripto-finder"
echo "  Paste the JSON content from $OUTPUT_FILE"