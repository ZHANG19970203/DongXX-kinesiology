// Copy a prior session; never overwrite the old localStorage entry or invent new evidence.
export function migrateProgress(prior,version,flow,at) {
  const result=structuredClone(prior);
  if(!['v13','v12'].includes(version)&&result.taskState)result.taskState={...result.taskState,values:{},phase:0,pressureMode:'static'};
  if(!['v13','v12'].includes(version))result.barefootPrepared=!['act1','act2'].includes(flow[prior.node].act);
  const stage=flow[prior.node]?.act;
  const current=Number(stage?.replace('act',''))||9;
  const missing=[];
  if(current>3&&!result.taskReceipts?.muscle_match)missing.push('muscle_match');
  if(current>4&&!result.taskReceipts?.arch_compare)missing.push('arch_compare');
  result.records=[...(result.records||[])];
  if(missing.length)result.records.push({nodeId:prior.node,migration:'v14',newLearningNotPerformed:missing});
  result.appearanceMigration={from:version,to:'v14',at,historyRetained:true,taskValuesRetained:['v13','v12'].includes(version),displayAlias:{'陈先生':'陈女士'}};
  result.scriptVersion='v14';
  return result;
}
