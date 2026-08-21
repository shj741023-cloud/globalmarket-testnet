'use strict';
function roundPi(v){return Math.round((Number(v)+Number.EPSILON)*10000000)/10000000;}
function offsetDebts(debts,userId,available,now=new Date()){
 let remaining=roundPi(available); const allocations=[];
 // The 48-hour deadline delays the trading restriction, not recovery from a
 // settlement that is already due. Confirmed debt must be offset immediately
 // so the seller is not paid funds that the same decision assigned to gas.
 const eligible=debts.filter(d=>d.userId===userId&&d.status==='confirmed_unpaid'&&d.outstandingAmount>0).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
 for(const d of eligible){if(remaining<=0)break;const amount=roundPi(Math.min(remaining,d.outstandingAmount));d.outstandingAmount=roundPi(d.outstandingAmount-amount);remaining=roundPi(remaining-amount);if(d.outstandingAmount===0){d.status='paid';d.paidAt=now.toISOString();}allocations.push({debtId:d.id,refundId:d.refundId,amount});}
 return {grossAvailable:roundPi(available),offsetAmount:roundPi(available-remaining),sellerNetAmount:remaining,allocations};
}
module.exports={offsetDebts};
