const fs = require('fs');
const file = 'src/pages/warehouse/SalesPage.tsx';
let text = fs.readFileSync(file, 'utf8');

const oldBlock = `        const missingArticles = articles.filter(
          (article) => !foundByArticle.has(article.trim().toLowerCase()),
        );

        if (missingArticles.length > 0) {
          const { data: legacyProducts, error: legacyProductsError } = await supabase
            .from("products")
            .select("id, name, article, is_active")
            .eq("is_active", true);

          if (legacyProductsError) throw legacyProductsError;

          const missingArticleKeys = new Set(
            missingArticles.map((article) => article.trim().toLowerCase()),
          );

          ((legacyProducts || []) as any[]).forEach((product) => {
            const key = String(product.article ?? "").trim().toLowerCase();
            if (!key || !missingArticleKeys.has(key)) return;

            const list = foundByArticle.get(key) || [];
            list.push({
              id: product.id,
              item_type: "product",
              name: product.name,
              article: product.article,
              is_active: product.is_active,
              source_table: "products",
              source_id: product.id,
            });
            foundByArticle.set(key, list);
          });
        }`;

const newBlock = `        const missingArticleKeys = new Set(
          articles
            .map((article) => article.trim().toLowerCase())
            .filter((article) => !foundByArticle.has(article)),
        );

        if (missingArticleKeys.size > 0) {
          products.forEach((product) => {
            const key = String(product.article ?? "").trim().toLowerCase();
            if (!key || !missingArticleKeys.has(key)) return;

            const list = foundByArticle.get(key) || [];
            list.push({
              id: product.id,
              item_type: "product",
              name: product.name,
              article: product.article,
              source_table: "products",
              source_id: product.id,
            });
            foundByArticle.set(key, list);
          });
        }`;

const count = text.split(oldBlock).length - 1;
if (count !== 1) throw new Error(`Expected exactly one legacy fallback block, found ${count}`);

text = text.replace(oldBlock, newBlock);
fs.writeFileSync(file, text, 'utf8');
console.log('SalesPage Excel import fallback now uses loaded products.');
