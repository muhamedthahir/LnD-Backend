const {test}=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../config/db');
const pool={execute:async()=>[[{id:7,name:'QA Student',email:'qa@example.invalid',role:'student',role_id:3,degree:'B.Tech',password_set:1,section:'B'}]]};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const User=require('../models/User');
test('user detail preserves degree, activation and role metadata for editing',async()=>{
 const user=await User.findById(7);
 assert.equal(user.degree,'B.Tech');assert.equal(user.password_set,true);assert.equal(user.role_id,3);
 assert.equal(user.section,'B');assert.equal(user.password,undefined);
});
test('pending users keep their activation state without leaking credential fields',async()=>{
 pool.execute=async()=>[[{id:8,name:'QA Pending',role:'student',password_set:0,password:'not-returned',otp:'not-returned'}]];
 const user=await User.findById(8);assert.equal(user.password_set,false);assert.equal(user.degree,null);
 assert.equal(user.password,undefined);assert.equal(user.otp,undefined);
});
