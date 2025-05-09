const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = 3000;

// 啟用 CORS 與 JSON 處理
app.use(cors());
app.use(express.json());

// 初始化 LowDB
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

// 初始化資料結構
async function initDB() {
  await db.read();
  db.data ||= { orders: [], reserved: [] };
  await db.write();
}
initDB();

// 建立 Gmail 寄信設定
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your@gmail.com',        // ← 換成你自己的 Gmail
    pass: 'your-app-password'      // ← 使用 Gmail App 密碼
  }
});

// 發送 Email 函式
function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: 'your@gmail.com',
    to,
    subject,
    html
  });
}

// 處理選位 API
app.post('/api/select-seats', async (req, res) => {
  const { seats, username, email } = req.body;

  if (!seats || !Array.isArray(seats) || !username || !email) {
    return res.status(400).json({ message: '請填寫完整資訊（姓名、Email、座位）' });
  }

  await db.read(); // 載入最新資料
  const reservedSet = new Set(db.data.reserved);

  const alreadyReserved = seats.filter(seat => reservedSet.has(seat));
  if (alreadyReserved.length > 0) {
    return res.status(409).json({ message: `座位已被預訂：${alreadyReserved.join(', ')}` });
  }

  try {
    // 加入新訂單
    const order = {
      username,
      email,
      seats,
      time: new Date().toISOString()
    };
    db.data.orders.push(order);
    db.data.reserved.push(...seats);
    await db.write();

    // 寄送 Email 通知
    await sendEmail(email, '訂位成功通知', `
      <h3>您好，${username}</h3>
      <p>您成功預訂了以下座位：</p>
      <p><strong>${seats.join(', ')}</strong></p>
      <p>時間：${new Date().toLocaleString()}</p>
    `);

    res.json({ message: `成功預訂座位：${seats.join(', ')}` });
  } catch (err) {
    console.error('❌ 錯誤:', err);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 伺服器啟動中：http://localhost:${PORT}`);
});
