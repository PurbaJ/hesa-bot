const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const FONNTE_TOKEN = '1DPpc12rDNNF4g95LfvT';

// State percakapan per nomor HP
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

  if (s.csMode) {
    // Pesan diteruskan ke CS — bisa ditambah notif ke nomor CS
    return '✅ Pesanmu sudah kami catat. CS kami akan segera membalas!\n\nKetik *menu* untuk kembali ke chatbot.';
  }

  if (lower === 'menu' || lower === 'halo' || lower === 'hai' || lower === 'hi' || lower === 'mulai') {
    s.step = 'main'; s.csMode = false;
    return `Halo! Selamat datang di *Warung HESA* 🍌\n_Hemat, Enak, dan Selalu Ada!_\n\nBalas:\n1️⃣ *menu* - Lihat produk\n2️⃣ *pesan* - Langsung pesan\n3️⃣ *cs* - Hubungi CS`;
  }

  if (lower === 'menu' || lower === 'lihat menu' || lower === 'produk') {
    s.step = 'menu';
    return buildMenuText();
  }

  if (lower === 'cs' || lower.includes('hubungi cs') || lower.includes('manusia')) {
    s.csMode = true;
    return '👋 Kamu sekarang terhubung dengan CS kami!\nSilakan sampaikan pertanyaan atau keluhanmu.';
  }

  if (s.awaitQty) {
    const qty = parseInt(teks);
    if (isNaN(qty) || qty < 1) return '⚠️ Masukkan jumlah yang valid (minimal 1).';
    const item = MENU.find(m => m.id === s.awaitQty);
    const exist = s.cart.find(c => c.id === item.id);
    if (exist) exist.qty += qty; else s.cart.push({ ...item, qty });
    s.awaitQty = null;
    return `✅ *${item.name}* x${qty} ditambahkan!\n\nBalas:\n• *tambah* - Tambah produk lain\n• *bayar* - Lanjut pembayaran\n• *keranjang* - Lihat pesanan`;
  }

  const num = parseInt(teks);
  if (!isNaN(num) && num >= 1 && num <= 6) {
    s.awaitQty = num;
    const item = MENU[num - 1];
    return `Kamu pilih: *${item.name}*\nHarga: ${fmt(item.price)}/porsi\n\nMau pesan berapa porsi?`;
  }

  if (lower === 'keranjang') {
    if (!s.cart.length) return '🛒 Keranjangmu kosong. Ketik *menu* untuk melihat produk.';
    return buildSummary(s.cart) + '\n\nKetik *bayar* untuk melanjutkan.';
  }

  if (lower === 'bayar' || lower === 'lanjut bayar') {
    if (!s.cart.length) return '⚠️ Keranjangmu kosong!';
    s.step = 'payment';
    return buildSummary(s.cart) + '\n\n💳 *Pilih metode pembayaran:*\n1. Transfer BRI\n2. Transfer BCA\n3. Dana\n4. OVO\n5. Tunai/COD';
  }

  if (s.step === 'payment') {
    const methods = {
      '1': 'BRI: 1234567890 a.n. Warung HESA',
      '2': 'BCA: 0987654321 a.n. Warung HESA',
      '3': 'Dana: 0812-3456-7890',
      '4': 'OVO: 0812-3456-7890',
      '5': 'Pembayaran tunai / COD'
    };
    if (methods[teks]) {
      const info = methods[teks];
      s.cart = []; s.step = 'done';
      return `✅ *Informasi Pembayaran:*\n${info}\n\nSetelah bayar, kirim bukti ke CS kami ya! 📸\n\nTerima kasih sudah memesan di Warung HESA! 🍌`;
    }
  }

  return '❓ Perintah tidak dikenali.\n\nKetik *menu* untuk mulai, atau *cs* untuk hubungi CS kami.';
}

// Endpoint yang dipanggil Fonnte saat ada pesan masuk
app.post('/webhook', async (req, res) => {
  const { sender, message } = req.body;
  if (!sender || !message) return res.sendStatus(200);
  const balasan = handleMessage(sender, message);
  await kirimPesan(sender, balasan);
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server HESA berjalan di port 3000'));