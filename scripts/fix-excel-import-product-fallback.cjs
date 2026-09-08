const fs = require('fs');
const file = 'src/pages/warehouse/SalesPage.tsx';
let text = fs.readFileSync(file, 'utf8');
const oldBlock = `        const { data, error: itemsError } = await supabase
          .from("items")
          .select("id, item_type, name, article, is_active, source_table, source_id")
          .eq("is_active", true)
          .in("article", articles);

        if (itemsError) throw itemsError;

        const foundByArticle = new Map<string, any[]>();
        ((data || []) as any[]).forEach((item) => {
          const key = String(item.article ?? "").trim().toLowerCase();
          const list = foundByArticle.get(key) || [];
          list.push(item);
          foundByArticle.set(key, list);
        });`;
const newBlock = `        const { data, error: itemsError } = await supabase
          .from("items")
          .select("id, item_type, name, article, is_active, source_table, source_id")
          .eq("is_active", true)
          .in("article", articles);

        if (itemsError) throw itemsError;

        const foundByArticle = new Map<string, any[]>();
        ((data || []) as any[]).forEach((item) => {
          const key = String(item.article ?? "").trim().toLowerCase();
          const list = foundByArticle.get(key) || [];
          list.push(item);
          foundByArticle.set(key, list);
        });

        const missingArticles = articles.filter(
          (article) => !foundByArticle.has(article.trim().toLowerCase()),
        );

        if (missingArticles.length > 0) {
          const { data: legacyProducts, error: legacyProductsError } = await supabase
            .from("products")
            .select("id, name, article, is_active")
            .eq("is_active", true)
            .in("article", missingArticles);

          if (legacyProductsError) throw legacyProductsError;

          ((legacyProducts || []) as any[]).forEach((product) => {
            const key = String(product.article ?? "").trim().toLowerCase();
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
const count = text.split(oldBlock).length - 1;
if (count !== 1) throw new Error(`Expected exactly one import lookup block, found ${count}`);
text = text.replace(oldBlock, newBlock);
fs.writeFileSync(file, text, 'utf8');
console.log('SalesPage Excel import fallback patched.');
