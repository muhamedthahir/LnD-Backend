const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isReleased}=require('../utils/resultRelease');
test('disabled result release never exposes results',()=>{
 for(const enabled of [false,0,'0',null,undefined,'never'])assert.equal(isReleased(enabled,null),false);
});
test('scheduled results release only at a valid elapsed time',()=>{
 const now=Date.UTC(2026,9,14);
 assert.equal(isReleased(true,'2026-10-15T00:00:00Z',now),false);
 assert.equal(isReleased(true,'2026-10-14T00:00:00Z',now),true);
 assert.equal(isReleased(true,'invalid',now),false);
 assert.equal(isReleased(1,null,now),true);
 assert.equal(isReleased(true,'2026-10-14 05:30:00',now),true);
 assert.equal(isReleased(true,'2026-10-14 05:31:00',now),false);
});
