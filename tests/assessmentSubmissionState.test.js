const {test}=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../config/db');
let calls=[];
const pool={execute:async(sql,params)=>{calls.push({sql,params});return sql.includes('SELECT * FROM scoring_configs')?[[{threshold_for_pass:0,threshold_type:'PERCENTAGE'}]]:[{affectedRows:1}];}};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const {AssessmentSegmentProgress}=require('../models/AssessmentConfigs');
AssessmentSegmentProgress.updateMappingTotalScore=async()=>({totalScore:0,percentageScore:0,maxPossibleScore:5});
const Mapping=require('../models/AssessmentUserMapping');
Mapping.findById=async()=>({id:2,status:'IN_PROGRESS',assessment_administrator_id:1});
Mapping.syncAssignmentWeightages=async()=>{};
test('submitting completes active segments and preserves a zero pass threshold',async()=>{
 await Mapping.submitAssessment(2);
 assert.ok(calls.some(call=>call.sql.includes('UPDATE assessment_segment_progress')&&call.sql.includes("status = 'COMPLETED'")&&call.params[0]===2));
 const mappingWrite=calls.find(call=>call.sql.includes('UPDATE assessment_user_mappings SET'));
 assert.equal(mappingWrite.params[2],true);
});
