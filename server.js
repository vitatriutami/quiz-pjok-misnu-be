import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import pg from 'pg';
import cors from 'cors';

const { Pool } = pg;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// ================================
// PostgreSQL
// ================================

// ================================
// Debug DATABASE_URL (tanpa password)
// ================================

try {
  const dbUrl = new URL(process.env.DATABASE_URL);

  console.log('🔎 Database configuration:');
  console.log('   User    :', dbUrl.username);
  console.log('   Host    :', dbUrl.hostname);
  console.log('   Port    :', dbUrl.port);
  console.log('   Database:', dbUrl.pathname.slice(1));
} catch (err) {
  console.error('❌ DATABASE_URL tidak valid:', err.message);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

// ================================
// Inisialisasi Database
// ================================

async function initializeDatabase() {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS nilai_siswa (
            id SERIAL PRIMARY KEY,
            nama TEXT NOT NULL,
            skor INTEGER NOT NULL,
            correct INTEGER NOT NULL,
            total INTEGER NOT NULL,
            date TEXT,
            timestamp BIGINT,
            waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

  console.log('✅ Terhubung ke PostgreSQL.');
  console.log('✅ Tabel nilai_siswa siap digunakan.');
}

// ================================
// Route utama
// ================================

app.get('/', (req, res) => {
  res.send('Server Quiz PJOK Backend Aktif!');
});

// ================================
// Simpan nilai siswa
// ================================

app.post('/api/simpan-nilai', async (req, res) => {
  const {
    nama,
    skor,
    correct,
    total,
    date,
    timestamp
  } = req.body;

  // Validasi data
  if (!nama) {
    return res.status(400).json({
      error: 'Nama wajib diisi'
    });
  }

  if (skor === undefined || skor === null) {
    return res.status(400).json({
      error: 'Skor wajib diisi'
    });
  }

  if (correct === undefined || correct === null) {
    return res.status(400).json({
      error: 'Jumlah jawaban benar wajib diisi'
    });
  }

  if (total === undefined || total === null) {
    return res.status(400).json({
      error: 'Total soal wajib diisi'
    });
  }

  try {
    const result = await pool.query(
      `
            INSERT INTO nilai_siswa
            (nama, skor, correct, total, date, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
      [
        nama,
        skor,
        correct,
        total,
        date || null,
        timestamp || null
      ]
    );

    const dataBaru = result.rows[0];

    // Kirim data baru ke semua client melalui Socket.IO
    io.emit('nilai_baru', dataBaru);

    console.log('✅ Nilai baru tersimpan:', dataBaru);

    res.json({
      status: 'sukses',
      data: dataBaru
    });

  } catch (err) {
    console.error(
      '❌ Gagal menyimpan nilai:',
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});

// ================================
// Ambil rekap nilai
// ================================

app.get('/api/rekap-nilai', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
                id,
                nama,
                skor,
                correct,
                total,
                date,
                timestamp,
                waktu
            FROM nilai_siswa
            ORDER BY id DESC
        `);

    res.json(result.rows);

  } catch (err) {
    console.error(
      '❌ Gagal mengambil data nilai:',
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});

// ================================
// Socket.IO
// ================================

io.on('connection', (socket) => {
  console.log(
    '🔌 Gadget terhubung via WebSocket:',
    socket.id
  );

  socket.on('disconnect', () => {
    console.log(
      '🔌 Gadget terputus:',
      socket.id
    );
  });
});

// ================================
// Jalankan Server
// ================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(
        `🚀 Server running on port ${PORT}`
      );
    });

  } catch (err) {
    console.error(
      '❌ Server gagal dijalankan karena database tidak siap.'
    );

    console.error(err.message);

    process.exit(1);
  }
}

startServer();