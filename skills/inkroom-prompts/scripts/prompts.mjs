#!/usr/bin/env node
import {PromptClient} from './client.mjs';
const [action, query, ...rest] = process.argv.slice(2);
if (!['search','optimize'].includes(action) || !query || rest.length) {
  console.error('Usage: node scripts/prompts.mjs search|optimize "your keywords or image idea"');
  process.exitCode = 2;
} else {
  try {
    const client = new PromptClient({origin:process.env.INKROOM_PROMPTS_ORIGIN});
    console.log(JSON.stringify(await client[action](query)));
  } catch (error) {
    console.log(JSON.stringify({error:{code:error.code || 'unexpected_error',message:error.code ? error.message : 'Prompt operation failed.',retryAfter:error.retryAfter ?? null}}));
    process.exitCode = 1;
  }
}
