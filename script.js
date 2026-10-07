let data = [];
let editor = false;
let realtimeChannel = null;
let districtMapSignature = null;
const GALLERY_BUCKET = "dashboard-gallery";
const GALLERY_MAX_BYTES = 5 * 1024 * 1024;
let galleryPhotos = [];
let galleryIndex = 0;
let galleryTimer = null;
let galleryPaused = false;
const districts = ["Batujajar","Cihampelas","Cikalong Wetan","Cililin","Cipeundeuy","Cipatat","Cipongkor","Cisarua","Gununghalu","Lembang","Ngamprah","Padalarang","Parongpong","Rongga","Saguling","Sindangkerta"];
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const iconPaths={
  sprout:'<path d="M12 21V10m0 6C7 16 4 13 4 8c5 0 8 2 8 7Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
  view:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  delete:'<path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-6 4v6m4-6v6"/>'
};
function icon(name,className="icon"){return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]||""}</svg>`;}

function toast(t){
  $("#toast").textContent=t;
  $("#toast").classList.add("show");
  setTimeout(()=>$("#toast").classList.remove("show"),2500);
}

function stopGalleryAutoplay(){
  if(galleryTimer){clearInterval(galleryTimer);galleryTimer=null;}
}

function startGalleryAutoplay(){
  stopGalleryAutoplay();
  if(galleryPaused||galleryPhotos.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches||document.hidden)return;
  galleryTimer=setInterval(()=>moveGallery(1),6000);
}

function renderGallery(){
  const track=$("#galleryTrack"),empty=$("#galleryEmpty"),controls=$("#galleryControls");
  track.replaceChildren();
  if(!galleryPhotos.length){
    galleryIndex=0;empty.hidden=false;controls.hidden=true;startGalleryAutoplay();return;
  }
  empty.hidden=true;
  galleryPhotos.forEach((photo,index)=>{
    const slide=document.createElement("div");slide.className="gallery-slide";
    const image=document.createElement("img");image.src=photo.url;image.alt=photo.title||`Foto kegiatan ${index+1}`;image.loading=index===0?"eager":"lazy";
    const title=document.createElement("p");title.className="gallery-photo-title";title.textContent=photo.title||"Foto kegiatan";
    slide.append(image,title);
    if(editor){
      const remove=document.createElement("button");
      remove.type="button";remove.className="gallery-delete editor-only";
      remove.setAttribute("aria-label",`Hapus foto ${photo.title||index+1}`);remove.title="Hapus foto";remove.textContent="×";
      remove.addEventListener("click",()=>deleteGalleryPhoto(photo.name,photo.title));
      slide.append(remove);
    }
    track.append(slide);
  });
  updateGalleryPosition();
  $("#galleryCounter").textContent=`${galleryIndex+1} / ${galleryPhotos.length}`;
  startGalleryAutoplay();
}

function updateGalleryPosition(){
  const track=$("#galleryTrack"),style=getComputedStyle(track);
  const visible=Number(style.getPropertyValue("--gallery-visible"))||3;
  const gap=parseFloat(style.columnGap)||0;
  const maxIndex=Math.max(0,galleryPhotos.length-visible);
  galleryIndex=Math.min(galleryIndex,maxIndex);
  track.style.transform=`translateX(calc(-${galleryIndex*(100/visible)}% - ${galleryIndex*gap}px))`;
  $("#galleryControls").hidden=galleryPhotos.length<=visible;
  $("#galleryCounter").textContent=galleryPhotos.length?`${galleryIndex+1} / ${galleryPhotos.length}`:"";
}

function moveGallery(direction){
  const visible=Number(getComputedStyle($("#galleryTrack")).getPropertyValue("--gallery-visible"))||3;
  const maxIndex=Math.max(0,galleryPhotos.length-visible);
  if(!maxIndex)return;
  galleryIndex=galleryIndex+direction;
  if(galleryIndex>maxIndex)galleryIndex=0;
  if(galleryIndex<0)galleryIndex=maxIndex;
  updateGalleryPosition();
}

function encodeGalleryTitle(title){
  const bytes=new TextEncoder().encode(title);let binary="";
  bytes.forEach(byte=>binary+=String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function decodeGalleryTitle(fileName){
  const token=fileName.split("__")[1]?.replace(/\.[^.]+$/g,"");
  if(!token)return "";
  try{
    const base64=token.replace(/-/g,"+").replace(/_/g,"/");
    const binary=atob(base64+"=".repeat((4-base64.length%4)%4));
    return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
  }catch{return "";}
}

async function loadGallery(showError=false){
  const {data:files,error}=await supabaseClient.storage.from(GALLERY_BUCKET).list("",{limit:100,sortBy:{column:"created_at",order:"desc"}});
  if(error){
    console.error("Gagal memuat galeri:",error);
    if(showError)toast("Foto galeri tidak dapat dimuat. Periksa koneksi Storage Supabase.");
    return;
  }
  galleryPhotos=(files||[]).filter(file=>file.id&&file.name).map(file=>({name:file.name,title:decodeGalleryTitle(file.name),url:supabaseClient.storage.from(GALLERY_BUCKET).getPublicUrl(file.name).data.publicUrl}));
  renderGallery();
}

async function uploadGalleryPhoto(file){
  if(!editor){toast("Hanya Petugas UPTD yang dapat mengunggah foto.");return;}
  if(!file)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast("Pilih foto JPG, PNG, atau WebP.");return;}
  if(file.size>GALLERY_MAX_BYTES){toast("Ukuran foto maksimal 5 MB.");return;}
  const title=$("#galleryPhotoTitle").value.trim();
  if(!title){toast("Isi judul foto sebelum mengunggah.");$("#galleryPhotoTitle").focus();return;}
  const extension={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
  const fileName=`${Date.now()}-${crypto.randomUUID()}__${encodeGalleryTitle(title)}.${extension}`;
  const button=$("#galleryUploadButton");button.disabled=true;button.textContent="Mengunggah…";
  const {error}=await supabaseClient.storage.from(GALLERY_BUCKET).upload(fileName,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  button.disabled=false;button.textContent="＋ Unggah Foto";
  if(error){console.error("Upload galeri gagal:",error);toast("Foto gagal diunggah. Pastikan akun editor aktif dan Storage sudah disiapkan.");return;}
  $("#galleryFile").value="";$("#galleryPhotoTitle").value="";
  await loadGallery(true);
  toast("Foto berhasil diunggah dan terlihat oleh pengunjung.");
}

async function deleteGalleryPhoto(fileName,title){
  if(!editor||!fileName)return;
  if(!window.confirm(`Hapus foto “${title||"Foto kegiatan"}”? Foto ini akan dihapus permanen.`))return;
  const {error}=await supabaseClient.storage.from(GALLERY_BUCKET).remove([fileName]);
  if(error){console.error("Hapus foto gagal:",error);toast("Foto gagal dihapus. Pastikan akun editor aktif.");return;}
  galleryPhotos=galleryPhotos.filter(photo=>photo.name!==fileName);
  galleryIndex=Math.min(galleryIndex,Math.max(0,galleryPhotos.length-1));
  renderGallery();
  toast("Foto berhasil dihapus.");
}

function setAccess(){
  $("#roleLabel").textContent=editor?"Petugas UPTD":"Pengunjung";
  $("#roleText").textContent=editor?"Akses kelola dan edit data":"Akses lihat data saja";
  $("#accessBadge").textContent=editor?"MODE PETUGAS / EDITOR":"MODE PENGUNJUNG";
  $("#accessBadge").className="badge "+(editor?"edit":"view");
  $$(".editor-only").forEach(x=>x.style.display=editor?"":"none");
  if($("#galleryTrack"))renderGallery();
  if($("#updateQueuePanel"))renderStats();
}

function cls(v){return v==="Aktif"||v==="Bersertifikat"?"aktif":v==="Nonaktif"?"nonaktif":v==="Terverifikasi"?"verified":v==="Dalam Proses"?"process":"unverified"}

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
    id:x.id,nama:x.nama,kecamatan:x.kecamatan,komoditas:x.komoditas,jenis:canonicalSeedType(x.jenis||"Benih"),
    alamat:x.alamat||"",telepon:x.telepon||"",luas:Number(x.luas)||0,produksi:Number(x.produksi)||0,
    status:x.status||"Aktif",statusSertifikat:x.status_sertifikat||"Belum Bersertifikat",
    keteranganSertifikat:x.keterangan_sertifikat||"",verifikasi:x.verifikasi||"Belum Diverifikasi",
    updatedAt:x.updated_at||x.created_at||null
  };
}

async function saveRow(row){
  const payload={nama:row.nama,kecamatan:row.kecamatan,komoditas:row.komoditas,jenis:row.jenis,alamat:row.alamat,telepon:row.telepon,luas:row.luas,produksi:row.produksi,status:row.status,status_sertifikat:row.statusSertifikat,keterangan_sertifikat:row.keteranganSertifikat,verifikasi:row.verifikasi,updated_at:new Date().toISOString()};
  if(row.id){payload.id=row.id; return supabaseClient.from("penangkar").update(payload).eq("id",row.id);}
  return supabaseClient.from("penangkar").insert(payload);
}

let pendingSpreadsheetRows=[];

function importHeaderKey(value){
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}

function canonicalSeedType(value){
  const type=importHeaderKey(value);
  return type.includes("bibit")||type.includes("pohon")?"Bibit":"Benih";
}

function productionUnitForSeedType(value){
  return canonicalSeedType(value)==="Bibit"?"Pohon":"kg";
}

function isUpdateOverdue(row,now=new Date()){
  const updated=row.updatedAt?new Date(row.updatedAt):null;
  if(!updated||Number.isNaN(updated.getTime()))return true;
  const dueDate=new Date(updated);
  dueDate.setFullYear(dueDate.getFullYear()+1);
  return now>=dueDate;
}

function formatUpdateDate(value){
  if(!value)return "Belum tercatat";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Belum tercatat":date.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}

function updateProductionUnit(){
  const unit=productionUnitForSeedType($("#jenisBenih").value);
  $("#productionUnit").textContent=unit;
  $("#produksi").step=unit==="Pohon"?"1":"0.1";
  $("#produksi").setAttribute("aria-label",`Kapasitas Produksi (${unit})`);
}

function importNumber(value,label,rowNumber,issues){
  if(value===""||value==null)return 0;
  let parsed=value;
  if(typeof value==="string"){
    parsed=value.trim().replace(/\s/g,"");
    if(parsed.includes(","))parsed=parsed.replace(/\./g,"").replace(",", ".");
  }
  const number=Number(parsed);
  if(!Number.isFinite(number)||number<0){issues.push(`Baris ${rowNumber}: ${label} harus berupa angka nol atau lebih.`);return null;}
  return number;
}

function existingRecordKey(row){
  return [row.nama,row.kecamatan,row.komoditas].map(value=>String(value??"").trim().toLocaleLowerCase("id-ID")).join("|");
}

async function readSpreadsheet(file){
  if(!editor){toast("Hanya Petugas UPTD yang dapat mengimpor data.");return;}
  if(!file)return;
  if(file.size>10*1024*1024){toast("Ukuran file maksimal 10 MB.");return;}
  if(!window.XLSX){toast("Pembaca spreadsheet gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");return;}
  try{
    const workbook=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const sheetName=workbook.SheetNames.find(name=>importHeaderKey(name)==="datapenangkar")||workbook.SheetNames[0];
    const sheet=workbook.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:true,blankrows:false});
    const aliases={
      nama:["namapenangkar","nama"],kecamatan:["kecamatan"],komoditas:["komoditas"],jenis:["jenisbenih","jenis"],
      alamat:["alamat"],telepon:["notelepon","telepon","nomorhp"],luas:["luaslahanha","luaslahan","luas"],
      produksi:["kapasitasproduksikg","kapasitasproduksipohon","kapasitasproduksiton","kapasitasproduksi","produksi"],
      status:["statusoperasional","statuspenangkar","status"],statusSertifikat:["statussertifikat","statussertifikasi"],
      keteranganSertifikat:["keterangansertifikat","nomorsertifikat","detailsertifikat"],verifikasi:["statusverifikasi","verifikasi"]
    };
    let headerIndex=-1,indexes={};
    for(let i=0;i<Math.min(rows.length,20);i++){
      const normalized=rows[i].map(importHeaderKey);
      const found={};
      Object.entries(aliases).forEach(([field,names])=>{found[field]=normalized.findIndex(key=>names.includes(key));});
      if(found.nama>=0&&found.kecamatan>=0&&found.komoditas>=0){headerIndex=i;indexes=found;break;}
    }
    if(headerIndex<0)throw new Error("Header wajib Nama Penangkar, Kecamatan, dan Komoditas tidak ditemukan. Gunakan template dari website.");

    const districtsByKey=new Map(districts.map(name=>[importHeaderKey(name),name]));
    const capacityHeader=importHeaderKey(rows[headerIndex][indexes.produksi]);
    const capacityHeaderUnit=capacityHeader.includes("ton")?"Ton":capacityHeader.includes("pohon")?"Pohon":capacityHeader.includes("kg")?"kg":null;
    const statuses=new Map([["aktif","Aktif"],["nonaktif","Nonaktif"]]);
    const verifications=new Map([["terverifikasi","Terverifikasi"],["dalamproses","Dalam Proses"],["belumdiverifikasi","Belum Diverifikasi"]]);
    const seen=new Set(data.map(existingRecordKey));
    const valid=[],issues=[];let duplicates=0,emptyRows=0;
    for(let i=headerIndex+1;i<rows.length;i++){
      const cells=rows[i];
      if(!cells.some(value=>String(value??"").trim())){emptyRows++;continue;}
      const get=field=>indexes[field]>=0?cells[indexes[field]]??"":"";
      const rowNumber=i+1;
      const nama=String(get("nama")).trim(),komoditas=String(get("komoditas")).trim();
      const kecamatan=districtsByKey.get(importHeaderKey(get("kecamatan")));
      const jenisText=String(get("jenis")).trim();
      const rowIssues=[];
      if(!nama)rowIssues.push(`Baris ${rowNumber}: Nama Penangkar wajib diisi.`);
      if(!kecamatan)rowIssues.push(`Baris ${rowNumber}: Kecamatan tidak valid atau kosong.`);
      if(!komoditas)rowIssues.push(`Baris ${rowNumber}: Komoditas wajib diisi.`);
      if(jenisText&&!importHeaderKey(jenisText).match(/benih|bibit|pohon|sebar/))rowIssues.push(`Baris ${rowNumber}: Jenis benih harus Benih atau Bibit.`);
      const luas=importNumber(get("luas"),"Luas Lahan",rowNumber,rowIssues);
      const statusText=String(get("status")).trim();
      const certificateStatusText=String(get("statusSertifikat")).trim();
      const certificateDetails=String(get("keteranganSertifikat")).trim();
      const verificationText=String(get("verifikasi")).trim();
      const jenis=canonicalSeedType(jenisText);
      let produksi=importNumber(get("produksi"),"Kapasitas Produksi",rowNumber,rowIssues);
      const targetUnit=productionUnitForSeedType(jenis);
      if(capacityHeaderUnit==="Ton"&&targetUnit==="kg"&&produksi!==null)produksi*=1000;
      else if(capacityHeaderUnit&&capacityHeaderUnit!==targetUnit)rowIssues.push(`Baris ${rowNumber}: Satuan kapasitas pada header (${capacityHeaderUnit}) tidak cocok dengan jenis benih (${targetUnit}). Perbarui satuan di spreadsheet.`);
      let status=statusText?statuses.get(importHeaderKey(statusText)):"Aktif";
      let statusSertifikat=certificateStatusText?null:"Belum Bersertifikat";
      if(certificateStatusText){
        const certificateKey=importHeaderKey(certificateStatusText);
        statusSertifikat=certificateKey==="bersertifikat"?"Bersertifikat":certificateKey==="belumbersertifikat"?"Belum Bersertifikat":null;
      }else if(statusText&&["bersertifikat","belumbersertifikat"].includes(importHeaderKey(statusText))){
        statusSertifikat=importHeaderKey(statusText)==="bersertifikat"?"Bersertifikat":"Belum Bersertifikat";
        status="Aktif";
      }
      const verifikasi=verificationText?verifications.get(importHeaderKey(verificationText)):"Dalam Proses";
      if(statusText&&!status)rowIssues.push(`Baris ${rowNumber}: Status harus Aktif atau Nonaktif.`);
      if(certificateStatusText&&!statusSertifikat)rowIssues.push(`Baris ${rowNumber}: Status Sertifikat harus Bersertifikat atau Belum Bersertifikat.`);
      if(statusSertifikat==="Bersertifikat"&&!certificateDetails)rowIssues.push(`Baris ${rowNumber}: Keterangan Sertifikat wajib diisi untuk penangkar bersertifikat.`);
      if(verificationText&&!verifikasi)rowIssues.push(`Baris ${rowNumber}: Status Verifikasi tidak dikenal.`);
      if(rowIssues.length){issues.push(...rowIssues);continue;}
      const row={nama,kecamatan,komoditas,jenis,alamat:String(get("alamat")).trim(),telepon:String(get("telepon")).trim(),luas,produksi,status,statusSertifikat,keteranganSertifikat:certificateDetails,verifikasi};
      const key=existingRecordKey(row);
      if(seen.has(key)){duplicates++;continue;}
      seen.add(key);valid.push(row);
    }
    if(valid.length>2000)throw new Error("Maksimal 2.000 baris data dapat diimpor sekaligus.");
    if(!valid.length&&!issues.length)throw new Error("Tidak ada data baru untuk diimpor.");
    pendingSpreadsheetRows=valid;
    renderSpreadsheetPreview({fileName:file.name,valid,issues,duplicates,emptyRows});
  }catch(error){console.error(error);toast(error.message||"File tidak dapat dibaca. Pastikan formatnya XLSX, XLS, atau CSV.");}
}

function renderSpreadsheetPreview({fileName,valid,issues,duplicates,emptyRows}){
  const panel=$("#spreadsheetImport");
  panel.hidden=false;
  $("#importSummaryText").textContent=`${fileName}: ${valid.length} baris siap diimpor; ${duplicates} duplikat dilewati; ${issues.length} masalah validasi; ${emptyRows} baris kosong.`;
  $("#importIssues").textContent=issues.length?`Periksa file dan unggah ulang untuk memperbaiki data yang dilewati. ${issues.slice(0,5).join(" ")}${issues.length>5?` Dan ${issues.length-5} masalah lainnya.`:""}`:"Baris duplikat berdasarkan nama, kecamatan, dan komoditas dilewati agar data lama tidak tertimpa.";
  $("#importIssues").hidden=!issues.length&&!duplicates;
  $("#importPreviewHead").innerHTML="<tr><th>Nama Penangkar</th><th>Kecamatan</th><th>Komoditas</th><th>Jenis</th><th>Kapasitas Produksi</th><th>Status</th></tr>";
  $("#importPreviewBody").innerHTML=valid.slice(0,5).map(row=>`<tr><td>${esc(row.nama)}</td><td>${esc(row.kecamatan)}</td><td>${esc(row.komoditas)}</td><td>${esc(row.jenis)}</td><td>${esc(row.produksi)} ${productionUnitForSeedType(row.jenis)}</td><td>${esc(row.statusSertifikat)}</td></tr>`).join("")||`<tr><td colspan="6">Tidak ada baris valid baru.</td></tr>`;
  $("#confirmSpreadsheetImport").disabled=!valid.length;
  $("#confirmSpreadsheetImport").textContent=valid.length?`Impor ${valid.length} Data`:"Tidak Ada Data Baru";
}

async function confirmSpreadsheetImport(){
  if(!editor||!pendingSpreadsheetRows.length)return;
  const button=$("#confirmSpreadsheetImport");button.disabled=true;button.textContent="Mengimpor...";
  const updatedAt=new Date().toISOString();
  const payload=pendingSpreadsheetRows.map(row=>({nama:row.nama,kecamatan:row.kecamatan,komoditas:row.komoditas,jenis:row.jenis,alamat:row.alamat,telepon:row.telepon,luas:row.luas,produksi:row.produksi,status:row.status,status_sertifikat:row.statusSertifikat,keterangan_sertifikat:row.keteranganSertifikat,verifikasi:row.verifikasi,updated_at:updatedAt}));
  const {error}=await supabaseClient.from("penangkar").insert(payload);
  if(error){console.error(error);toast("Impor gagal. Tidak ada data yang berhasil disimpan.");button.disabled=false;button.textContent=`Impor ${pendingSpreadsheetRows.length} Data`;return;}
  const count=pendingSpreadsheetRows.length;
  pendingSpreadsheetRows=[];$("#spreadsheetImport").hidden=true;$("#spreadsheetFile").value="";
  await loadData(false);toast(`${count} data penangkar berhasil diimpor.`);
}

function cancelSpreadsheetImport(){
  pendingSpreadsheetRows=[];$("#spreadsheetImport").hidden=true;$("#spreadsheetFile").value="";
}

function renderTable(){
  let q=$("#searchData").value.toLowerCase(), f=$("#filterDistrict").value;
  let rows=data.filter(x=>(!f||x.kecamatan===f)&&Object.values(x).join(" ").toLowerCase().includes(q));
  $("#dataTable").innerHTML=rows.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.nama)}</b></td><td>${esc(x.kecamatan)}</td><td>${esc(x.komoditas)}</td><td><span class="status ${cls(x.statusSertifikat)}">${esc(x.statusSertifikat)}</span></td><td><span class="status ${cls(x.verifikasi)}">${esc(x.verifikasi)}</span></td><td><button class="icon-btn" title="Lihat detail" aria-label="Lihat detail" onclick="detail(${x.id})">${icon("view")}</button>${editor?`<button class="icon-btn" title="Edit" aria-label="Edit" onclick="editData(${x.id})">${icon("edit")}</button><button class="icon-btn delete" title="Hapus" aria-label="Hapus" onclick="deleteData(${x.id})">${icon("delete")}</button>`:""}</td></tr>`).join("")||`<tr><td colspan="7">Data tidak ditemukan.</td></tr>`;
}

function mapDistrictKey(value){
  return importHeaderKey(value).replace(/kabupaten|kecamatan/g,"");
}

function districtRings(geometry){
  if(geometry.type==="Polygon")return geometry.coordinates;
  if(geometry.type==="MultiPolygon")return geometry.coordinates.flat();
  return [];
}

function districtCoordinates(feature){
  return districtRings(feature.geometry).flat(1).filter(point=>Array.isArray(point)&&point.length>=2);
}

function renderDistrictMap(containerId, countByDistrict, compact=false){
  const container=$(containerId);
  const features=window.districtBoundaries?.features||[];
  if(!features.length){container.innerHTML="<p class='muted'>Batas kecamatan tidak tersedia.</p>";return;}

  const points=features.flatMap(districtCoordinates);
  const width=800,height=590,padding=28;
  const mercator=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  const projected=points.map(([lon,lat])=>[lon*Math.PI/180,mercator(lat)]);
  const minX=Math.min(...projected.map(point=>point[0])),maxX=Math.max(...projected.map(point=>point[0]));
  const minY=Math.min(...projected.map(point=>point[1])),maxY=Math.max(...projected.map(point=>point[1]));
  const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY));
  const offsetX=(width-(maxX-minX)*scale)/2,offsetY=(height-(maxY-minY)*scale)/2;
  const project=([lon,lat])=>[offsetX+(lon*Math.PI/180-minX)*scale,height-offsetY-(mercator(lat)-minY)*scale];
  const paths=features.map(feature=>{
    const name=feature.properties.WADMKC;
    const count=countByDistrict.get(mapDistrictKey(name))||0;
    const d=districtRings(feature.geometry).map(ring=>ring.map((point,i)=>{
      const [x,y]=project(point);return `${i?"L":"M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ")+" Z").join(" ");
    const coords=districtCoordinates(feature);
    const center=coords.reduce((sum,point)=>{const [x,y]=project(point);sum[0]+=x;sum[1]+=y;return sum;},[0,0]).map(value=>value/coords.length);
    const label=compact?"":`<text class="district-label" x="${center[0].toFixed(1)}" y="${center[1].toFixed(1)}">${esc(name)}</text>`;
    return `<g class="district-feature ${count?"has-data":"empty"}" data-name="${esc(name)}" data-count="${count}" tabindex="0" role="img" aria-label="Kecamatan ${esc(name)}, ${count} penangkar"><path d="${d}"/><title>Kecamatan ${esc(name)} — ${count} penangkar</title>${label}</g>`;
  }).join("");
  const svg=`<svg class="district-map-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="Peta 16 kecamatan Kabupaten Bandung Barat">${paths}</svg><div class="district-map-tooltip" role="status" hidden></div>`;
  container.innerHTML=`<div class="district-map-frame ${compact?"is-compact":""}">${svg}</div>${compact?"":`<div class="district-map-legend"><span><i class="legend-swatch empty"></i>Belum ada data</span><span><i class="legend-swatch has-data"></i>Ada penangkar</span></div>`}`;
  const frame=container.querySelector(".district-map-frame"),tip=container.querySelector(".district-map-tooltip");
  const showTooltip=(feature,event)=>{
    tip.textContent=`${feature.dataset.name}: ${feature.dataset.count} penangkar`;
    tip.hidden=false;
    const bounds=frame.getBoundingClientRect();
    const target=event.type==="focus"?feature.querySelector("path").getBBox():null;
    const scaleX=bounds.width/width,scaleY=bounds.height/height;
    const left=event.type==="focus"?(target.x+target.width/2)*scaleX:event.clientX-bounds.left;
    const top=event.type==="focus"?(target.y+target.height/2)*scaleY:event.clientY-bounds.top;
    tip.style.left=`${Math.max(8,Math.min(bounds.width-220,left+12))}px`;
    tip.style.top=`${Math.max(8,Math.min(bounds.height-48,top-34))}px`;
  };
  container.querySelectorAll(".district-feature").forEach(feature=>{
    feature.addEventListener("pointerenter",event=>showTooltip(feature,event));
    feature.addEventListener("pointermove",event=>showTooltip(feature,event));
    feature.addEventListener("pointerleave",event=>{if(event.pointerType!=="touch")tip.hidden=true;});
    feature.addEventListener("focus",event=>showTooltip(feature,event));
    feature.addEventListener("blur",()=>{tip.hidden=true;});
    feature.addEventListener("click",event=>{feature.focus();showTooltip(feature,event);});
  });
}

function renderStats(){
  $("#totalCount").textContent=data.length;
  $("#activeCount").textContent=data.filter(x=>x.status==="Aktif").length;
  let comm=[...new Set(data.map(x=>x.komoditas))];
  $("#commodityCount").textContent=comm.length;
  const overdueRows=data.filter(row=>isUpdateOverdue(row));
  $("#updateCount").textContent=overdueRows.length;
  $("#updateQueuePanel").hidden=overdueRows.length===0;
  $("#updateQueueBody").innerHTML=overdueRows.map(row=>`<tr><td><b>${esc(row.nama)}</b></td><td>${esc(row.kecamatan)}</td><td>${esc(formatUpdateDate(row.updatedAt))}</td><td>${editor?`<button type="button" class="primary update-record-button" onclick="editData(${row.id})">Perbarui</button>`:`<span class="muted">Hubungi petugas</span>`}</td></tr>`).join("");
  const byDistrict=new Map();
  data.forEach(row=>{const key=mapDistrictKey(row.kecamatan);byDistrict.set(key,(byDistrict.get(key)||0)+1);});
  const mapSignature=JSON.stringify([...byDistrict]);
  if(mapSignature!==districtMapSignature){
    renderDistrictMap("#dashboardDistrictMap",byDistrict,true);
    renderDistrictMap("#mapGrid",byDistrict,false);
    districtMapSignature=mapSignature;
  }
  let cb={};data.forEach(x=>cb[x.komoditas]=(cb[x.komoditas]||0)+1);
  $("#commodityList").innerHTML=Object.entries(cb).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="commodity-row"><span>${esc(k)}</span><b>${v} penangkar</b></div>`).join("")||"<p class='muted'>Belum ada data.</p>";
  const verified=data.filter(x=>x.verifikasi==="Terverifikasi").length;
  const processing=data.filter(x=>x.verifikasi==="Dalam Proses").length;
  const unverified=data.filter(x=>x.verifikasi==="Belum Diverifikasi").length;
  const pct=data.length?Math.round(verified/data.length*100):0;
  const verifiedShare=data.length?verified/data.length*100:0;
  const processingPct=data.length?processing/data.length*100:0;
  const donut=$(".donut");
  donut.style.setProperty("--verified-percent",verifiedShare+"%");
  donut.style.setProperty("--process-end",(verifiedShare+processingPct)+"%");
  donut.classList.toggle("is-empty",data.length===0);
  $("#verifiedPercent").textContent=pct+"%";
  $("#verifySummary").innerHTML=`<p><i class="verify-dot green"></i>Terverifikasi: <b>${verified}</b></p><p><i class="verify-dot amber"></i>Dalam Proses: <b>${processing}</b></p><p><i class="verify-dot red"></i>Belum Diverifikasi: <b>${unverified}</b></p>`;
  const certified=data.filter(x=>x.statusSertifikat==="Bersertifikat").length;
  const uncertified=data.length-certified;
  const certifiedShare=data.length?certified/data.length*100:0;
  const certificateDonut=$(".donut-certification");
  certificateDonut.style.setProperty("--certified-percent",certifiedShare+"%");
  certificateDonut.classList.toggle("is-empty",data.length===0);
  $("#certifiedPercent").textContent=(data.length?Math.round(certifiedShare):0)+"%";
  $("#certificateSummary").innerHTML=`<p><i class="verify-dot green"></i>Bersertifikat: <b>${certified}</b></p><p><i class="verify-dot red"></i>Belum Bersertifikat: <b>${uncertified}</b></p>`;
  $("#commodityCards").innerHTML=Object.entries(cb).map(([k,v])=>`<div class="commodity-card">${icon("sprout")}<strong>${v}</strong><b>${esc(k)}</b><p class="muted">Penangkar terdaftar</p></div>`).join("")||"<p class='muted'>Belum ada data.</p>";
}

function renderVerify(){
  $("#verifyTable").innerHTML=data.map(x=>`<tr><td>${esc(x.nama)}</td><td>${esc(x.kecamatan)}</td><td>${esc(x.komoditas)}</td><td><span class="status ${cls(x.verifikasi)}">${esc(x.verifikasi)}</span></td><td><select onchange="changeVerify(${x.id},this.value)"><option ${x.verifikasi==="Terverifikasi"?"selected":""}>Terverifikasi</option><option ${x.verifikasi==="Dalam Proses"?"selected":""}>Dalam Proses</option><option ${x.verifikasi==="Belum Diverifikasi"?"selected":""}>Belum Diverifikasi</option></select></td></tr>`).join("");
}
function renderAll(){renderStats();renderTable();renderVerify()}

// Refresh age-based update reminders while the dashboard stays open.
setInterval(renderStats,60*1000);

function detail(id){
  let x=data.find(a=>a.id===id); if(!x)return;
  $("#modalBody").innerHTML=`<h2>${esc(x.nama)}</h2><p><b>Kecamatan:</b> ${esc(x.kecamatan)}</p><p><b>Komoditas:</b> ${esc(x.komoditas)}</p><p><b>Jenis:</b> ${esc(x.jenis)}</p><p><b>Alamat:</b> ${esc(x.alamat)}</p><p><b>Telepon:</b> ${esc(x.telepon)}</p><p><b>Luas Lahan:</b> ${x.luas} Ha</p><p><b>Kapasitas Produksi:</b> ${x.produksi} ${productionUnitForSeedType(x.jenis)}</p><p><b>Status Sertifikat:</b> ${esc(x.statusSertifikat)}</p>${x.statusSertifikat==="Bersertifikat"?`<p><b>Keterangan Sertifikat:</b> ${esc(x.keteranganSertifikat)}</p>`:""}<p><b>Status Verifikasi:</b> ${esc(x.verifikasi)}</p>`;
  $("#modal").classList.add("show");
}

function updateCertificateDetailsField(){
  const isCertified=$("#statusSertifikat").value==="Bersertifikat";
  $("#certificateDetailsField").hidden=!isCertified;
  $("#certificateDetails").required=isCertified;
  if(!isCertified)$("#certificateDetails").value="";
}

function editData(id){
  if(!editor)return;
  let x=data.find(a=>a.id===id); if(!x)return;
  showPage("input");
  $("#formTitle").textContent="Edit Data Penangkar";
  $("#editId").value=x.id;$("#nama").value=x.nama;$("#kecamatan").value=x.kecamatan;$("#komoditasInput").value=x.komoditas;$("#jenisBenih").value=canonicalSeedType(x.jenis);$("#alamat").value=x.alamat;$("#telepon").value=x.telepon;$("#luas").value=x.luas;$("#produksi").value=x.produksi;$("#statusSertifikat").value=x.statusSertifikat;$("#certificateDetails").value=x.keteranganSertifikat;$("#verifikasiInput").value=x.verifikasi;updateProductionUnit();updateCertificateDetailsField();
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

districts.forEach(d=>{
  $("#filterDistrict").insertAdjacentHTML("beforeend",`<option>${d}</option>`);
  $("#kecamatan").insertAdjacentHTML("beforeend",`<option>${d}</option>`);
});

updateProductionUnit();
$("#jenisBenih").onchange=updateProductionUnit;
$("#statusSertifikat").onchange=updateCertificateDetailsField;
$("#openUpdateQueue").onclick=()=>{
  const panel=$("#updateQueuePanel");
  if(panel.hidden){toast("Belum ada data yang melewati masa pembaruan 1 tahun.");return;}
  panel.scrollIntoView({behavior:"smooth",block:"center"});
};
$$(".nav").forEach(n=>n.onclick=()=>showPage(n.dataset.page));
$("#addFromData").onclick=()=>showPage("input");
$("#uploadSpreadsheetButton").onclick=()=>$("#spreadsheetFile").click();
$("#spreadsheetFile").onchange=e=>readSpreadsheet(e.target.files?.[0]);
$("#galleryUploadButton").onclick=()=>{
  if(!$("#galleryPhotoTitle").value.trim()){toast("Isi judul foto sebelum memilih gambar.");$("#galleryPhotoTitle").focus();return;}
  $("#galleryFile").click();
};
$("#galleryFile").onchange=e=>uploadGalleryPhoto(e.target.files?.[0]);
$("#galleryPrev").onclick=()=>moveGallery(-1);
$("#galleryNext").onclick=()=>moveGallery(1);
$("#galleryPause").onclick=()=>{
  galleryPaused=!galleryPaused;
  $("#galleryPause").textContent=galleryPaused?"▶":"Ⅱ";
  $("#galleryPause").setAttribute("aria-label",galleryPaused?"Putar galeri":"Jeda galeri");
  $("#galleryPause").title=galleryPaused?"Putar galeri":"Jeda galeri";
  if(galleryPaused)stopGalleryAutoplay();else startGalleryAutoplay();
};
$("#galleryViewer").onmouseenter=stopGalleryAutoplay;
$("#galleryViewer").onmouseleave=startGalleryAutoplay;
document.addEventListener("visibilitychange",()=>document.hidden?stopGalleryAutoplay():startGalleryAutoplay());
$("#confirmSpreadsheetImport").onclick=confirmSpreadsheetImport;
$("#cancelSpreadsheetImport").onclick=cancelSpreadsheetImport;
$("#searchData").oninput=renderTable;$("#filterDistrict").onchange=renderTable;
$("#loginForm").onsubmit=e=>{e.preventDefault();login()};
$("#guestBtn").onclick=async()=>{editor=false;$("#loginOverlay").style.display="none";setAccess();await loadData();toast("Masuk sebagai pengunjung. Data hanya dapat dilihat.")};
$("#logoutBtn").onclick=logout;

$("#penangkarForm").onsubmit=async e=>{
  e.preventDefault();if(!editor)return;
  const id=Number($("#editId").value)||null;
  const existing=id?data.find(row=>row.id===id):null;
  const row={id,nama:$("#nama").value.trim(),kecamatan:$("#kecamatan").value,komoditas:$("#komoditasInput").value.trim(),jenis:canonicalSeedType($("#jenisBenih").value),alamat:$("#alamat").value.trim(),telepon:$("#telepon").value.trim(),luas:Number($("#luas").value)||0,produksi:Number($("#produksi").value)||0,status:existing?.status||"Aktif",statusSertifikat:$("#statusSertifikat").value,keteranganSertifikat:$("#statusSertifikat").value==="Bersertifikat"?$("#certificateDetails").value.trim():"",verifikasi:$("#verifikasiInput").value};
  const {error}=await saveRow(row);
  if(error){console.error(error);toast("Gagal menyimpan data. Periksa koneksi dan hak akses editor.");return}
  $("#penangkarForm").reset();$("#editId").value="";$("#formTitle").textContent="Input & Pembaruan Data";updateProductionUnit();updateCertificateDetailsField();
  await loadData(false);showPage("data");toast(id?"Data berhasil diperbarui.":"Data penangkar berhasil ditambahkan.");
};

$("#cancelEdit").onclick=()=>{$("#penangkarForm").reset();$("#editId").value="";$("#formTitle").textContent="Input & Pembaruan Data";updateProductionUnit();updateCertificateDetailsField();showPage("data")};
$("#closeModal").onclick=()=>$("#modal").classList.remove("show");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.remove("show")};

async function downloadDocxReport(){
  const api=window.docx;
  if(!api?.Document||!api?.Packer){toast("Pembuat DOCX belum termuat. Periksa koneksi internet lalu muat ulang halaman.");return;}
  const {Document,Paragraph,TextRun,Table,TableRow,TableCell,ImageRun,AlignmentType,WidthType,BorderStyle,ShadingType,VerticalAlign}=api;
  const widths=[500,1500,1050,1250,950,2600,1500,900,1850,1378];
  const border={style:BorderStyle.SINGLE,size:4,color:"B8C9BC"};
  const tableBorders={top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};
  const margins={top:55,bottom:55,left:65,right:65};
  const makeText=(text,options={})=>new TextRun({text:String(text??""),font:"Arial",...options});
  const cell=(children,width,fill)=>new TableCell({width:{size:width,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins,shading:fill?{fill,type:ShadingType.CLEAR}:undefined,borders:tableBorders,children:Array.isArray(children)?children:[children]});
  const headerLabels=["No","Nama Penangkar","Kecamatan","Komoditas","Jenis Benih","Alamat","No Telepon","Luas Lahan (Ha)","Kapasitas Produksi","Status"];
  const headerRow=new TableRow({tableHeader:true,cantSplit:true,children:headerLabels.map((label,i)=>cell(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[makeText(label,{bold:true,color:"FFFFFF",size:17})]}),widths[i],"075B35"))});
  const bodyRows=data.map((row,index)=>new TableRow({cantSplit:true,children:[
    String(index+1),row.nama,row.kecamatan,row.komoditas,canonicalSeedType(row.jenis),row.alamat,row.telepon,
    `${row.luas||0}`,`${row.produksi||0} ${productionUnitForSeedType(row.jenis)}`,row.statusSertifikat||"Belum Bersertifikat"
  ].map((value,i)=>cell(new Paragraph({alignment:i===0||i===7||i===8?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{before:0,after:0,line:205},children:[makeText(value,{size:15})]}),widths[i]))}));
  try{
    const logoResponse=await fetch("assets/report-letterhead-logo.jpeg");
    if(!logoResponse.ok)throw new Error("Logo kop laporan tidak dapat dibaca.");
    const logoBytes=new Uint8Array(await logoResponse.arrayBuffer());
    const letterhead=new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[1650,12178,1650],layout:"fixed",borders:{top:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},bottom:{style:BorderStyle.SINGLE,size:14,color:"075B35"},left:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},right:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},insideHorizontal:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},insideVertical:{style:BorderStyle.NONE,size:0,color:"FFFFFF"}},rows:[new TableRow({cantSplit:true,children:[
      new TableCell({width:{size:1650,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:70,bottom:140,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data:logoBytes,transformation:{width:72,height:72},type:"jpg"})]})]}),
      new TableCell({width:{size:12178,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:50,bottom:140,left:120,right:120},children:[
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:30},children:[makeText("PEMERINTAH KABUPATEN BANDUNG BARAT",{bold:true,size:22})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:45},children:[makeText("DINAS KETAHANAN PANGAN DAN PERTANIAN",{bold:true,size:28})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:20},children:[makeText("Kompleks Perkantoran Pemerintah Kabupaten Bandung Barat,",{size:17})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[makeText("Jl. Raya Padalarang - Cisarua KM. 2, Mekarsari, Ngamprah, 40552, Pos-el dkpp.kbb@gmail.com",{size:17})]})
      ]}),
      new TableCell({width:{size:1650,type:WidthType.DXA},children:[new Paragraph("")]})
    ]})]});
    const reportDate=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const reportDoc=new Document({sections:[{properties:{page:{size:{width:16838,height:11906},margin:{top:620,right:680,bottom:620,left:680}}},children:[
      letterhead,
      new Paragraph({alignment:AlignmentType.RIGHT,spacing:{before:130,after:100},children:[makeText(`Bandung Barat, ${reportDate}`,{size:18})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:160},children:[makeText("Laporan Data Penangkar Benih Hortikultura",{bold:true,size:25})]}),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,layout:"fixed",borders:tableBorders,rows:[headerRow,...bodyRows]})
    ]}]});
    const blob=await api.Packer.toBlob(reportDoc);
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`Laporan-Data-Penangkar-${new Date().toISOString().slice(0,10)}.docx`;
    document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
    toast(`Laporan DOCX berhasil dibuat (${data.length} data).`);
  }catch(error){console.error("Gagal membuat DOCX:",error);toast(error.message||"Laporan DOCX gagal dibuat.");}
}

$$((".report-btn")).forEach(button=>button.onclick=downloadDocxReport);

$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("show");
$("#today").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

(async function init(){
  setAccess();
  await applySession();
  await loadData(false);
  await loadGallery();
  setInterval(()=>loadGallery(),60000);
  subscribeRealtime();
})();

window.detail=detail;window.editData=editData;window.deleteData=deleteData;window.changeVerify=changeVerify;
