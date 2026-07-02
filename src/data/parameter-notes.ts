/** Definisi parameter dari baris Note di sheet Excel (GT / MT / Horeca) */
export const PARAMETER_NOTES: Record<string, string> = {
  allProduct:
    "Adalah penjualan bersih setelah diskon reguler dan retur dalam satuan Rupiah untuk semua produk.",
  fmAnchor:
    "Fast Moving Product: produk dengan kontribusi omset terbesar. Anchor Product: produk dengan daya tarik tertinggi terhadap minat konsumen di wilayah tersebut.",
  focusVol:
    "Adalah penjualan bersih setelah diskon dan retur dalam satuan Karton atau Dus untuk produk fokus.",
  focusRO:
    "Adalah outlet yang bertransaksi produk fokus minimal 1 kali per 3 bulan (next, harus bertransaksi minimal 1 kali per bulan).",
  sc: "Adalah jumlah kunjungan penjualan ke outlet, baik sesuai Call Plan (PJP) atau di luar Call Plan (PJP).",
  ec: "Adalah jumlah kunjungan penjualan yang menghasilkan transaksi penjualan (efektif) ke outlet, baik sesuai Call Plan (PJP) atau di luar Call Plan (PJP).",
  noo: "Adalah jumlah pembukaan outlet baru. Pengakuan NOO adalah jika outlet telah mendapatkan nomor atau kode outlet (FA/EDP/DA), dengan kata lain telah menjadi RO.",
  ro: "Adalah outlet yang telah melakukan transaksi minimal 1 kali per 3 bulan (next, harus bertransaksi minimal 1 kali per bulan).",
  ao: "Adalah RO yang bertransaksi minimal 1 kali per bulan (next, harus bertransaksi minimal 1 kali per bulan).",
  iptIpo:
    "Adalah rata-rata jumlah produk item (SKU) per outlet dalam satu periode.",
  pd: "Adalah jumlah outlet yang telah melakukan pajangan dengan benar (standar display SM, MM, GMM).",
  pc: "Adalah jumlah outlet yang memiliki pajangan sesuai planogram (planogram SM, MM, GMM).",
  contract:
    "Adalah jumlah outlet yang menandatangani kontrak penjualan 6–12 bulan ke depan, bonus di luar insentif reguler.",
  coBranding:
    "Adalah outlet yang mencantumkan brand produk (menu listing presence atau POSM utilization) minimal 3 bulan.",
  sp: "Adalah jumlah sales point yang aktif dan memenuhi standar penempatan produk.",
  noa: "Adalah pembukaan area penjualan baru di wilayah yang belum ter-cover.",
  nps: "Customer Satisfaction Index / Net Promoter Score — tingkat kepuasan pelanggan.",
  je: "Joint Event Activity — kegiatan event bersama minimal 3x simple event per bulan dan 1x middle event per kuartal.",
};

export const GLOBAL_PARAMETER_NOTE =
  "Masing-masing parameter Insentif berdiri sendiri-sendiri — satu parameter tidak terkait dengan parameter lainnya.";
