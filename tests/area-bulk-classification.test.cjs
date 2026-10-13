'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('src/modules/employees/employees.js', 'utf8');
function fixture(role='ADMIN') {
  const state = { employees: [
    {id:'a',name:'A'}, {id:'b',name:'B'}, {id:'t',name:'T',area:'TIENDA'}
  ] };
  let saves=0;
  let reject=false;
  const window = {
    AuthContext:{get:()=>({role,companyId:'test'})},
    ShiftControlState:{get:()=>state,save:()=>{saves++;if(reject)throw Error('offline')}}
  };
  const sandbox={window,console,crypto:{randomUUID:()=> 'new'},safeRandomUUID:()=> 'new'};
  vm.runInNewContext(source,sandbox);
  return {api:window.EmployeeModule,state,get saves(){return saves},fail(){reject=true}};
}
test('bulk classification only changes unassigned and saves once',()=>{
 const f=fixture();
 assert.equal(f.api.assignUnassignedToArea('ESTACION',['a','b']),2);
 assert.equal(f.saves,1);
 assert.equal(f.state.employees[0].area,'ESTACION');
 assert.equal(f.state.employees[1].area,'ESTACION');
 assert.equal(f.state.employees[2].area,'TIENDA');
});
test('stale list refuses all changes',()=>{
 const f=fixture();
 assert.throws(()=>f.api.assignUnassignedToArea('ESTACION',['b','a']),/cambió/);
 assert.equal(f.saves,0);
 assert.equal(f.state.employees[0].area,undefined);
});
test('save failure restores all previous area fields',()=>{
 const f=fixture();
 f.fail();
 assert.throws(()=>f.api.assignUnassignedToArea('ESTACION',['a','b']),/offline/);
 assert.equal(f.state.employees[0].area,undefined);
 assert.equal(f.state.employees[1].area,undefined);
 assert.equal(f.state.employees[2].area,'TIENDA');
});
test('chief cannot bulk classify',()=>{
 const f=fixture('CHIEF');
 assert.throws(()=>f.api.assignUnassignedToArea('ESTACION',['a','b']),/Solo ADMIN/);
 assert.equal(f.saves,0);
});
