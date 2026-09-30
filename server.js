// server.js - Server Node.js & Database SQLite
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

// Inisialisasi Socket.io dengan CORS terbuka
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// 1. Inisialisasi Database SQLite
// Catatan: Menggunakan ':memory:' agar aman dari batasan penyimpanan sistem Fly.io
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error("Gagal konek DB:", err.message);
  else console.log("Terhubung ke Database SQLite (In-Memory).");
});

// Buat Tabel Nilai
db.run(`CREATE TABLE IF NOT EXISTS nilai_siswa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    skor INTEGER NOT NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Endpoint Utama Check (Health Check)
app.get('/', (req, res) => {
  res.send('Server Quiz PJOK Backend Aktif!');
});

// 2. API Endpoint: Siswa Kirim Nilai
app.post('/api/simpan-nilai', (req, res) => {
  const { nama, skor } = req.body;
  if (!nama) return res.status(400).json({ error: "Nama wajib diisi" });

  const sql = `INSERT INTO nilai_siswa (nama, skor) VALUES (?, ?)`;
  db.run(sql, [nama, skor], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const dataBaru = {
      id: this.lastID,
      nama,
      skor,
      waktu: new Date().toLocaleString('id-ID')
    };

    // Broadcast real-time ke semua client
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
  console.log('Gadget terhubung via WebSocket:', socket.id);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});