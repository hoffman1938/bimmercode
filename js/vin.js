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

// Функция обновления языка
function updateLanguage() {
    const t = translations[currentLanguage];
    
    // Кнопка в хедере
    const langBtnSpan = document.querySelector('#language-toggle span');
    const langLabels = { en: "EN", ru: "RU", ka: "KA" };
    if(langBtnSpan) langBtnSpan.innerText = langLabels[currentLanguage];

    // Все элементы с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });

    // Плейсхолдер
    const vinInput = document.getElementById('vin-input');
    if(vinInput) {
        vinInput.placeholder = "WBA..."; 
    }
}

// Переключатель языка
document.getElementById('language-toggle').addEventListener('click', () => {
    const langs = ['en', 'ru', 'ka'];
    let idx = langs.indexOf(currentLanguage);
    currentLanguage = langs[(idx + 1) % langs.length];
    
    // Сохраняем, чтобы работало на форуме
    localStorage.setItem('forumLanguage', currentLanguage);
    updateLanguage();
});

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    updateLanguage();
});

// Логика декодирования (без изменений в логике, только UI)
async function decodeVin() {
    const vinInput = document.getElementById('vin-input');
    const vin = vinInput.value.trim();
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
        if (make.toUpperCase() !== 'BMW' && make.toUpperCase() !== 'MINI') {
            alert("Not a BMW VIN.");
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

        // Ссылки на внешние декодеры
        document.getElementById('link-mdecoder').href = `https://www.mdecoder.com/decode/${vin}`;
        document.getElementById('link-bimmerwork').href = `https://bimmer.work/`; 

        loader.style.display = 'none';
        resultDiv.style.display = 'block';

    } catch (e) {
        console.error(e);
        loader.style.display = 'none';
        alert("Error connecting to database.");
    }
}

// Enter key
document.getElementById('vin-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') decodeVin();
});