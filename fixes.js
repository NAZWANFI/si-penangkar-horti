/* Small compatibility and UX fixes layered after the main application script. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const samples = [];
  let editingSampleId = null;
  const canEdit = () => /PETUGAS|EDITOR/i.test($("#accessBadge")?.textContent || "");
  const canUseSamples = () => canEdit() && window.matchMedia("(min-width: 751px)").matches;
  const notify = (message) => {
    if (typeof window.toast === "function") window.toast(message);
    else window.alert(message);
  };

  // Remove only the duplicate title text. Keep its node because showPage() updates it.
  $("#pageTitle")?.setAttribute("aria-hidden", "true");

  // Password visibility toggle for the login form.
  const password = $("#password");
  let passwordToggle = $("#passwordToggle");
  if (password && !passwordToggle) {
    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    password.parentNode.insertBefore(wrapper, password);
    wrapper.append(password);
    passwordToggle = document.createElement("button");
    passwordToggle.id = "passwordToggle";
    passwordToggle.className = "password-toggle";
    passwordToggle.type = "button";
    passwordToggle.setAttribute("aria-label", "Tampilkan password");
    passwordToggle.title = "Tampilkan password";
    passwordToggle.setAttribute("aria-pressed", "false");
    passwordToggle.innerHTML = '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    wrapper.append(passwordToggle);
  }
  passwordToggle?.addEventListener("click", () => {
    if (!password) return;
    const reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(reveal));
    passwordToggle.setAttribute("aria-label", reveal ? "Sembunyikan password" : "Tampilkan password");
    passwordToggle.title = reveal ? "Sembunyikan password" : "Tampilkan password";
  });

  // Use the requested unit everywhere the app asks for it, including DOCX output.
  if (typeof window.productionUnitForSeedType === "function") {
    window.productionUnitForSeedType = (value) => String(value || "").toLowerCase().includes("bibit") ? "Batang" : "kg";
  }
  if (typeof window.updateProductionUnit === "function") {
    window.updateProductionUnit = () => {
      const unit = window.productionUnitForSeedType?.($("#jenisBenih")?.value) || "kg";
      const unitLabel = $("#productionUnit");
      const capacity = $("#produksi");
      if (unitLabel) unitLabel.textContent = unit;
      if (capacity) {
        capacity.step = unit === "Batang" ? "1" : "0.1";
        capacity.setAttribute("aria-label", `Kapasitas Produksi (${unit})`);
      }
    };
    window.updateProductionUnit();
  }

  const panel = $("#updateQueuePanel");
  const body = $("#updateQueueBody");
  const updateCount = $("#updateCount");
  const intro = $("#dashboard .intro");
  let sampleButton = $("#loadUpdateSamples");
  if (!sampleButton && intro) {
    sampleButton = document.createElement("button");
    sampleButton.id = "loadUpdateSamples";
    sampleButton.type = "button";
    sampleButton.className = "secondary dashboard-sample-button";
    sampleButton.textContent = "Tampilkan 3 Data Uji";
    sampleButton.style.marginTop = ".75rem";
    intro.append(sampleButton);
  }

  const isOverdue = (row) => {
    const date = new Date(row.updatedAt);
    if (Number.isNaN(date.getTime())) return true;
    date.setFullYear(date.getFullYear() + 1);
    return Date.now() >= date.getTime();
  };
  const showDate = (value) => new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  function renderSamples() {
    if (!body || !panel || !updateCount) return;
    body.querySelectorAll("tr[data-temporary-sample]").forEach((row) => row.remove());
    const overdueSamples = samples.filter(isOverdue);
    const actualCount = Number(updateCount.dataset.actualCount || updateCount.textContent) || 0;
    updateCount.dataset.actualCount = String(actualCount);
    updateCount.textContent = String(actualCount + overdueSamples.length);
    panel.hidden = actualCount + overdueSamples.length === 0;
    if (sampleButton) {
      sampleButton.hidden = !canUseSamples();
      sampleButton.style.display = canUseSamples() ? "inline-flex" : "none";
    }

    overdueSamples.forEach((sample) => {
      const row = document.createElement("tr");
      row.dataset.temporarySample = "true";
      const name = document.createElement("td");
      const bold = document.createElement("b");
      bold.textContent = sample.nama;
      name.append(bold);
      const district = document.createElement("td");
      district.textContent = sample.kecamatan;
      const date = document.createElement("td");
      date.textContent = showDate(sample.updatedAt);
      const action = document.createElement("td");
      if (canEdit()) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "primary update-record-button";
        button.textContent = "Perbarui";
        button.addEventListener("click", () => editSample(sample.id));
        action.append(button);
      } else {
        action.textContent = "Hubungi petugas";
        action.className = "muted";
      }
      row.append(name, district, date, action);
      body.append(row);
    });
  }

  if (typeof window.renderStats === "function") {
    const originalRenderStats = window.renderStats;
    window.renderStats = function (...args) {
      const result = originalRenderStats.apply(this, args);
      if (updateCount) updateCount.dataset.actualCount = updateCount.textContent;
      renderSamples();
      return result;
    };
  }

  function monthsAgo(months) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }

  sampleButton?.addEventListener("click", () => {
    if (!canUseSamples()) {
      notify("Data uji hanya tersedia untuk Petugas UPTD di tampilan desktop.");
      return;
    }
    if (samples.length) {
      samples.splice(0, samples.length);
      sampleButton.textContent = "Tampilkan 3 Data Uji";
      if (typeof window.renderStats === "function") window.renderStats();
      return;
    }
    samples.push(
      { id: "temporary-update-sample-1", nama: "[DATA UJI] Penangkar Cipatat", kecamatan: "Cipatat", komoditas: "Cabai", jenis: "Benih", alamat: "Data contoh sementara", telepon: "", luas: 1, produksi: 10, status: "Aktif", statusSertifikat: "Belum Bersertifikat", keteranganSertifikat: "", verifikasi: "Dalam Proses", updatedAt: monthsAgo(14) },
      { id: "temporary-update-sample-2", nama: "[DATA UJI] Penangkar Lembang", kecamatan: "Lembang", komoditas: "Tomat", jenis: "Benih", alamat: "Data contoh sementara", telepon: "", luas: 1, produksi: 10, status: "Aktif", statusSertifikat: "Belum Bersertifikat", keteranganSertifikat: "", verifikasi: "Dalam Proses", updatedAt: monthsAgo(18) },
      { id: "temporary-update-sample-3", nama: "[DATA UJI] Penangkar Cililin", kecamatan: "Cililin", komoditas: "Terung", jenis: "Bibit", alamat: "Data contoh sementara", telepon: "", luas: 1, produksi: 10, status: "Aktif", statusSertifikat: "Belum Bersertifikat", keteranganSertifikat: "", verifikasi: "Dalam Proses", updatedAt: monthsAgo(24) }
    );
    sampleButton.textContent = "Hapus Data Uji";
    if (typeof window.renderStats === "function") window.renderStats();
    notify("3 data uji ditambahkan sementara. Data ini hanya ada di tab browser ini dan tidak dikirim ke Supabase.");
  });

  function editSample(id) {
    if (!canUseSamples()) {
      notify("Pembaruan data uji hanya tersedia untuk Petugas UPTD di tampilan desktop.");
      return;
    }
    const sample = samples.find((item) => item.id === id);
    if (!sample) return;
    editingSampleId = id;
    if (typeof window.showPage === "function") window.showPage("input");
    const values = {
      editId: sample.id, nama: sample.nama, kecamatan: sample.kecamatan, komoditasInput: sample.komoditas,
      jenisBenih: sample.jenis, alamat: sample.alamat, telepon: sample.telepon, luas: sample.luas,
      produksi: sample.produksi, statusSertifikat: sample.statusSertifikat, certificateDetails: sample.keteranganSertifikat,
      verifikasiInput: sample.verifikasi
    };
    Object.entries(values).forEach(([idName, value]) => { const field = $("#" + idName); if (field) field.value = value; });
    const title = $("#formTitle");
    if (title) title.textContent = "Perbarui Data Uji (Sementara)";
    window.updateProductionUnit?.();
    $("#statusSertifikat")?.dispatchEvent(new Event("change", { bubbles: true }));
    $("#certificateDetails") && ($("#certificateDetails").value = sample.keteranganSertifikat);
  }

  const form = $("#penangkarForm");
  form?.addEventListener("submit", (event) => {
    if (!editingSampleId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canUseSamples()) {
      notify("Pembaruan data uji hanya tersedia untuk Petugas UPTD di tampilan desktop.");
      return;
    }
    const sample = samples.find((item) => item.id === editingSampleId);
    if (!sample) return;
    sample.nama = $("#nama")?.value.trim() || sample.nama;
    sample.kecamatan = $("#kecamatan")?.value || sample.kecamatan;
    sample.komoditas = $("#komoditasInput")?.value.trim() || sample.komoditas;
    sample.jenis = $("#jenisBenih")?.value || sample.jenis;
    sample.alamat = $("#alamat")?.value.trim() || "";
    sample.telepon = $("#telepon")?.value.trim() || "";
    sample.luas = Number($("#luas")?.value) || 0;
    sample.produksi = Number($("#produksi")?.value) || 0;
    sample.statusSertifikat = $("#statusSertifikat")?.value || sample.statusSertifikat;
    sample.keteranganSertifikat = $("#certificateDetails")?.value.trim() || "";
    sample.verifikasi = $("#verifikasiInput")?.value || sample.verifikasi;
    sample.updatedAt = new Date().toISOString();
    editingSampleId = null;
    form.reset();
    $("#editId").value = "";
    $("#formTitle").textContent = "Input & Pembaruan Data";
    window.updateProductionUnit?.();
    if (typeof window.showPage === "function") window.showPage("dashboard");
    if (typeof window.renderStats === "function") window.renderStats();
    notify("Data uji diperbarui sementara; perubahan ini tidak disimpan ke Supabase.");
  }, true);

  $("#cancelEdit")?.addEventListener("click", (event) => {
    if (!editingSampleId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editingSampleId = null;
    form?.reset();
    $("#editId").value = "";
    $("#formTitle").textContent = "Input & Pembaruan Data";
    window.updateProductionUnit?.();
    if (typeof window.showPage === "function") window.showPage("dashboard");
  }, true);

  // The queue may be viewed by visitors, but its update workflow is petugas-only.
  $("#openUpdateQueue")?.addEventListener("click", (event) => {
    if (!canEdit()) {
      event.stopImmediatePropagation();
      notify("Daftar ini hanya dapat diperbarui oleh Petugas UPTD.");
    }
  }, true);

  const sampleNote = document.createElement("p");
  sampleNote.className = "temporary-sample-note";
  sampleNote.textContent = "Data uji bersifat sementara di tab browser ini dan tidak pernah dikirim ke Supabase.";
  panel?.insertBefore(sampleNote, panel.querySelector(".table-wrap"));
  const accessObserver = new MutationObserver(() => {
    if (sampleButton) {
      sampleButton.hidden = !canUseSamples();
      sampleButton.style.display = canUseSamples() ? "inline-flex" : "none";
    }
    if (!canEdit() && samples.length) {
      samples.splice(0, samples.length);
      if (typeof window.renderStats === "function") window.renderStats();
    }
  });
  [$("#accessBadge"), $("#roleLabel")].filter(Boolean).forEach((node) => accessObserver.observe(node, { childList: true, characterData: true, subtree: true }));
  window.addEventListener("resize", () => {
    if (!canUseSamples() && samples.length) {
      samples.splice(0, samples.length);
      if (typeof window.renderStats === "function") window.renderStats();
    } else if (sampleButton) {
      sampleButton.hidden = !canUseSamples();
      sampleButton.style.display = canUseSamples() ? "inline-flex" : "none";
    }
  });
})();
