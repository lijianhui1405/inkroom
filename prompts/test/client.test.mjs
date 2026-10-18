import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PromptClient,serviceOrigin} from '../src/client.mjs';
const image='https://static.inkroom.ai/api/prompt-assets/test/123456789012345678901234.webp';
function response(body,status=200,headers={}) { return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}}); }
test('anonymous search keeps exact prompt/example/source, strips other fields and sends no credentials',async()=>{
 let sent;
 const client=new PromptClient({fetchImpl:async(url,options)=>{ sent={url,options}; return response({kind:'library',items:[{id:'one',title:'Coffee',prompt:'Original exact prompt',tags:['café'],exampleImageUrl:image,sourceUrl:'https://github.com/source/example',privateToken:'must not pass'}]}); }});
 const value=await client.search('咖啡馆 海报');
 assert.match(sent.url,/query=/); assert.equal(sent.options.credentials,'omit'); assert.equal(sent.options.headers.Authorization,undefined); assert.equal(sent.options.redirect,'error');
 assert.equal(value.items[0].exampleImageUrl,image); assert.equal(value.items[0].prompt,'Original exact prompt'); assert.equal(value.items[0].privateToken,undefined);
});
test('optimizer is one bounded POST and cannot return a fake image',async()=>{
 let calls=0;
 const client=new PromptClient({fetchImpl:async(url,options)=>{ calls++; assert.match(url,/optimize$/); assert.deepEqual(JSON.parse(options.body),{query:'poster'}); return response({kind:'optimized',prompt:'A warm café poster',exampleImageUrl:image,model:'configured'}); }});
 const value=await client.optimize('poster'); assert.equal(calls,1); assert.equal(value.exampleImageUrl,null);
});
test('429 preserves Retry-After without retrying, and catalog error is not an empty match',async()=>{
 for(const status of [429,502,503,404]) {
  let calls=0;
  const client=new PromptClient({fetchImpl:async()=>{calls++;return response({},status,{'retry-after':'53'});}});
  await assert.rejects(client.search('coffee'),e=>e.retryAfter===53 && typeof e.code==='string'); assert.equal(calls,1);
 }
});
test('invalid origins, oversized input, malformed payloads and body limits fail closed',async()=>{
 for(const origin of ['http://evil.test','https://token@inkroom.ai','https://inkroom.ai/path','https://inkroom.ai?token=x']) assert.throws(()=>serviceOrigin(origin));
 const client=new PromptClient({fetchImpl:async()=>response({kind:'library',items:[{id:'x'}]})});
 await assert.rejects(client.search('x'.repeat(201)),{code:'invalid_input'});
 await assert.rejects(client.search('x',{limit:6}),{code:'invalid_input'});
 await assert.rejects(client.search('x'),{code:'invalid_response'});
 const large=new PromptClient({fetchImpl:async()=>new Response('x'.repeat(512*1024+1),{headers:{'content-type':'application/json'}})});
 await assert.rejects(large.search('x'),{code:'response_too_large'});
});
test('only static public prompt image URLs are returned',async()=>{
 for(const bad of ['data:image/png;base64,abc','https://inkroom.ai/api/prompt-assets/x/content','https://static.inkroom.ai.evil.test/x','https://static.inkroom.ai/api/prompt-assets/x?token=secret','https://static.inkroom.ai/auth/private']) {
  const client=new PromptClient({fetchImpl:async()=>response({kind:'library',items:[{id:'x',title:'x',prompt:'x',exampleImageUrl:bad}]})});
  assert.equal((await client.search('x')).items[0].exampleImageUrl,null);
 }
});
test('cancellation reaches network request and does not trigger another provider',async()=>{
 const controller=new AbortController(); controller.abort(); let calls=0;
 const client=new PromptClient({fetchImpl:async(_url,options)=>{calls++;options.signal.throwIfAborted();}});
 await assert.rejects(client.optimize('coffee',{signal:controller.signal}),{code:'timeout_or_cancelled'}); assert.equal(calls,1);
});

test('MCP and Skill default to the isolated free origin, never to paid APIs',async()=>{
 assert.equal(serviceOrigin(), 'https://prompts.inkroom.ai');
 const urls=[];
 const client=new PromptClient({fetchImpl:async(url)=>{urls.push(url);throw new TypeError('offline');}});
 await assert.rejects(client.search('coffee'));
 await assert.rejects(client.optimize('coffee'));
 assert.equal(urls.length,2);
 assert.equal(new URL(urls[0]).origin,'https://prompts.inkroom.ai');
 assert.equal(new URL(urls[1]).origin,'https://prompts.inkroom.ai');
});
