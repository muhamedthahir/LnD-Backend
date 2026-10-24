const {test}=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../config/db');
let calls=[];
const pool={execute:async(sql,values)=>{calls.push({sql,values});return [{insertId:1}];}};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const Course=require('../models/Course');
test('course tags preserve commas within labels and can be cleared',async()=>{
 calls=[];await Course.update(1,{tags:['Python','Data, analysis']});
 assert.match(calls[0].sql,/tags = \?/);assert.deepEqual(JSON.parse(calls[0].values[0]),['Python','Data, analysis']);
 await Course.update(1,{tags:[]});assert.deepEqual(JSON.parse(calls[1].values[0]),[]);
});
test('unrelated course edits preserve stored tags',async()=>{
 calls=[];await Course.update(1,{name:'Edited course'});assert.doesNotMatch(calls[0].sql,/tags =/);
});
test('course creation stores tags as valid JSON, including legacy clients',async()=>{
 calls=[];await Course.create({name:'QA',category:'Python',competency_level:'beginner',short_description:'QA',course_outcomes:'QA',created_by:1,tags:'Python, QA'});
 assert.match(calls[0].sql,/tags/);assert.ok(calls[0].values.includes('["Python","QA"]'));
});
