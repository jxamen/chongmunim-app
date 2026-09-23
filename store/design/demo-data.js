// Store-only fictional data. No production writes.
const names=['김민준','이서연','박지호','최수빈','정도윤','강하은','조예준','윤지우','장서준'];
const member={id:901,name:names[0],provider:'google',needsSignup:false};
const group={id:901,name:'주말 등산 동호회',owner:names[0],members:9,admins:1,categories:4,duesAmount:30000,plan:'pro',planUntil:null,planPaid:false,inviteCode:'DEMO09',me:{id:901,name:names[0],role:'owner',notify:{notice:true,dues:true,request:true}}};
const categories=[{id:1,name:'회비',kind:'in'},{id:2,name:'식비',kind:'out'},{id:3,name:'교통비',kind:'out'},{id:4,name:'준비물',kind:'out'}];
const entries=[{id:11,direction:'out',amount:84000,occurredAt:'2026-09-20',merchant:'산마루 식당',categoryId:2,memo:'정기산행 뒤풀이',by:'김민준',receiptId:'demo-receipt',source:'receipt',edited:[]},{id:12,direction:'out',amount:36000,occurredAt:'2026-09-20',merchant:'등산로 주차장',categoryId:3,memo:'차량 3대 주차',by:'김민준',edited:[]},{id:13,direction:'out',amount:18000,occurredAt:'2026-09-19',merchant:'우리동네 마트',categoryId:4,memo:'생수와 간식',by:'김민준',edited:[]},...names.slice(0,7).map((n,i)=>({id:20+i,direction:'in',amount:30000,occurredAt:'2026-09-05',categoryId:1,memo:n+' 9월 회비',by:'김민준',edited:[]}))];
const month={month:'2026-09',carryIn:1173000,in:210000,out:138000,carryOut:1245000,uncategorized:0,groups:categories.map(c=>{const es=entries.filter(e=>e.categoryId===c.id);return {direction:c.kind,categoryId:c.id,name:c.name,count:es.length,sum:es.reduce((a,e)=>a+e.amount,0),entries:es};})};
const notice={id:31,title:'10월 정기산행 안내',author:'김민준',authorRole:'owner',audience:'all',status:'sent',sentAt:'2026-09-24 00:00:00',recipients:8,reads:6,readByMe:true,push:true,body:'10월 10일 토요일, 함께 가을 산행해요.\n\n집합  오전 8시 · 사당역 4번 출구\n코스  관악산 둘레길 (약 3시간)\n준비  등산화, 물, 가벼운 간식\n\n참석 여부를 총무에게 알려 주세요.\n즐겁고 안전하게 다녀와요!'};
const closing={id:41,kind:'month',ref:'2026-08',title:'8월 결산',closedAt:'2026-08-31 11:00:00',snapshot:{...month,month:'2026-08',carryIn:1011000,in:270000,out:108000,carryOut:1173000,groups:[{name:'회비',direction:'in',count:9,sum:270000},{name:'식비',direction:'out',count:1,sum:72000},{name:'교통비',direction:'out',count:1,sum:24000},{name:'준비물',direction:'out',count:1,sum:12000}]}};
const receipt={id:'demo-receipt',verdict:'confirmed',store:'산마루 식당',merchant:'산마루 식당',paidAt:'2026-09-20 13:24:00',total:84000,items:[{name:'산채비빔밥',price:10000,count:7},{name:'해물파전',price:14000,count:1}],needsCheck:false,suggestCategoryId:2,imageUrl:'http://127.0.0.1:8123/store-demo-receipt.png'};
const job={jobId:'demo-job',state:'ready',review:false,receipt};
function response(path,method,state){
 if(path==='auth/me')return {member};
 if(path==='auth/providers')return {providers:[]};
 if(path==='cm/groups')return {groups:[{...group,role:'owner'}]};
 if(path==='cm/g/901')return {group};
 const p=path.replace(/^cm\/g\/901\/?/,'');
 if(p==='home')return {balance:1245000,month:{month:'2026-09',in:210000,out:138000},budget:{year:2026,total:3000000,spent:1860000,percent:62},pending:{count:2,sum:66000},notice,recent:entries.slice(0,3),categories:Object.fromEntries(categories.map(c=>[c.id,c.name]))};
 if(p==='categories')return {categories};
 if(p==='events')return {events:[{id:51,name:'9월 정기산행',startsOn:'2026-09-20',endsOn:'2026-09-20',status:'open',budget:200000,in:0,out:138000,budgetPercent:69}]};
 if(p==='members')return {members:names.map((name,i)=>({id:901+i,name,role:i?'member':'owner',hasApp:true}))};
 if(p==='ledger/month')return month;
 if(p==='dues')return {period:'2026-09',amount:30000,payers:9,paidCount:7,unpaidCount:2,collected:210000,unpaidSum:60000,members:names.map((name,i)=>({memberId:901+i,name,hasApp:true,paid:i<7?{id:101+i,amount:30000,paidOn:'2026-09-05'}:null}))};
 if(p==='notices')return {notices:[notice,{...notice,id:32,title:'8월 결산',closingId:41,body:'8월 장부를 마감했어요. 결산을 함께 확인해 주세요.'}]};
 if(p==='notices/31')return {notice};
 if(p==='notices/32')return {notice:{...notice,id:32,title:'8월 결산',closingId:41,body:'8월 장부를 마감했어요. 결산을 함께 확인해 주세요.'}};
 if(/notices\/\d+\/recipients/.test(p))return {recipients:names.slice(1).map((name,i)=>({id:902+i,name,hasApp:true,push:'sent',readAt:i<6?'2026-09-24 00:15:00':null}))};
 if(p==='closings')return {closings:[closing]};
 if(p==='closings/41')return {closing};
 if(p==='requests')return {counts:{pending:2,paid:3,rejected:0},requests:[{id:61,requester:'이서연',amount:48000,occurredAt:'2026-09-20',merchant:'산길 카페',memo:'산행 후 음료 8잔',categoryId:2,eventId:51,receiptId:'demo-drink',bank:'시연은행 000-0000-0000 · 이서연',bankCopy:'000-0000-0000',status:'pending'},{id:62,requester:'박지호',amount:18000,occurredAt:'2026-09-20',merchant:'산입구 마트',memo:'회원용 생수',categoryId:4,receiptId:'demo-water',bank:'시연은행 000-0000-0001 · 박지호',status:'pending'}]};
 if(p==='receipts/pending')return {jobs:state.uploaded?[job]:[]};
 if(p==='receipts/jobs'){state.uploaded=true;return {job};}
 if(p==='receipts/demo-receipt')return {receipt};
 if(path==='ocr/jobs'){state.uploaded=true;return {id:'demo-job',jobId:'demo-job',status:'done',job:{id:'demo-job',status:'done'}};}
 if(path.startsWith('ocr/jobs/'))return {id:'demo-job',status:'done',result:receipt};
 return {ok:true};
}
module.exports={member,group,response};
