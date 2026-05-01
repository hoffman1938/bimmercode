const fs = require('fs');
const https = require('https');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/data.json');

// Helper to use Google Translate Free API via built-in https
function translateText(text, targetLang) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === '') return resolve(text);
        
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 429) {
                        return reject(new Error('RATE_LIMIT'));
                    }
                    const parsed = JSON.parse(data);
                    if (parsed && parsed[0]) {
                        // Handle multiple sentences
                        const translatedText = parsed[0].map(item => item[0]).join('');
                        resolve(translatedText);
                    } else {
                        resolve(text);
                    }
                } catch (e) {
                    console.error('Parse error:', e.message, 'Data:', data);
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Check if a string needs translation (contains English characters or placeholder text)
function needsTranslation(text, lang) {
    if (!text) return false;
    if (text.includes('(требуется ручной перевод)') || text.includes('(საჭიროებს თარგმნას)')) return true;
    
    // Check if it contains mostly English letters (A-Z)
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    return englishChars > (text.length * 0.5); 
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log('Loading data.json...');
    let rawData = fs.readFileSync(DATA_FILE, 'utf8');
    let dataObj = JSON.parse(rawData);
    let db = dataObj.codes || dataObj;
    
    console.log(`Loaded ${db.length} codes.`);
    
    let processedCount = 0;
    let translatedCount = 0;
    
    for (let i = 0; i < db.length; i++) {
        let entry = db[i];
        let modified = false;
        
        try {
            // Translate Title
            if (needsTranslation(entry.title.ru, 'ru')) {
                entry.title.ru = await translateText(entry.title.en, 'ru');
                modified = true;
            }
            if (needsTranslation(entry.title.ka, 'ka')) {
                entry.title.ka = await translateText(entry.title.en, 'ka');
                modified = true;
            }
            
            // Translate Description
            if (needsTranslation(entry.description.ru, 'ru')) {
                entry.description.ru = await translateText(entry.description.en, 'ru');
                modified = true;
            }
            if (needsTranslation(entry.description.ka, 'ka')) {
                entry.description.ka = await translateText(entry.description.en, 'ka');
                modified = true;
            }
            
            // Translate Solutions
            if (entry.solutions && Array.isArray(entry.solutions.en)) {
                if (!entry.solutions.ru || entry.solutions.ru[0] === entry.solutions.en[0] || entry.solutions.ru[0].includes('Выполните стандартные диагностические процедуры')) {
                    let ruSolutions = [];
                    for (let sol of entry.solutions.en) {
                        ruSolutions.push(await translateText(sol, 'ru'));
                    }
                    entry.solutions.ru = ruSolutions;
                    modified = true;
                }
                
                if (!entry.solutions.ka || entry.solutions.ka[0] === entry.solutions.en[0] || entry.solutions.ka[0].includes('შეასრულეთ სტანდარტული დიაგნოსტიკა')) {
                    let kaSolutions = [];
                    for (let sol of entry.solutions.en) {
                        kaSolutions.push(await translateText(sol, 'ka'));
                    }
                    entry.solutions.ka = kaSolutions;
                    modified = true;
                }
            }
            
            if (modified) {
                translatedCount++;
                console.log(`[${i+1}/${db.length}] Translated code: ${entry.code}`);
                // Add a small delay to avoid Google API rate limits
                await delay(1000); 
            }
            
            processedCount++;
            
            // Save every 50 translated items to avoid losing progress
            if (translatedCount > 0 && translatedCount % 50 === 0 && modified) {
                console.log('Saving progress...');
                if (dataObj.codes) dataObj.codes = db;
                fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
            }
            
        } catch (err) {
            if (err.message === 'RATE_LIMIT') {
                console.error('\n[!] RATE LIMIT REACHED! Google blocked the IP temporarily.');
                console.error('Progress has been saved. Please wait 10-15 minutes and run the script again.');
                if (dataObj.codes) dataObj.codes = db;
                fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
                process.exit(1);
            } else {
                console.error(`Error translating ${entry.code}:`, err.message);
            }
        }
    }
    
    // Final save
    if (dataObj.codes) dataObj.codes = db;
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf8');
    console.log(`\nDone! Processed ${processedCount} codes. Translated ${translatedCount} items.`);
}

main().catch(console.error);
