// Переменные состояния
let currentLanguage = localStorage.getItem("forumLanguage") || "en";

// Словарь переводов
const translations = {
  en: {
    homeBtn: "Home",
    forumBtn: "Forum",
    vinTitle: "Decode Your VIN",
    vinSubtitle: "Enter 17-digit VIN to check technical specs.",
    btnCheck: "CHECK",
    loading: "Checking global database...",
    lblHistory: "Recent Checks",

    lblModel: "Model",
    lblYear: "Year",
    lblSeries: "Series",
    lblBody: "Body Type",
    lblEngine: "Engine",
    lblPower: "Power",
    lblFuel: "Fuel",
    lblDrive: "Drive",
    lblDoors: "Doors",
    lblCountry: "Country",
    lblPlant: "Factory",
    lblWeight: "GVWR",
    vinGroupVehicle: "Vehicle",
    vinGroupPowertrain: "Powertrain",
    vinGroupFactory: "Assembly & weight",

    extTitle: "Looking for full options list (S-Codes)?",
    extText:
      "Our database provides technical specs. To see specific options (M-Sport, Leather, etc.), use these deep decoders:",
    btnFullOptions: "View Full Options List",

    deepDecodeTitle: "Deep Decode & History Utilities",
    deepDecodeDesc: "Use these specialized external tools to get full factory options and verify auction/salvage history (Copart/IAA).",
    bidfaxTitle: "Auction History",
    bidfaxDesc: "BidFax (Copart & IAAI Data)",
    statvinTitle: "Salvage Search",
    statvinDesc: "Stat.vin (Analytics)",
    factoryDocsTitle: "Factory Options",
    factoryDocsDesc: "M-Decoder (S-Codes & Equip)",
    bimmerWorkTitle: "bimmer.work",
    bimmerWorkDesc: "Alternative Option Decoder",
  },
  ru: {
    homeBtn: "Главная",
    forumBtn: "Форум",
    vinTitle: "Расшифровка VIN",
    vinSubtitle: "Введите 17 знаков VIN для проверки характеристик.",
    btnCheck: "ПРОВЕРИТЬ",
    loading: "Поиск в базе данных...",
    lblHistory: "Недавние проверки",

    lblModel: "Модель",
    lblYear: "Год",
    lblSeries: "Серия",
    lblBody: "Кузов",
    lblEngine: "Двигатель",
    lblPower: "Мощность",
    lblFuel: "Топливо",
    lblDrive: "Привод",
    lblDoors: "Двери",
    lblCountry: "Страна",
    lblPlant: "Завод",
    lblWeight: "Вес (макс)",
    vinGroupVehicle: "Автомобиль",
    vinGroupPowertrain: "Силовая установка",
    vinGroupFactory: "Сборка и вес",

    extTitle: "Ищете полный список опций (S-коды)?",
    extText:
      "Наша база показывает технические данные. Для просмотра списка опций (M-пакет, кожа и т.д.) используйте эти сервисы:",
    btnFullOptions: "Посмотреть список опций",

    deepDecodeTitle: "Глубокая Расшифровка и История",
    deepDecodeDesc: "Используйте эти сторонние инструменты, чтобы узнать полную заводскую комплектацию и проверить историю аукционов (Copart/IAA).",
    bidfaxTitle: "История Аукционов",
    bidfaxDesc: "BidFax (базы Copart и IAAI)",
    statvinTitle: "Поиск Повреждений",
    statvinDesc: "Stat.vin (Статистика)",
    factoryDocsTitle: "Заводские Опции",
    factoryDocsDesc: "M-Decoder (S-коды и опции)",
    bimmerWorkTitle: "bimmer.work",
    bimmerWorkDesc: "Альтернативный Декодер опций",
  },
  ka: {
    homeBtn: "მთავარი",
    forumBtn: "ფორუმი",
    vinTitle: "VIN კოდის გაშიფრვა",
    vinSubtitle: "შეიყვანეთ 17 ნიშნა VIN კოდი მონაცემების გასაგებად.",
    btnCheck: "შემოწმება",
    loading: "მიმდინარეობს ძებნა...",
    lblHistory: "ბოლო შემოწმებები",

    lblModel: "მოდელი",
    lblYear: "წელი",
    lblSeries: "სერია",
    lblBody: "ძარა",
    lblEngine: "ძრავი",
    lblPower: "სიმძლავრე",
    lblFuel: "საწვავი",
    lblDrive: "წამყვანი თვლები",
    lblDoors: "კარები",
    lblCountry: "ქვეყანა",
    lblPlant: "ქარხანა",
    lblWeight: "წონა",
    vinGroupVehicle: "ავტომობილი",
    vinGroupPowertrain: "ძრავა და ტრანსმისია",
    vinGroupFactory: "შეკრება და წონა",

    extTitle: "ეძებთ ოპციების სრულ სიას (S-Codes)?",
    extText:
      "ჩვენი ბაზა გაჩვენებთ ტექნიკურ მონაცემებს. ოპციების სანახავად (M-პაკეტი, ტყავი) გამოიყენეთ:",
    btnFullOptions: "ოპციების სრული სია",

    deepDecodeTitle: "ღრმა გაშიფრვა და ისტორია",
    deepDecodeDesc: "გამოიყენეთ ეს გარე ინსტრუმენტები ქარხნული ოპციების გასაგებად და აუქციონის ისტორიის (Copart/IAA) შესამოწმებლად.",
    bidfaxTitle: "აუქციონის ისტორია",
    bidfaxDesc: "BidFax (Copart და IAAI მონაცემები)",
    statvinTitle: "დაზიანებების ძიება",
    statvinDesc: "Stat.vin (სტატისტიკა)",
    factoryDocsTitle: "ქარხნული ოპციები",
    factoryDocsDesc: "M-Decoder (S-კოდები და სხვა)",
    bimmerWorkTitle: "bimmer.work",
    bimmerWorkDesc: "ალტერნატიული ოპციების დეკოდერი",
  },
};

// --- ФУНКЦИИ ИСТОРИИ ---
function loadHistory() {
  const history = JSON.parse(localStorage.getItem("vinHistory")) || [];
  const container = document.getElementById("history-container");
  const list = document.getElementById("history-list");

  if (history.length === 0) {
    if (container) container.style.display = "none";
    return;
  }

  if (container) container.style.display = "block";
  if (list) {
    list.innerHTML = "";
    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
                <i class="fas fa-history"></i>
                <span>${item.title}</span>
                <small style="opacity:0.6">${item.vin.substring(0, 5)}...</small>
            `;
      div.onclick = () => {
        document.getElementById("vin-input").value = item.vin;
        decodeVin();
      };
      list.appendChild(div);
    });
  }
}

function saveToHistory(vin, title) {
  let history = JSON.parse(localStorage.getItem("vinHistory")) || [];
  history = history.filter((h) => h.vin !== vin);
  history.unshift({ vin, title });
  if (history.length > 4) history = history.slice(0, 4);
  localStorage.setItem("vinHistory", JSON.stringify(history));
  loadHistory();
}

// --- ЯЗЫК ---
function updateLanguage() {
  const t = translations[currentLanguage];
  const langBtnSpan = document.querySelector("#language-toggle span");
  const langLabels = { en: "EN", ru: "РУ", ka: "GE" };
  if (langBtnSpan) langBtnSpan.innerText = langLabels[currentLanguage];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.innerText = t[key];
  });

  const vinInput = document.getElementById("vin-input");
  if (vinInput) vinInput.placeholder = "WBA...";

  document.documentElement.setAttribute("lang", currentLanguage);
  window.dispatchEvent(
    new CustomEvent("languageChanged", { detail: { lang: currentLanguage } })
  );
  if (typeof window.updateChatContext === "function") {
    window.updateChatContext();
  }
}

if (document.getElementById("language-toggle")) {
  document.getElementById("language-toggle").addEventListener("click", () => {
    const langs = ["en", "ru", "ka"];
    let idx = langs.indexOf(currentLanguage);
    currentLanguage = langs[(idx + 1) % langs.length];
    localStorage.setItem("forumLanguage", currentLanguage);
    updateLanguage();
  });
}

// Инициализация
window.addEventListener("DOMContentLoaded", () => {
  updateLanguage();
  loadHistory();
});

// Логика декодирования
async function decodeVin() {
  const vinInput = document.getElementById("vin-input");
  const vin = vinInput.value.trim().toUpperCase();
  const resultDiv = document.getElementById("vin-result");
  const loader = document.getElementById("loader");

  if (vin.length !== 17) {
    alert("VIN must be 17 characters!");
    return;
  }

  resultDiv.style.display = "none";
  loader.style.display = "flex";

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`,
    );
    const data = await response.json();
    const results = data.Results;

    const getVal = (varName) => {
      const item = results.find((r) => r.Variable === varName);
      return item && item.Value && item.Value !== "null" ? item.Value : "-";
    };

    const make = getVal("Make");
    if (
      make.toUpperCase().indexOf("BMW") === -1 &&
      make.toUpperCase().indexOf("MINI") === -1
    ) {
      alert("Not a BMW VIN (Found: " + make + ")");
      loader.style.display = "none";
      return;
    }

    const model = getVal("Model");
    const year = getVal("Model Year");
    const series = getVal("Series");
    const bodyClass = getVal("Body Class");
    const engineCyl = getVal("Engine Number of Cylinders");
    const engineL = getVal("Displacement (L)");
    const hp = getVal("Engine Brake (hp) From");
    const kw = getVal("Engine Power (kW)");
    const fuel = getVal("Fuel Type - Primary");
    const drive = getVal("Drive Type");
    const doors = getVal("Doors");
    const plantCity = getVal("Plant City");
    const plantCountry = getVal("Plant Country");
    const weight = getVal("Gross Vehicle Weight Rating From");

    // UI
    document.getElementById("car-title").innerText = `${year} BMW ${model}`;
    const resVin = document.getElementById("res-vin");
    if (resVin) resVin.textContent = vin;
    document.getElementById("res-model").innerText = model;
    document.getElementById("res-year").innerText = year;
    document.getElementById("res-series").innerText =
      series !== "-" ? series : "N/A";
    document.getElementById("res-body").innerText = bodyClass.replace(
      "Sedan/Saloon",
      "Sedan",
    );

    let engineText = "-";
    if (engineL !== "-") engineText = `${engineL}L`;
    if (engineCyl !== "-") engineText += ` ${engineCyl}-Cyl`;
    document.getElementById("res-engine").innerText = engineText;

    let powerText = "-";
    if (hp !== "-") powerText = `${hp} HP`;
    else if (kw !== "-") powerText = `${kw} kW`;
    document.getElementById("res-power").innerText = powerText;

    document.getElementById("res-fuel").innerText = fuel;
    document.getElementById("res-drive").innerText = drive;
    document.getElementById("res-doors").innerText = doors;
    document.getElementById("res-country").innerText = plantCountry;
    document.getElementById("res-plant").innerText = plantCity;
    document.getElementById("res-weight").innerText = weight;

    document.getElementById("link-mdecoder").href = `https://www.mdecoder.com/decode/${vin}`;
    // The href assignments have been replaced by the dynamic submitExternalSearch function below
    
    // Показываем секцию
    document.getElementById("deep-decode-section").style.display = "block";

    const shortTitle = `${year} ${model}`;
    saveToHistory(vin, shortTitle);

    // --- СОХРАНЕНИЕ КОНТЕКСТА ДЛЯ AI ЧАТА ---
    window.currentCarContext = {
      model: `BMW ${model}`,
      year: year,
      engine: engineL !== "-" ? `${engineL}L` : "Engine",
      chassis: series,
      vin: vin,
    };

    // Обновляем чат, если он открыт
    if (typeof window.updateChatContext === "function") {
      window.updateChatContext();
    }

    loader.style.display = "none";
    resultDiv.style.display = "block";
    resultDiv.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    loader.style.display = "none";
    alert("Connection error. Please try again.");
  }
}

// Enter key
if (document.getElementById("vin-input")) {
  document
    .getElementById("vin-input")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") decodeVin();
    });
}

// Динамическое перенаправление на внешние сервисы
function submitExternalSearch(serviceId) {
  const vinInput = document.getElementById("vin-input");
  if (!vinInput) return;
  const vin = vinInput.value.trim().toUpperCase();
  if (!vin || vin.length !== 17) return;

  let url = "";
  
  switch(serviceId) {
    case 'bidfax':
      url = `https://en.bidfax.info/?do=search&subaction=search&story=${vin}`;
      break;
    case 'statvin':
      url = `https://stat.vin/cars?vin=${vin}`;
      break;
    case 'mdecoder':
      // M-Decoder needs 'vin' in POST or direct query
      url = `https://www.mdecoder.com/decode/${vin}`;
      fetch(`https://www.mdecoder.com/decode/${vin}`, { mode: 'no-cors' }).catch(()=>{}); // Pre-warm
      break;
    case 'bimmerwork':
      // bimmer.work requires POST to /decode
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://bimmer.work/';
      form.target = '_blank';
      
      const vinInputHf = document.createElement('input');
      vinInputHf.type = 'hidden';
      vinInputHf.name = 'vin';
      vinInputHf.value = vin;
      
      form.appendChild(vinInputHf);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      return; 
  }
  
  if (url) {
    window.open(url, "_blank");
  }
}
