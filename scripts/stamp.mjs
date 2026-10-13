#!/usr/bin/env node
/* প্রতিবার ডিপ্লয়ের আগে CSS/JS-এর লিংকে নতুন নম্বর বসায়,
   যাতে ব্রাউজার পুরনো ফাইল ধরে না রাখে */
import fs from 'node:fs';
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
let s = fs.readFileSync('index.html', 'utf8');
s = s.replace(/(assets\/(?:styles|app|fonts)\.(?:css|js))(\?v=\d+)?/g, `$1?v=${v}`);
fs.writeFileSync('index.html', s);
console.log('স্ট্যাম্প:', v);
