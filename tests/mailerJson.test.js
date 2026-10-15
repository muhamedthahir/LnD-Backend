const {test}=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../config/db');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{}};
const MailerTemplate=require('../models/MailerTemplate');
test('mailer variables and tags survive MySQL native JSON and string JSON responses',()=>{
 const variables=['userName','courseName'];
 assert.deepEqual(MailerTemplate.safeJsonParse(variables),variables);
 assert.deepEqual(MailerTemplate.safeJsonParse(JSON.stringify(variables)),variables);
 assert.deepEqual(MailerTemplate.safeJsonParse('broken'),[]);
});
