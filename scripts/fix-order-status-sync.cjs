const fs = require('fs');
const file = 'src/pages/warehouse/CustomerShipmentModal.tsx';
let text = fs.readFileSync(file, 'utf8');

const oldPost = `      if (currentShipment.customer_order_id) {
        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "completed",
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }`;

const newPost = `      if (currentShipment.customer_order_id) {
        const { data: orderStatusCategory, error: orderStatusCategoryError } = await supabase
          .from("status_categories")
          .select("id")
          .eq("code", "customer_orders")
          .single();

        if (orderStatusCategoryError) throw orderStatusCategoryError;

        const { data: completedStatus, error: completedStatusError } = await supabase
          .from("statuses")
          .select("id")
          .eq("category_id", orderStatusCategory.id)
          .eq("code", "completed")
          .single();

        if (completedStatusError) throw completedStatusError;

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "completed",
            status_id: completedStatus.id,
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }`;

const oldUnpost = `      if (currentShipment.customer_order_id) {
        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "ordered",
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }`;

const newUnpost = `      if (currentShipment.customer_order_id) {
        const { data: orderStatusCategory, error: orderStatusCategoryError } = await supabase
          .from("status_categories")
          .select("id")
          .eq("code", "customer_orders")
          .single();

        if (orderStatusCategoryError) throw orderStatusCategoryError;

        const { data: draftStatus, error: draftStatusError } = await supabase
          .from("statuses")
          .select("id")
          .eq("category_id", orderStatusCategory.id)
          .eq("code", "draft")
          .single();

        if (draftStatusError) throw draftStatusError;

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "draft",
            status_id: draftStatus.id,
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }`;

for (const [label, oldBlock, newBlock] of [['post', oldPost, newPost], ['unpost', oldUnpost, newUnpost]]) {
  const count = text.split(oldBlock).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  text = text.replace(oldBlock, newBlock);
}

fs.writeFileSync(file, text, 'utf8');
console.log('Customer order status/status_id sync patched with customer_orders category.');
