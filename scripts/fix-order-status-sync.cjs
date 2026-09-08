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
        const { data: completedStatus, error: completedStatusError } = await supabase
          .from("statuses")
          .select("id")
          .eq("code", "completed")
          .maybeSingle();

        if (completedStatusError) throw completedStatusError;

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "completed",
            status_id: completedStatus?.id || null,
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
        const { data: orderedStatus, error: orderedStatusError } = await supabase
          .from("statuses")
          .select("id")
          .eq("code", "ordered")
          .maybeSingle();

        if (orderedStatusError) throw orderedStatusError;

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "ordered",
            status_id: orderedStatus?.id || null,
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
console.log('Customer order status/status_id sync patched.');
