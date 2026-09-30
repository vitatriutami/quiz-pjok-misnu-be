// server.js - Server Node.js & Database SQLite Milik Sendiri
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// 1. Inisialisasi Database SQLite Milik Sendiri (File: quiz_data.db)
const db = new sqlite3.Database('./quiz_data.db', (err) => {
  if (err) console.error("Gagal konek DB:", err.message);
  else console.log("Terhubung ke Database SQLite milik sendiri.");
});

// Buat Tabel Nilai jika belum ada
db.run(`CREATE TABLE IF NOT EXISTS nilai_siswa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    skor INTEGER NOT NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 2. API Endpoint: Siswa Kirim Nilai
app.post('/api/simpan-nilai', (req, res) => {
  const { nama, skor } = req.body;
  if (!nama) return res.status(400).json({ error: "Nama wajib diisi" });

  const sql = `INSERT INTO nilai_siswa (nama, skor) VALUES (?, ?)`;
  db.run(sql, [nama, skor], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const dataBaru = { id: this.lastID, nama, skor, waktu: new Date().toLocaleString('id-ID') };

    // KIRIM DATA REAL-TIME KE GADGET GURU YANG SEDANG TERHUBUNG VIA WEBSOCKET
    io.emit('nilai_baru', dataBaru);

    res.json({ status: "sukses", data: dataBaru });
  });
});

// 3. API Endpoint: Guru Ambil Semua Nilai
app.get('/api/rekap-nilai', (req, res) => {
  const sql = `SELECT * FROM nilai_siswa ORDER BY id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 4. Koneksi WebSocket Real-Time
io.on('connection', (socket) => {
  console.log('Gadget terhubung ke Real-time Server');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} sedang dipakai, mencoba port ${Number(PORT) + 1}...`);
    server.listen(Number(PORT) + 1);
  } else {
    console.error("Server error:", err);
  }
});