// node tests/dst-overnight.test.js  — DST fall-back Nov 1 2026 (2 AM ADT -> 1 AM AST)
process.env.TZ='America/Halifax';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={hrs:null,console,Intl,Date,Math,String,parseD:d=>{const x=d.split('-');return new Date(+x[0],x[1]-1,+x[2]);}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../shifts-secure/cj/js/v2-overnight.js','utf8'),ctx);
const h=ctx.hrs;
assert.strictEqual(h('22:00','06:00','2026-10-31'),9,'crosses 2 AM Nov 1: 9 real hours');
assert.strictEqual(h('22:00','06:00'),8,'no date: wall clock as before');
assert.strictEqual(h('22:00','06:00','2026-10-30'),8,'normal night');
assert.strictEqual(h('22:00','01:30','2026-10-31'),3.5,'ends before the change');
assert.strictEqual(h('22:00','06:00','2027-03-13'),7,'spring forward Mar 14 2027');
assert.strictEqual(h('09:00','17:00','2026-11-01'),8,'day shift Nov 1');
const a=ctx.ivl('2026-10-31','22:00','06:00');assert.strictEqual(a[1]-a[0],540,'ivl uses real minutes');
console.log('PASS dst-overnight (7 checks)');
