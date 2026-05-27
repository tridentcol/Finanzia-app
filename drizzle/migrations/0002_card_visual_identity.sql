-- Identidad visual de la tarjeta. Todos los campos son opcionales y
-- decorativos: bank_slug + card_product_slug indexan el catálogo curado
-- en src/lib/cards/catalog.ts para resolver imagen y wordmark. card_brand
-- identifica la red (visa/mastercard/amex). card_last_four y
-- card_holder_name son metadata del usuario, se renderizan junto a la
-- imagen del banco (no sobre ella — no editamos el arte original).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_slug text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_product_slug text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_last_four text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_holder_name text;
