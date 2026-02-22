// js/bot_logic.js

class AppBotLogic {
  static analyze(text) {
    
    // --- SCENARIO 1: MISFIRE (Пропуски) ---
    if (query.includes("misfire") || query.includes("троит") || query.includes("пропуск") || query.includes("ძაგძაგ") || query.includes("pereboi")) {
      return {
        type: "interactive",
        scenario: "misfire_start"
      };
    }

    // --- SCENARIO 2: SMOKE (Дым) ---
    if (query.includes("smoke") || query.includes("дым") || query.includes("par") || query.includes("boli")) {
      return {
        type: "interactive",
        scenario: "smoke_start"
      };
    }

    // --- SCENARIO 3: BATTERY (АКБ) ---
    if (query.includes("battery") || query.includes("акб") || query.includes("аккум") || query.includes("akumulator") || query.includes("charge") || query.includes("заряд")) {
      return {
        type: "interactive",
        scenario: "battery_start"
      };
    }

    // --- SCENARIO 4: NO START (Не заводится) ---
    if (query.includes("start") || query.includes("crank") || query.includes("заводит") || query.includes("стартер") || query.includes("iqoqeba")) {
      return {
        type: "interactive",
        scenario: "start_start"
      };
    }
    
    return null; // No smart scenario found, fallback to code search
  }

  static getScenarioStep(stepId, lang) {
    const t = APP_TRANSLATIONS[lang];
    if (!t) return null;

    const scenarios = {
      // MISFIRE FLOW
      "misfire_start": {
        text: t.bot_misfire_q1, // "When does the misfire happen?"
        buttons: [
          { text: t.bot_misfire_opt1, action: "misfire_cold" }, // Cold
          { text: t.bot_misfire_opt2, action: "misfire_load" }, // Load
          { text: t.bot_misfire_opt3, action: "misfire_idle" }  // Idle
        ]
      },
      "misfire_cold": {
        text: t.bot_misfire_cold,
        buttons: [{ text: "🔍 " + t.partsBtn, link: "https://www.realoem.com/" }] // Generic link for now
      },
      "misfire_load": {
        text: t.bot_misfire_load,
        buttons: [{ text: "🔍 " + t.partsBtn, link: "https://www.realoem.com/" }]
      },
      "misfire_idle": {
        text: t.bot_misfire_idle,
        buttons: [{ text: "OK", action: "reset" }]
      },

      // SMOKE FLOW
      "smoke_start": {
        text: t.bot_smoke_q1,
        buttons: [
          { text: "🔵 " + t.bot_smoke_blue, action: "smoke_blue" },
          { text: "⚫ " + t.bot_smoke_black, action: "smoke_black" },
          { text: "⚪ " + t.bot_smoke_white, action: "smoke_white" }
        ]
      },
      "smoke_blue": { text: t.bot_smoke_blue_res },
      "smoke_black": { text: t.bot_smoke_black_res },
      "smoke_white": { text: t.bot_smoke_white_res },

      // BATTERY FLOW
      "battery_start": {
        text: t.bot_battery_q1,
        buttons: [
          { text: "⚡ " + t.bot_battery_drain, action: "battery_drain" },
          { text: "🔋 " + t.bot_battery_charge, action: "battery_charge" },
          { text: "💻 " + t.bot_battery_reg, action: "battery_reg" }
        ]
      },
      "battery_drain": { text: t.bot_battery_drain_res },
      "battery_charge": { text: t.bot_battery_charge_res },
      "battery_reg": { text: t.bot_battery_reg_res },

      // NO START FLOW
      "start_start": {
        text: t.bot_start_q1,
        buttons: [
          { text: "✅ " + t.bot_start_yes, action: "start_yes" },
          { text: "❌ " + t.bot_start_no, action: "start_no" }
        ]
      },
      "start_yes": { text: t.bot_start_crank_res },
      "start_no": { text: t.bot_start_silent_res }
    };

    return scenarios[stepId] || null;
  }
}

 

