// Переменные состояния
let currentLanguage = localStorage.getItem('forumLanguage') || 'en';

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
        
        extTitle: "Looking for full options list (S-Codes)?",
        extText: "Our database provides technical specs. To see specific options (M-Sport, Leather, etc.), use these deep decoders:",
        btnFullOptions: "View Full Options List"
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
        
        extTitle: "Ищете полный список опций (S-коды)?",
        extText: "Наша база показывает технические данные. Для просмотра списка опций (M-пакет, кожа и т.д.) используйте эти сервисы:",
        btnFullOptions: "Посмотреть список опций"
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
        
        extTitle: "ეძებთ ოპციების სრულ სიას (S-Codes)?",
        extText: "ჩვენი ბაზა გაჩვენებთ ტექნიკურ მონაცემებს. ოპციების სანახავად (M-პაკეტი, ტყავი) გამოიყენეთ:",
        btnFullOptions: "ოპციების სრული სია"
    }
};

// --- ФУНКЦИИ ИСТОРИИ ---
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('vinHistory')) || [];
    const container = document.getElementById('history-container');
    const list = document.getElementById('history-list');

    if (history.length === 0) {
        if(container) container.style.display = 'none';
        return;
    }

    if(container) container.style.display = 'block';
    if(list) {
        list.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <i class="fas fa-history"></i>
                <span>${item.title}</span>
                <small style="opacity:0.6">${item.vin.substring(0, 5)}...</small>
            `;
            div.onclick = () => {
                document.getElementById('vin-input').value = item.vin;
                decodeVin();
            };
            list.appendChild(div);
        });
    }
}

function saveToHistory(vin, title) {
    let history = JSON.parse(localStorage.getItem('vinHistory')) || [];
    history = history.filter(h => h.vin !== vin);
    history.unshift({ vin, title });
    if (history.length > 4) history = history.slice(0, 4);
    localStorage.setItem('vinHistory', JSON.stringify(history));
    loadHistory();
}

// --- ЯЗЫК ---
function updateLanguage() {
    const t = translations[currentLanguage];
    const langBtnSpan = document.querySelector('#language-toggle span');
    const langLabels = { en: "EN", ru: "RU", ka: "KA" };
    if(langBtnSpan) langBtnSpan.innerText = langLabels[currentLanguage];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });

    const vinInput = document.getElementById('vin-input');
    if(vinInput) vinInput.placeholder = "WBA..."; 
}

if(document.getElementById('language-toggle')) {
    document.getElementById('language-toggle').addEventListener('click', () => {
        const langs = ['en', 'ru', 'ka'];
        let idx = langs.indexOf(currentLanguage);
        currentLanguage = langs[(idx + 1) % langs.length];
        localStorage.setItem('forumLanguage', currentLanguage);
        updateLanguage();
    });
}

// Инициализация
window.addEventListener('DOMContentLoaded', () => {
    updateLanguage();
    loadHistory();
});

// Логика декодирования
async function decodeVin() {
    const vinInput = document.getElementById('vin-input');
    const vin = vinInput.value.trim().toUpperCase(); 
    const resultDiv = document.getElementById('vin-result');
    const loader = document.getElementById('loader');

    if (vin.length !== 17) {
        alert("VIN must be 17 characters!");
        return;
    }

    resultDiv.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
        const data = await response.json();
        const results = data.Results;
        
        const getVal = (varName) => {
            const item = results.find(r => r.Variable === varName);
            return item && item.Value && item.Value !== "null" ? item.Value : '-';
        };

        const make = getVal("Make");
        if (make.toUpperCase().indexOf('BMW') === -1 && make.toUpperCase().indexOf('MINI') === -1) {
            alert("Not a BMW VIN (Found: " + make + ")");
            loader.style.display = 'none';
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
        document.getElementById('car-title').innerText = `${year} BMW ${model}`;
        document.getElementById('res-model').innerText = model;
        document.getElementById('res-year').innerText = year;
        document.getElementById('res-series').innerText = series !== '-' ? series : 'N/A';
        document.getElementById('res-body').innerText = bodyClass.replace("Sedan/Saloon", "Sedan");

        let engineText = '-';
        if(engineL !== '-') engineText = `${engineL}L`;
        if(engineCyl !== '-') engineText += ` ${engineCyl}-Cyl`;
        document.getElementById('res-engine').innerText = engineText;

        let powerText = '-';
        if(hp !== '-') powerText = `${hp} HP`;
        else if(kw !== '-') powerText = `${kw} kW`;
        document.getElementById('res-power').innerText = powerText;
        
        document.getElementById('res-fuel').innerText = fuel;
        document.getElementById('res-drive').innerText = drive;
        document.getElementById('res-doors').innerText = doors;
        document.getElementById('res-country').innerText = plantCountry;
        document.getElementById('res-plant').innerText = plantCity;
        document.getElementById('res-weight').innerText = weight;

        document.getElementById('link-mdecoder').href = `https://www.mdecoder.com/decode/${vin}`;
        document.getElementById('link-bimmerwork').href = `https://bimmer.work/`; 

        const shortTitle = `${year} ${model}`;
        saveToHistory(vin, shortTitle);

        // --- СОХРАНЕНИЕ КОНТЕКСТА ДЛЯ AI ЧАТА ---
        window.currentCarContext = {
            model: `BMW ${model}`,
            year: year,
            engine: engineL !== '-' ? `${engineL}L` : 'Engine',
            chassis: series,
            vin: vin
        };
        
        // Обновляем чат, если он открыт
        if (typeof window.updateChatContext === 'function') {
            window.updateChatContext();
        }

        loader.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (e) {
        console.error(e);
        loader.style.display = 'none';
        alert("Connection error. Please try again.");
    }
}

// Enter key
if(document.getElementById('vin-input')) {
    document.getElementById('vin-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') decodeVin();
    });
}