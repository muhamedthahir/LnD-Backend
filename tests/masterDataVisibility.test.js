const {test}=require('node:test');
const assert=require('node:assert/strict');
// Keep this controller test entirely outside any configured database.
const dbPath=require.resolve('../config/db');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{execute:async()=>{throw Error('Unexpected database access')}}};
const Language=require('../models/Language'),Category=require('../models/Category');
const Controller=require('../controllers/masterDataController');
for(const role of ['primary_admin','campuszen_admin','college_admin','student'])for(const kind of ['languages','categories']){
 test(`${role} ${kind}: inactive settings visibility respects role`,async()=>{
  const visible=role==='primary_admin'||role==='campuszen_admin';
  const originalActive=Language.getAll,originalAll=Language.getAllIncludingInactive,originalCategories=Category.getAllWithHierarchy;
  let called;
  Language.getAll=async()=>{called=false;return [{name:'active'}]};
  Language.getAllIncludingInactive=async()=>{called=true;return [{name:'active'},{name:'inactive'}]};
  Category.getAllWithHierarchy=async all=>{called=all;return all?[{name:'active'},{name:'inactive'}]:[{name:'active'}]};
  try{
   let body;const res={json:x=>{body=x},status:()=>res};
   await Controller[kind==='languages'?'getLanguages':'getCategories']({query:{includeInactive:'true'},user:{role}},res);
   assert.equal(called,visible);assert.equal(body[kind].length,visible?2:1);
  }finally{Language.getAll=originalActive;Language.getAllIncludingInactive=originalAll;Category.getAllWithHierarchy=originalCategories;}
 });
}
test('default language dropdown still excludes inactive records for platform admins',async()=>{
 const original=Language.getAll;Language.getAll=async()=>[{name:'active'}];
 try{let body;const res={json:x=>{body=x},status:()=>res};await Controller.getLanguages({query:{},user:{role:'primary_admin'}},res);assert.deepEqual(body.languages,[{name:'active'}]);}finally{Language.getAll=original;}
});
