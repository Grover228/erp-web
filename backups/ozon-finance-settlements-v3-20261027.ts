import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,clientId=Deno.env.get("OZON_CLIENT_ID"),apiKey=Deno.env.get("OZON_API_KEY");
 if(!clientId||!apiKey)return json({error:"Ozon API credentials unavailable"},503);
 const auth=req.headers.get("Authorization")||"";
 const db=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return json({error:"Требуется вход в ERP"},401);
 const {data:emp}=await db.from("employees").select("app_role,role").eq("auth_user_id",user.id).maybeSingle();
 if((emp?.app_role||emp?.role)!=="admin")return json({error:"Доступ только администратору"},403);
 const body=await req.json().catch(()=>({}));
 const from=String(body.from||new Date(Date.now()-31*86400000).toISOString().slice(0,10));
 const to=String(body.to||new Date().toISOString().slice(0,10));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return json({error:"Неверный период"},400);
 async function ozon(path:string,payload:unknown){
  const res=await fetch("https://api-seller.ozon.ru"+path,{method:"POST",headers:{"Client-Id":clientId!,"Api-Key":apiKey!,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const raw=await res.text();let data:any;try{data=JSON.parse(raw)}catch{data={raw:raw.slice(0,300)}}
  if(!res.ok)throw new Error(path+": HTTP "+res.status+" "+String(data?.message||data?.error||"").slice(0,250));
  return data;
 }
 const result:any={fetchedAt:new Date().toISOString(),period:{from,to},balance:null,cashFlows:[],errors:[]};
 try{result.balance=await ozon("/v1/finance/balance",{date_from:from,date_to:to})}catch(e){result.errors.push(String(e))}
 try{
  for(let page=1;page<=20;page++){
   const response=await ozon("/v1/finance/cash-flow-statement/list",{date:{from:from+"T00:00:00.000Z",to:to+"T23:59:59.999Z"},page,page_size:100,with_details:true});
   const rows=response?.result?.cash_flows||[];
   result.cashFlows.push(...rows);
   if(page>=Number(response?.result?.page_count||response?.page_count||1)||rows.length===0)break;
  }
 }catch(e){result.errors.push(String(e))}
 if(!result.balance&&!result.cashFlows.length)return json(result,502);
 return json(result);
});