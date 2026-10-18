import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createPromptServer} from '../src/server.mjs';
import {createHttpApp} from '../src/http.mjs';
const image='https://static.inkroom.ai/api/prompt-assets/x/123456789012345678901234.webp';
const stub={search:async()=>({kind:'library',items:[{id:'x',title:'Coffee',prompt:'Original',exampleImageUrl:image}]}),optimize:async()=>({kind:'optimized',prompt:'Better prompt',exampleImageUrl:null})};
test('real SDK initialize, tool schema, structured content and resource link',async()=>{
 const [a,b]=InMemoryTransport.createLinkedPair(); const server=createPromptServer(stub); const client=new Client({name:'acceptance',version:'1'});
 await server.connect(a); await client.connect(b);
 try {
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['search_prompts','optimize_prompt']);
  const result=await client.callTool({name:'search_prompts',arguments:{query:'coffee'}});
  assert.equal(result.structuredContent.items[0].prompt,'Original'); assert.equal(result.content[1].type,'resource_link'); assert.equal(result.content[1].uri,image);
  const optimized=await client.callTool({name:'optimize_prompt',arguments:{query:'coffee'}});
  assert.equal(optimized.content.length,1); assert.equal(optimized.structuredContent.exampleImageUrl,null);
  const invalid=await client.callTool({name:'search_prompts',arguments:{query:'',limit:100}}); assert.equal(invalid.isError,true);
 } finally {await client.close();await server.close();}
});
test('tool failures are isError and do not invoke automatic optimization',async()=>{
 const [a,b]=InMemoryTransport.createLinkedPair(); let optimize=0;
 const server=createPromptServer({search:async()=>{throw Object.assign(new Error('limited'),{code:'rate_limited',retryAfter:60});},optimize:async()=>{optimize++;}});
 const client=new Client({name:'errors',version:'1'}); await server.connect(a); await client.connect(b);
 try {const result=await client.callTool({name:'search_prompts',arguments:{query:'coffee'}});assert.equal(result.isError,true);assert.equal(optimize,0);assert.equal(JSON.parse(result.content[0].text).error.retryAfter,60);}
 finally {await client.close();await server.close();}
});
test('STDIO CLI initializes without auth or stdout noise',async()=>{
 const client=new Client({name:'stdio-test',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:['src/cli.mjs'],stderr:'pipe'});
 await client.connect(transport);
 try {assert.equal((await client.listTools()).tools.length,2);} finally {await client.close();}
});
test('Streamable HTTP works without auth and rejects hostile Origin and Host',async()=>{
 const listener=createHttpApp(stub).listen(0,'127.0.0.1'); await new Promise(resolve=>listener.once('listening',resolve));
 const url=new URL(`http://127.0.0.1:${listener.address().port}/mcp`);
 const client=new Client({name:'http-test',version:'1'});
 try {
  await client.connect(new StreamableHTTPClientTransport(url));
  const result=await client.callTool({name:'search_prompts',arguments:{query:'coffee'}}); assert.equal(result.structuredContent.kind,'library');
  assert.equal((await fetch(url,{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=request(url,{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);
  assert.equal((await fetch(url)).status,405);
 } finally {await client.close(); await new Promise(resolve=>listener.close(resolve));}
});
