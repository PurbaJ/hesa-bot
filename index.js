const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const FONNTE_TOKEN = '1DPpc12rDNNF4g95LfvT';

const sessions = {};

const MENU = [
  { id: 1, name: "Pisang Pasir Original",       price: 8000  },
  { id: 2, name: "Pisang Pasir Mix Rasa",        price: 10000 },
  { id: 3, name: "Pisang Pasir Varian Matcha",   price: 9000  },
  { id: 4, name: "Pisang Pasir Varian Coklat",   price: 9000  },
  { id: 5, name: "Pisang Pasir Varian Tiramisu", price: 9000  },
  { id: 6, name: "Jasuke",                       price: 5000  },
];

function fmt(n) { return 'Rp ' + n.toLocaleString('id-ID'); }

function buildMenuText() {
  let t = '🍌 *Menu Warung HESA* 🍌\n\n';
  MENU.forEach((m, i) => {
    t += `${i+1}. ${m.name} - ${fmt(m.price)}\n`;
  });
  t += '\nBalas dengan *nomor* menu untuk memesan!';
  return t;
}

function buildSummary(cart) {
  let text = '🛒 *Ringkasan Pesanan:*\n';
  let total = 0;
  cart.forEach(c => {
    const sub = c.price * c.qty;
    total += sub;
    text += `• ${c.name} x${c.qty} = ${fmt(sub)}\n`;
  });
  text += `\n*Total: ${fmt(total)}*`;
  return text;
}

async function kirimPesan(nomor, pesan) {
  await axios.post('https://api.fonnte.com/send', {
    target: nomor,
    message: pesan,
  }, {
    headers: { Authorization: FONNTE_TOKEN }
  });
}

function handleMessage(nomor, teks) {
  if (!sessions[nomor]) sessions[nomor] = { step: 'welcome', cart: [], awaitQty: null, csMode: false };
  const s = sessions[nomor];
  const lower = teks.toLowerCase().trim();

  // 1. Mode CS
  if (s.csMode) {
    if (lower === 'menu') {
      s.csMode = false;
      s.step = 'main';
      return `Kamu kembali ke chatbot HESA 😊\n\nBalas:\n1️⃣ *menu* - Lihat produk\n2️⃣ *pesan* - Langsung pesan\n3️⃣ *cs* - Hubungi CS`;
    }
    return '✅ Pesanmu sudah kami catat. CS kami akan segera membalas!\n\nKetik *menu* untuk kembali ke chatbot.';
  }

  // 2. Sapaan / reset
  if (lower === 'halo' || lower === 'hai' || lower === 'hi' || lower === 'mulai') {
    s.step = 'main';
    return `Halo! Selamat datang di *Warung HESA* 🍌\n_Hemat, Enak, dan Selalu Ada!_\n\nBalas:\n1️⃣ *menu* - Lihat produk\n2️⃣ *pesan* - Langsung pesan\n3️⃣ *cs* - Hubungi CS`;
  }

  // 3. Lihat menu
  if (lower === 'menu' || lower === 'lihat menu' || lower === 'produk' || lower === 'pesan') {
    s.step = 'menu';
    return buildMenuText();
  }

  // 4. Hubungi CS
  // 4. Hubungi CS
    if (lower === 'cs' || lower.includes('hubungi cs') || lower.includes('manusia')) {
    return '👋 *Hubungi CS Warung HESA*\n\nSilakan chat langsung ke nomor CS kami:\n📱 *wa.me/6285830307719*\n\nJam operasional:\n🕗 08.00 - 21.00 WIB\n\nKetik *menu* untuk kembali ke chatbot.';
    }

  // 5. Lihat keranjang
  if (lower === 'keranjang') {
    if (!s.cart.length) return '🛒 Keranjangmu kosong. Ketik *menu* untuk melihat produk.';
    return buildSummary(s.cart) + '\n\nKetik *bayar* untuk melanjutkan atau *tambah* untuk tambah produk.';
  }

  // 6. Lanjut bayar
  if (lower === 'bayar' || lower === 'lanjut bayar') {
    if (!s.cart.length) return '⚠️ Keranjangmu kosong! Ketik *menu* untuk melihat produk.';
    s.step = 'payment';
    return buildSummary(s.cart) + '\n\n💳 *Pilih metode pembayaran:*\n1. Transfer BRI\n2. Transfer BCA\n3. Dana\n4. OVO\n5. Tunai/COD';
  }

  // 7. Tambah produk lain
  if (lower === 'tambah') {
    s.step = 'menu';
    return buildMenuText();
  }

  // 8. Input angka
  const num = parseInt(teks);

  // Jika step payment → angka = pilihan bayar
  if (s.step === 'payment' && !isNaN(num)) {
    const methods = {
      1: { label: 'Transfer BRI', info: 'Bank BRI\nNo. Rek: 1234567890 a.n. Warung HESA' },
      2: { label: 'Transfer BCA', info: 'Bank BCA\nNo. Rek: 0987654321 a.n. Warung HESA' },
      3: { label: 'Dana',         info: 'Dana: 0812-3456-7890 a.n. Warung HESA' },
      4: { label: 'OVO',          info: 'OVO: 0812-3456-7890 a.n. Warung HESA' },
      5: { label: 'Tunai/COD',    info: 'Pembayaran tunai saat pesanan tiba' },
    };
    const chosen = methods[num];
    if (chosen) {
      s.cart = []; s.step = 'done';
      return `✅ *Metode: ${chosen.label}*\n\n💳 *Info Pembayaran:*\n${chosen.info}\n\nSetelah bayar, kirim bukti ke CS kami 📸\n\nTerima kasih sudah memesan di Warung HESA! 🍌`;
    }
    return '⚠️ Pilih angka 1-5 untuk metode pembayaran.';
  }

  // 9. Jika menunggu jumlah porsi
  if (s.awaitQty) {
    const qty = parseInt(teks);
    if (isNaN(qty) || qty < 1) return '⚠️ Masukkan jumlah yang valid (minimal 1).';
    const item = MENU.find(m => m.id === s.awaitQty);
    const exist = s.cart.find(c => c.id === item.id);
    if (exist) exist.qty += qty; else s.cart.push({ ...item, qty });
    s.awaitQty = null;
    return `✅ *${item.name}* x${qty} ditambahkan!\n\nBalas:\n• *tambah* - Tambah produk lain\n• *bayar* - Lanjut pembayaran\n• *keranjang* - Lihat pesanan`;
  }

  // 10. Pilih menu berdasarkan nomor
  if (!isNaN(num) && num >= 1 && num <= 6) {
    s.awaitQty = num;
    const item = MENU[num - 1];
    return `Kamu pilih: *${item.name}*\nHarga: ${fmt(item.price)}/porsi\n\nMau pesan berapa porsi?`;
  }

  // 11. Tidak dikenali
  return '❓ Perintah tidak dikenali.\n\nKetik *menu* untuk mulai, atau *cs* untuk hubungi CS kami.';
}

app.post('/webhook', async (req, res) => {
  const { sender, message } = req.body;
  if (!sender || !message) return res.sendStatus(200);
  const balasan = handleMessage(sender, message);
  await kirimPesan(sender, balasan);
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server HESA berjalan di port 3000'));