package ru.alexey.valera

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

class ErpVoiceExecutor(context: Context) {
    private val auth = ErpAuthManager(context)
    fun execute(command: ErpVoiceCommand): Result<String> = withSession { s ->
        when (command) {
            ErpVoiceCommand.OpenShift -> openShift(s)
            ErpVoiceCommand.CloseShift -> closeShift(s)
            ErpVoiceCommand.StartCutting -> startCutting(s)
            ErpVoiceCommand.FinishCutting -> "Чтобы закончить раскрой, скажи количество, например: закончи раскрой 50 штук."
            ErpVoiceCommand.Progress -> progress(s)
            ErpVoiceCommand.Print -> "Для печати нужно выбрать конкретную пачку. Открой производство и выбери этикетку."
        }
    }
    private fun openShift(s: ErpSession): String {
        if (currentShift(s) != null) return "Смена уже открыта."
        val body = JSONObject().put("user_id",s.userId).put("opened_at",now()).put("status","open").put("total_quantity",0).put("total_earned",0).put("is_paused",false).put("paused_at",JSONObject.NULL)
        request(s,"POST","employee_shifts",body.toString(),"return=representation"); return "Смена открыта."
    }
    private fun closeShift(s: ErpSession): String {
        val shift=currentShift(s)?:return "Открытой смены нет."
        request(s,"PATCH","employee_shifts?id=eq."+enc(shift.getString("id")),JSONObject().put("closed_at",now()).put("status","closed").toString(),"return=representation")
        return "Смена закрыта. За смену учтено "+shift.optInt("total_quantity",0)+" штук."
    }
    private fun startCutting(s: ErpSession): String {
        val rows=get(s,"production_order_operations?operation_name=ilike.%D0%A0%D0%B0%D1%81%D0%BA%D1%80%D0%BE%D0%B9&status=neq.done&select=id,production_order_id,status,completed_quantity,started_at&order=created_at.desc&limit=2")
        if(rows.length()==0)return "Незавершённый раскрой не найден."
        if(rows.length()>1)return "Нашёл несколько незавершённых раскроев. Ничего не запускаю."
        val op=rows.getJSONObject(0)
        if(op.optString("status")=="in_progress")return "Раскрой уже в работе. Готово "+op.optInt("completed_quantity",0)+" штук."
        val started=op.optString("started_at").takeIf{it.isNotBlank()}?:now()
        val body=JSONObject().put("status","in_progress").put("assigned_user_id",s.userId).put("assigned_at",now()).put("started_at",started)
        request(s,"PATCH","production_order_operations?id=eq."+enc(op.getString("id")),body.toString(),"return=representation")
        val orderId = op.optString("production_order_id")
        if (orderId.isNotBlank()) {
            request(s,"PATCH","production_orders?id=eq."+enc(orderId)+"&status=eq.draft",JSONObject().put("status","in_progress").toString(),"return=minimal")
        }
        return "Раскрой запущен. Уже учтено "+op.optInt("completed_quantity",0)+" штук."
    }
    fun finishCuttingAndPrint(quantity: Int): Result<String> = withSession { s ->
        require(quantity > 0) { "Количество должно быть больше нуля." }
        val rows = get(s, "production_order_operations?operation_name=ilike.%D0%A0%D0%B0%D1%81%D0%BA%D1%80%D0%BE%D0%B9&status=eq.in_progress&select=id,production_order_id,operation_name,completed_quantity,price_per_unit,started_at,sort_order&order=created_at.desc&limit=2")
        if (rows.length() == 0) error("Активный раскрой не найден.")
        if (rows.length() > 1) error("Нашёл несколько активных раскроев. Ничего не изменяю.")
        val op = rows.getJSONObject(0)
        val orderId = op.getString("production_order_id")
        val orderRows = get(s, "production_orders?id=eq."+enc(orderId)+"&select=id,order_number,quantity,status,product_id,products(name,article)&limit=1")
        if (orderRows.length() == 0) error("Производственный заказ не найден.")
        val order = orderRows.getJSONObject(0)
        val already = op.optInt("completed_quantity", 0)
        val available = (order.optInt("quantity", 0) - already).coerceAtLeast(0)
        if (quantity > available) error("Нельзя закрыть $quantity штук. Доступно $available.")
        val shift = currentShift(s) ?: error("Сначала открой смену.")
        val finishedAt = now()
        val startedAt = op.optString("started_at")
        val durationSeconds = runCatching {
            if (startedAt.isBlank()) 0 else java.time.Duration.between(java.time.Instant.parse(startedAt), java.time.Instant.parse(finishedAt)).seconds.coerceAtLeast(0)
        }.getOrDefault(0)
        val newCompleted = already + quantity
        // Завершение рабочего захода снимает операцию с in_progress.
        // Если план не выполнен, операция остаётся pending для следующего запуска.
        val nextStatus = if (newCompleted >= order.optInt("quantity", 0)) "done" else "pending"
        val earned = quantity * op.optDouble("price_per_unit", 0.0)

        request(s,"PATCH","production_order_operations?id=eq."+enc(op.getString("id")),
            JSONObject().put("status",nextStatus).put("completed_quantity",newCompleted)
                .put("completed_at",if(nextStatus=="done") finishedAt else JSONObject.NULL)
                .put("comment","Голосовое завершение через Валеру").toString(),"return=representation")

        request(s,"POST","production_operation_logs",
            JSONObject().put("production_order_id",orderId).put("production_order_operation_id",op.getString("id"))
                .put("user_id",s.userId).put("operation_name",op.optString("operation_name","Раскрой"))
                .put("quantity",quantity).put("price_per_unit",op.optDouble("price_per_unit",0.0))
                .put("earned_amount",earned).put("started_at",if(startedAt.isBlank()) JSONObject.NULL else startedAt)
                .put("finished_at",finishedAt).put("duration_seconds",durationSeconds)
                .put("comment","Голосовое завершение через Валеру").toString(),"return=representation")

        request(s,"PATCH","employee_shifts?id=eq."+enc(shift.getString("id")),
            JSONObject().put("total_quantity",shift.optInt("total_quantity",0)+quantity)
                .put("total_earned",shift.optDouble("total_earned",0.0)+earned).toString(),"return=representation")

        val batchNumber = "PK-" + System.currentTimeMillis().toString().takeLast(6)
        val product = order.optJSONObject("products")
        val productName = product?.optString("name")?.takeIf { it.isNotBlank() } ?: "Без названия"
        val article = product?.optString("article") ?: ""
        val payload = JSONObject().put("batch_number",batchNumber)
            .put("order_number",order.optString("order_number",orderId.take(8)))
            .put("product_name",productName).put("product_article",article)
            .put("color_name",JSONObject.NULL).put("quantity",quantity)

        val batchBody = JSONObject().put("production_order_id",orderId).put("source_operation_id",op.getString("id"))
            .put("batch_number",batchNumber).put("quantity",quantity).put("completed_quantity",0)
            .put("current_operation_order",2).put("status","waiting").put("qr_code",batchNumber)
            .put("product_name",productName).put("product_article",article).put("color_name",JSONObject.NULL)
            .put("qr_payload",payload).put("comment","Голосовое завершение через Валеру")
        val batchRows = JSONArray(request(s,"POST","production_batches",batchBody.toString(),"return=representation"))
        val batchId = if(batchRows.length()>0) batchRows.getJSONObject(0).optString("id") else ""

        val printPayload = JSONObject().put("printerName","Xprinter XP-365B").put("batchNumber",batchNumber)
            .put("productName",productName).put("article",article).put("quantity",quantity)
            .put("batchId",batchId).put("productionOrderId",orderId)
        request(s,"POST","print_jobs",JSONObject().put("printer_code","xprinter-main").put("job_type","qr").put("payload",printPayload).toString(),"return=representation")
        "Раскрой завершён: $quantity штук. Этикетка $batchNumber отправлена на печать."
    }

    private fun progress(s: ErpSession): String {
        val rows=get(s,"production_order_operations?operation_name=ilike.%D0%A0%D0%B0%D1%81%D0%BA%D1%80%D0%BE%D0%B9&status=neq.done&select=id,completed_quantity,status&order=created_at.desc&limit=2")
        if(rows.length()==0)return "Активный раскрой не найден."
        if(rows.length()>1)return "Есть несколько незавершённых раскроев. Уточни производственный заказ."
        return "По раскрою готово "+rows.getJSONObject(0).optInt("completed_quantity",0)+" штук."
    }
    private fun currentShift(s: ErpSession): JSONObject? {
        val rows=get(s,"employee_shifts?user_id=eq."+enc(s.userId)+"&status=eq.open&select=id,total_quantity,total_earned,opened_at&order=opened_at.desc&limit=1")
        return if(rows.length()>0)rows.getJSONObject(0)else null
    }
    private fun get(s:ErpSession,q:String)=JSONArray(request(s,"GET",q,null,null))
    private fun request(s:ErpSession,method:String,q:String,body:String?,prefer:String?):String{
        val c=URL(ErpAuthManager.BASE_URL+"/rest/v1/"+q).openConnection() as HttpURLConnection
        return try{
            c.requestMethod=method;c.connectTimeout=8000;c.readTimeout=8000
            c.setRequestProperty("apikey",ErpAuthManager.PUBLISHABLE_KEY);c.setRequestProperty("Authorization","Bearer "+s.accessToken);c.setRequestProperty("Content-Type","application/json")
            if(prefer!=null)c.setRequestProperty("Prefer",prefer)
            if(body!=null){c.doOutput=true;c.outputStream.bufferedWriter().use{it.write(body)}}
            val code=c.responseCode;val stream=if(code in 200..299)c.inputStream else c.errorStream;val text=stream.bufferedReader().use{it.readText()}
            if(code !in 200..299)error(runCatching{JSONObject(text).optString("message")}.getOrNull()?.ifBlank{null}?:"Ошибка ERP ($code)")
            text
        }finally{c.disconnect()}
    }
    private fun <T> withSession(block: (ErpSession) -> T): Result<T> = runCatching {
        val s = auth.session() ?: error("Сначала подключи ERP в приложении Валера.")
        block(s)
    }
    private fun now()=java.time.Instant.now().toString()
    private fun enc(v:String)=URLEncoder.encode(v,"UTF-8")
}

