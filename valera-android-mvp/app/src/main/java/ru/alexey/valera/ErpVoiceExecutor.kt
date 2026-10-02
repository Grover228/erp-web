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
        val rows=get(s,"production_order_operations?operation_name=ilike.%D0%A0%D0%B0%D1%81%D0%BA%D1%80%D0%BE%D0%B9&status=neq.done&select=id,status,completed_quantity,started_at&order=created_at.desc&limit=2")
        if(rows.length()==0)return "Незавершённый раскрой не найден."
        if(rows.length()>1)return "Нашёл несколько незавершённых раскроев. Ничего не запускаю."
        val op=rows.getJSONObject(0)
        if(op.optString("status")=="in_progress")return "Раскрой уже в работе. Готово "+op.optInt("completed_quantity",0)+" штук."
        val started=op.optString("started_at").takeIf{it.isNotBlank()}?:now()
        val body=JSONObject().put("status","in_progress").put("assigned_user_id",s.userId).put("assigned_at",now()).put("started_at",started)
        request(s,"PATCH","production_order_operations?id=eq."+enc(op.getString("id")),body.toString(),"return=representation")
        return "Раскрой запущен. Уже учтено "+op.optInt("completed_quantity",0)+" штук."
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
    private fun <T> withSession(block:(ErpSession)->T):Result<T>=runCatching{
        var s=auth.session()?:error("Сначала подключи ERP в приложении Валера.")
        try{block(s)}catch(first:Throwable){s=auth.refresh().getOrElse{throw first};block(s)}
    }
    private fun now()=java.time.Instant.now().toString()
    private fun enc(v:String)=URLEncoder.encode(v,"UTF-8")
}
