import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage { body?: unknown }
export interface VercelResponse extends ServerResponse { status:(code:number)=>VercelResponse; json:(body:unknown)=>void; setHeader:(name:string,value:string)=>this }
type Action='Retry payment'|'Payment link'|'Capture payment'|'Fetch payment'
type RequestBody={action?:Action;transactionId?:string;amount?:number;paymentId?:string;currency?:string}
const RAZORPAY_URL='https://api.razorpay.com/v1'
const authHeader=(id:string,secret:string)=>`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
const send=(res:VercelResponse,status:number,body:unknown)=>res.status(status).json(body)
async function razorpayRequest(path:string,keyId:string,keySecret:string,init:RequestInit={}){return fetch(`${RAZORPAY_URL}${path}`,{...init,headers:{Authorization:authHeader(keyId,keySecret),'Content-Type':'application/json',...(init.headers||{})}})}
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type')
 if(req.method==='OPTIONS'){res.status(204).end();return} if(req.method!=='POST'){send(res,405,{error:'Method not allowed'});return}
 const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET;if(!keyId||!keySecret){send(res,500,{error:'Razorpay Test Mode credentials are not configured on the server'});return}
 const body=(req.body||{}) as RequestBody,action=body.action,amount=body.amount,currency=body.currency||'INR';if(!action){send(res,400,{error:'action is required'});return}
 if(action==='Capture payment'||action==='Fetch payment'){if(!body.paymentId||!/^pay_[A-Za-z0-9]+$/.test(body.paymentId)){send(res,400,{error:'A valid Razorpay paymentId is required'});return}}else if(typeof amount!=='number'||!Number.isInteger(amount)||amount<1){send(res,400,{error:'amount must be a positive integer in rupees'});return}
 try{
  if(action==='Fetch payment'){const upstream=await razorpayRequest(`/payments/${body.paymentId}`,keyId,keySecret);const data=await upstream.json();if(!upstream.ok){send(res,upstream.status,{error:data?.error?.description||'Razorpay payment lookup failed'});return}send(res,200,{provider:'razorpay',mode:'test',action,payment:data,verified:data.status==='captured'});return}
  if(action==='Capture payment'){const upstream=await razorpayRequest(`/payments/${body.paymentId}/capture`,keyId,keySecret,{method:'POST',body:JSON.stringify({amount:amount!*100,currency})});const data=await upstream.json();if(!upstream.ok){send(res,upstream.status,{error:data?.error?.description||'Razorpay capture failed'});return}send(res,200,{provider:'razorpay',mode:'test',action,payment:data,verified:data.status==='captured'});return}
  if(action==='Payment link'){const referenceId=`${body.transactionId||'txn'}-${Date.now()}`.slice(0,40);const upstream=await razorpayRequest('/payment_links',keyId,keySecret,{method:'POST',body:JSON.stringify({amount:amount!*100,currency,description:`RazorRecover recovery for ${body.transactionId||'transaction'}`,reference_id:referenceId,notes:{source:'RazorRecover AI',transaction_id:body.transactionId||'unknown'}})});const data=await upstream.json();if(!upstream.ok){send(res,upstream.status,{error:data?.error?.description||'Razorpay Payment Link creation failed'});return}send(res,200,{provider:'razorpay',mode:'test',action,paymentLink:data.short_url,paymentLinkId:data.id,status:data.status,verified:false});return}
  const receipt=`${body.transactionId||'txn'}-${Date.now()}`.slice(0,40);const upstream=await razorpayRequest('/orders',keyId,keySecret,{method:'POST',body:JSON.stringify({amount:amount!*100,currency,receipt,notes:{source:'RazorRecover AI',transaction_id:body.transactionId||'unknown'}})});const data=await upstream.json();if(!upstream.ok){send(res,upstream.status,{error:data?.error?.description||'Razorpay Order creation failed'});return}send(res,200,{provider:'razorpay',mode:'test',action:'Retry payment',orderId:data.id,amount:data.amount,currency:data.currency,status:data.status,keyId,verified:false})
 }catch(error){send(res,502,{error:error instanceof Error?error.message:'Unable to reach Razorpay'})}
}
