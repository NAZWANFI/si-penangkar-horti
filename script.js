const seedData = [
  {id:1,nama:"Kelompok Tani Jaya",kecamatan:"Lembang",komoditas:"Cabai",jenis:"Benih Sebar",alamat:"Lembang",telepon:"081234567801",luas:2.5,produksi:5,status:"Aktif",verifikasi:"Terverifikasi"},
  {id:2,nama:"UD. Tani Subur",kecamatan:"Ngamprah",komoditas:"Kentang",jenis:"Benih",alamat:"Ngamprah",telepon:"081234567802",luas:4,produksi:8,status:"Aktif",verifikasi:"Dalam Proses"},
  {id:3,nama:"Kelompok Tani Mekar",kecamatan:"Padalarang",komoditas:"Bawang Merah",jenis:"Benih Sebar",alamat:"Padalarang",telepon:"081234567803",luas:1.8,produksi:3.5,status:"Aktif",verifikasi:"Dalam Proses"},
  {id:4,nama:"CV. Horti Lestari",kecamatan:"Cipatat",komoditas:"Tomat",jenis:"Benih",alamat:"Cipatat",telepon:"081234567804",luas:3,produksi:6,status:"Nonaktif",verifikasi:"Belum Diverifikasi"},
  {id:5,nama:"Kelompok Tani Harapan",kecamatan:"Rongga",komoditas:"Kangkung",jenis:"Benih",alamat:"Rongga",telepon:"081234567805",luas:2,produksi:4,status:"Aktif",verifikasi:"Terverifikasi"},
  {id:6,nama:"KWT Cibodas",kecamatan:"Cikalong Wetan",komoditas:"Cabai",jenis:"Benih Sebar",alamat:"Cikalong Wetan",telepon:"081234567806",luas:1.2,produksi:2.4,status:"Aktif",verifikasi:"Terverifikasi"},
  {id:7,nama:"Gapoktan Makmur",kecamatan:"Gununghalu",komoditas:"Tomat",jenis:"Benih",alamat:"Gununghalu",telepon:"081234567807",luas:2.8,produksi:5.6,status:"Aktif",verifikasi:"Dalam Proses"},
  {id:8,nama:"Tani Mandiri",kecamatan:"Cipeundeuy",komoditas:"Kentang",jenis:"Benih",alamat:"Cipeundeuy",telepon:"081234567808",luas:5,produksi:10,status:"Aktif",verifikasi:"Terverifikasi"}
];

let data = [];
let editor = false;
let realtimeChannel = null;
const districts = ["Cipatat","Cikalong Wetan","Gununghalu","Lembang","Ngamprah","Padalarang","Rongga","Cipeundeuy"];
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function toast(t){
  $("#toast").textContent=t;
  $("#toast").classList.add("show");
  setTimeout(()=>$("#toast").classList.remove("show"),2500);
}

function setAccess(){
  $("#roleLabel").textContent=editor?"Petugas UPTD":"Pengunjung";
  $("#roleText").textContent=editor?"Akses kelola dan edit data":"Akses lihat data saja";
  $("#accessBadge").textContent=editor?"MODE PETUGAS / EDITOR":"MODE PENGUNJUNG";
  $("#accessBadge").className="badge "+(editor?"edit":"view");
  $$(".editor-only").forEach(x=>x.style.display=editor?"":"none");
}

function cls(v){return v==="Aktif"?"aktif":v==="Nonaktif"?"nonaktif":v==="Terverifikasi"?"verified":v==="Dalam Proses"?"process":"unverified"}

async function loadData(showError=true){
  const {data:rows,error}=await supabaseClient.from("penangkar").select("*").order("created_at",{ascending:true});
  if(error){
    console.error(error);
    if(showError) toast("Gagal mengambil data dari Supabase.");
    data=[];
    renderAll();
    return;
  }
  data=(rows||[]).map(normalizeRow);
  renderAll();
}

function normalizeRow(x){
  return {
    id:x.id,nama:x.nama,kecamatan:x.kecamatan,komoditas:x.komoditas,jenis:x.jenis||"",
    alamat:x.alamat||"",telepon:x.telepon||"",luas:Number(x.luas)||0,produksi:Number(x.produksi)||0,
    status:x.status||"Aktif",verifikasi:x.verifikasi||"Belum Diverifikasi"
  };
}

async function saveRow(row){
  const payload={nama:row.nama,kecamatan:row.kecamatan,komoditas:row.komoditas,jenis:row.jenis,alamat:row.alamat,telepon:row.telepon,luas:row.luas,produksi:row.produksi,status:row.status,verifikasi:row.verifikasi};
  if(row.id){payload.id=row.id; return supabaseClient.from("penangkar").update(payload).eq("id",row.id);}
  return supabaseClient.from("penangkar").insert(payload);
}

function renderTable(){
  let q=$("#searchData").value.toLowerCase(), f=$("#filterDistrict").value;
  let rows=data.filter(x=>(!f||x.kecamatan===f)&&Object.values(x).join(" ").toLowerCase().includes(q));
  $("#dataTable").innerHTML=rows.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.nama)}</b></td><td>${esc(x.kecamatan)}</td><td>${esc(x.komoditas)}</td><td><span class="status ${cls(x.status)}">${esc(x.status)}</span></td><td><span class="status ${cls(x.verifikasi)}">${esc(x.verifikasi)}</span></td><td><button class="icon-btn" onclick="detail(${x.id})">👁</button>${editor?`<button class="icon-btn" onclick="editData(${x.id})">✎</button><button class="icon-btn delete" onclick="deleteData(${x.id})">🗑</button>`:""}</td></tr>`).join("")||`<tr><td colspan="7">Data tidak ditemukan.</td></tr>`;
}

function renderStats(){
  $("#totalCount").textContent=data.length;
  $("#activeCount").textContent=data.filter(x=>x.status==="Aktif").length;
  let comm=[...new Set(data.map(x=>x.komoditas))];
  $("#commodityCount").textContent=comm.length;
  $("#updateCount").textContent=data.filter(x=>x.verifikasi!=="Terverifikasi").length;
  let by={};data.forEach(x=>by[x.kecamatan]=(by[x.kecamatan]||0)+1);
  let max=Math.max(...Object.values(by),1);
  $("#barChart").innerHTML=Object.entries(by).map(([k,v])=>`<div class="bar"><b>${v}</b><i style="height:${(v/max)*165}px"></i><span>${esc(k)}</span></div>`).join("");
  let cb={};data.forEach(x=>cb[x.komoditas]=(cb[x.komoditas]||0)+1);
  $("#commodityList").innerHTML=Object.entries(cb).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="commodity-row"><span>${esc(k)}</span><b>${v} penangkar</b></div>`).join("")||"<p class='muted'>Belum ada data.</p>";
  let verified=data.filter(x=>x.verifikasi==="Terverifikasi").length,pct=data.length?Math.round(verified/data.length*100):0;
  $(".donut").style.setProperty("--percent",pct+"%");$("#verifiedPercent").textContent=pct+"%";
  $("#verifySummary").innerHTML=`<p>🟢 Terverifikasi: <b>${verified}</b></p><p>🟡 Dalam Proses: <b>${data.filter(x=>x.verifikasi==="Dalam Proses").length}</b></p><p>🔴 Belum Diverifikasi: <b>${data.filter(x=>x.verifikasi==="Belum Diverifikasi").length}</b></p>`;
  $("#commodityCards").innerHTML=Object.entries(cb).map(([k,v])=>`<div class="commodity-card">🌿<strong>${v}</strong><b>${esc(k)}</b><p class="muted">Penangkar terdaftar</p></div>`).join("")||"<p class='muted'>Belum ada data.</p>";
  $("#mapGrid").innerHTML=Object.entries(by).map(([k,v])=>`<div class="map-pin">📍<b>${v}</b><span>${esc(k)}</span></div>`).join("")||"<p class='muted'>Belum ada data.</p>";
}

function renderVerify(){
  $("#verifyTable").innerHTML=data.map(x=>`<tr><td>${esc(x.nama)}</td><td>${esc(x.kecamatan)}</td><td>${esc(x.komoditas)}</td><td><span class="status ${cls(x.verifikasi)}">${esc(x.verifikasi)}</span></td><td><select onchange="changeVerify(${x.id},this.value)"><option ${x.verifikasi==="Terverifikasi"?"selected":""}>Terverifikasi</option><option ${x.verifikasi==="Dalam Proses"?"selected":""}>Dalam Proses</option><option ${x.verifikasi==="Belum Diverifikasi"?"selected":""}>Belum Diverifikasi</option></select></td></tr>`).join("");
}
function renderAll(){renderStats();renderTable();renderVerify()}

function detail(id){
  let x=data.find(a=>a.id===id); if(!x)return;
  $("#modalBody").innerHTML=`<h2>${esc(x.nama)}</h2><p><b>Kecamatan:</b> ${esc(x.kecamatan)}</p><p><b>Komoditas:</b> ${esc(x.komoditas)}</p><p><b>Jenis Benih:</b> ${esc(x.jenis)}</p><p><b>Alamat:</b> ${esc(x.alamat)}</p><p><b>Telepon:</b> ${esc(x.telepon)}</p><p><b>Luas Lahan:</b> ${x.luas} Ha</p><p><b>Kapasitas Produksi:</b> ${x.produksi} Ton</p><p><b>Status:</b> ${esc(x.status)}</p><p><b>Verifikasi:</b> ${esc(x.verifikasi)}</p>`;
  $("#modal").classList.add("show");
}

function editData(id){
  if(!editor)return;
  let x=data.find(a=>a.id===id); if(!x)return;
  showPage("input");
  $("#formTitle").textContent="Edit Data Penangkar";
  $("#editId").value=x.id;$("#nama").value=x.nama;$("#kecamatan").value=x.kecamatan;$("#komoditasInput").value=x.komoditas;$("#jenisBenih").value=x.jenis;$("#alamat").value=x.alamat;$("#telepon").value=x.telepon;$("#luas").value=x.luas;$("#produksi").value=x.produksi;$("#status").value=x.status;$("#verifikasiInput").value=x.verifikasi;
}

async function deleteData(id){
  if(!editor||!confirm("Hapus data ini?"))return;
  const {error}=await supabaseClient.from("penangkar").delete().eq("id",id);
  if(error){console.error(error);toast("Gagal menghapus data. Pastikan akun memiliki akses editor.");return;}
  toast("Data berhasil dihapus.");
  await loadData(false);
}

async function changeVerify(id,v){
  if(!editor){renderVerify();return}
  const {error}=await supabaseClient.from("penangkar").update({verifikasi:v}).eq("id",id);
  if(error){console.error(error);toast("Gagal memperbarui verifikasi.");return;}
  toast("Status verifikasi diperbarui.");
  await loadData(false);
}

function showPage(id){
  if(["input","verifikasi","pengaturan"].includes(id)&&!editor){toast("Halaman ini hanya untuk Petugas UPTD.");return}
  $$(".page").forEach(p=>p.classList.remove("active"));$("#"+id).classList.add("active");
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  $("#pageTitle").textContent=$("#"+id).querySelector("h2")?.textContent||id;
  $(".sidebar").classList.remove("show");
}

async function login(){
  $("#loginMessage").textContent="";
  const email=$("#username").value.trim();
  const password=$("#password").value;
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){console.error(error);$("#loginMessage").textContent="Email atau password salah, atau akun belum dibuat di Supabase.";return}
  await applySession();
  toast("Login berhasil. Selamat datang, Petugas UPTD!");
}

async function applySession(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session){
    const {data:profile}=await supabaseClient.from("profiles").select("role,username").eq("id",session.user.id).maybeSingle();
    editor=profile?.role==="editor";
    $("#loginOverlay").style.display="none";
    $("#username").value=session.user.email||"";
    setAccess();
  }else{
    editor=false;
    $("#loginOverlay").style.display="flex";
    setAccess();
  }
}

async function logout(){
  await supabaseClient.auth.signOut();
  editor=false;
  $("#username").value="";$("#password").value="";$("#loginMessage").textContent="";
  $("#loginOverlay").style.display="flex";setAccess();
}

function subscribeRealtime(){
  if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel=supabaseClient.channel("penangkar-realtime")
    .on("postgres_changes",{event:"*",schema:"public",table:"penangkar"},payload=>{
      console.log("Perubahan realtime:",payload.eventType);
      loadData(false);
    }).subscribe();
}

["Cipatat","Cikalong Wetan","Gununghalu","Lembang","Ngamprah","Padalarang","Rongga","Cipeundeuy"].forEach(d=>{
  $("#filterDistrict").insertAdjacentHTML("beforeend",`<option>${d}</option>`);
  $("#kecamatan").insertAdjacentHTML("beforeend",`<option>${d}</option>`);
});

$$(".nav").forEach(n=>n.onclick=()=>showPage(n.dataset.page));
$("#addFromData").onclick=()=>showPage("input");
$("#searchData").oninput=renderTable;$("#filterDistrict").onchange=renderTable;
$("#loginForm").onsubmit=e=>{e.preventDefault();login()};
$("#guestBtn").onclick=async()=>{editor=false;$("#loginOverlay").style.display="none";setAccess();await loadData();toast("Masuk sebagai pengunjung. Data hanya dapat dilihat.")};
$("#logoutBtn").onclick=logout;

$("#penangkarForm").onsubmit=async e=>{
  e.preventDefault();if(!editor)return;
  const id=Number($("#editId").value)||null;
  const row={id,nama:$("#nama").value.trim(),kecamatan:$("#kecamatan").value,komoditas:$("#komoditasInput").value.trim(),jenis:$("#jenisBenih").value.trim(),alamat:$("#alamat").value.trim(),telepon:$("#telepon").value.trim(),luas:Number($("#luas").value)||0,produksi:Number($("#produksi").value)||0,status:$("#status").value,verifikasi:$("#verifikasiInput").value};
  const {error}=await saveRow(row);
  if(error){console.error(error);toast("Gagal menyimpan data. Periksa koneksi dan hak akses editor.");return}
  $("#penangkarForm").reset();$("#editId").value="";$("#formTitle").textContent="Input & Pembaruan Data";
  await loadData(false);showPage("data");toast(id?"Data berhasil diperbarui.":"Data penangkar berhasil ditambahkan.");
};

$("#cancelEdit").onclick=()=>{$("#penangkarForm").reset();$("#editId").value="";$("#formTitle").textContent="Input & Pembaruan Data";showPage("data")};
$("#closeModal").onclick=()=>$("#modal").classList.remove("show");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.remove("show")};

$$(".report-btn").forEach(b=>b.onclick=()=>{
  let title=b.dataset.report;
  let rows=data.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.nama)}</td><td>${esc(x.kecamatan)}</td><td>${esc(x.komoditas)}</td><td>${esc(x.status)}</td><td>${esc(x.verifikasi)}</td></tr>`).join("");
  let w=window.open("","_blank");
  if(!w){toast("Popup laporan diblokir browser.");return}
  w.document.write(`<html><head><title>${esc(title)} - SI PENANGKAR HORTI</title><style>body{font-family:Arial;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:8px;text-align:left}h1{color:#075b35}</style></head><body><h1>SI PENANGKAR HORTI</h1><h2>${esc(title)}</h2><p>Dicetak: ${new Date().toLocaleString("id-ID")}</p><table><thead><tr><th>No</th><th>Nama</th><th>Kecamatan</th><th>Komoditas</th><th>Status</th><th>Verifikasi</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()<\/script></body></html>`);
  w.document.close();
});

$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("show");
$("#today").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

(async function init(){
  setAccess();
  await applySession();
  await loadData(false);
  subscribeRealtime();
})();

window.detail=detail;window.editData=editData;window.deleteData=deleteData;window.changeVerify=changeVerify;
