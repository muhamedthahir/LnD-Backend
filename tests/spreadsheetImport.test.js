const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
process.env.JWT_SECRET='spreadsheet-tests-only';
const s3=require('../services/s3Service');
const service=require('../services/spreadsheetImport');
function payload(extra={}){return {userId:7,purpose:'programming',key:'imports/spreadsheets/7/sample.xlsx',bytes:4,expiresAt:Date.now()+60000,...extra};}
test('upload tickets are bound to account, purpose, signature and expiry',()=>{
 const ticket=service.sign(payload());
 assert.equal(service.verify(ticket,7,'programming').bytes,4);
 for(const [token,id,purpose] of [[ticket,8,'programming'],[ticket,7,'mcq'],[ticket+'x',7,'programming'],[service.sign(payload({expiresAt:0})),7,'programming'],[service.sign(payload({bytes:service.MAX_BYTES+1})),7,'programming']])assert.throws(()=>service.verify(token,id,purpose));
});
test('presigning validates workbook metadata before touching S3',async()=>{
 let calls=0;const original=s3.generatePresignedUploadUrl;s3.generatePresignedUploadUrl=async()=>{calls++;return {presignedUrl:'https://storage.example.invalid/upload'};};
 try{
  for(const input of [{fileName:'x.exe',fileSize:4,purpose:'programming'},{fileName:'x.xlsx',fileSize:service.MAX_BYTES+1,purpose:'programming'},{fileName:'x.xlsx',fileSize:4,purpose:'unknown'}])await assert.rejects(service.prepare(7,input));
  assert.equal(calls,0);
  const result=await service.prepare(7,{fileName:'x.xlsx',fileSize:4,purpose:'mcq'});
  assert.equal(calls,1);assert.equal(service.verify(result.importTicket,7,'mcq').bytes,4);assert.ok(Buffer.byteLength(JSON.stringify(result))<7000);
 }finally{s3.generatePresignedUploadUrl=original;}
});
test('bounded workbook download removes its temporary object on success and failure',async()=>{
 const get=s3.getFile,del=s3.deleteFile;const deleted=[];s3.deleteFile=async key=>deleted.push(key);
 try{
  s3.getFile=async()=>({contentLength:4,body:Readable.from([Buffer.from('test')])});
  const req={user:{id:7},body:{importTicket:service.sign(payload())}};
  assert.equal((await service.readWorkbook(req,'programming')).toString(),'test');
  s3.getFile=async()=>({contentLength:4,body:Readable.from([Buffer.from('too large')])});
  await assert.rejects(service.readWorkbook(req,'programming'),/too large/);
  assert.equal(deleted.length,2);assert.ok(deleted.every(key=>key==='imports/spreadsheets/7/sample.xlsx'));
  await assert.rejects(service.readWorkbook({...req,user:{id:8}},'programming'));
  assert.equal(deleted.length,2);
 }finally{s3.getFile=get;s3.deleteFile=del;}
});
test('existing multipart workbook clients remain supported',async()=>{
 const bytes=Buffer.from('test');assert.equal(await service.readWorkbook({file:{buffer:bytes}},'mcq'),bytes);
 await assert.rejects(service.readWorkbook({file:{buffer:Buffer.alloc(service.MAX_BYTES+1)}},'mcq'));
});
