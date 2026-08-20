'use strict';
const PLATFORM_PAYOUT_GAS_FEE = 0.01;
function roundPi(v){ return Math.round((Number(v)+Number.EPSILON)*10000000)/10000000; }
function createMockPayoutBatch(compensations, input, now=new Date()) {
  const eligible=compensations.filter(i=>i.status==='confirmed' && i.currentlyPayableAmount>0 && !i.payoutId);
  if(!eligible.length) throw Object.assign(new Error('지급 대기 보상금이 없습니다.'),{code:'NO_COMPENSATION_PAYOUTS'});
  const batch={id:input.id,isSimulation:true,status:'mock_completed',itemCount:eligible.length,totalAmount:roundPi(eligible.reduce((s,i)=>s+i.currentlyPayableAmount,0)),platformGasFee:PLATFORM_PAYOUT_GAS_FEE,processedBy:input.adminId,completedAt:now.toISOString()};
  eligible.forEach(i=>{i.payoutId=batch.id;i.status='mock_paid';i.mockPaidAt=batch.completedAt;});
  return {batch,items:eligible};
}
module.exports={PLATFORM_PAYOUT_GAS_FEE,createMockPayoutBatch};
