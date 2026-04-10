/*
═══════════════════════════════════════════════════════════════════
  HABITONE — server.js
  Backend proxy Node.js/Express per Groq API
═══════════════════════════════════════════════════════════════════

  PERCHÉ UN BACKEND? (spiegazione per il video YouTube)
  ──────────────────────────────────────────────────────
  Se metti la tua API key direttamente nell'HTML (frontend),
  chiunque apra il sito può vederla premendo F12 → Network.
  Un malintenzionato potrebbe usarla e farti spendere soldi.

  La soluzione: un piccolo server Node.js che sta sul tuo computer
  (o su un hosting come Railway, Render, Vercel).
  Il frontend NON conosce la chiave API — parla solo con il tuo
  server. Il server parla con Groq usando la chiave segreta.

  FLUSSO:
  Browser → POST /api/habit → server.js → Groq API
                                        ← risposta JSON
              ← risultato pulito ←

  COME AVVIARLO:
  1. npm install
  2. Crea un file ".env" con: GROQ_API_KEY=la_tua_chiave
  3. node server.js  (oppure: npm start)
  4. Apri habitone.html nel browser (deve girare su localhost:3000)

═══════════════════════════════════════════════════════════════════
*/

// ── DIPENDENZE ──────────────────────────────────────────────────
// "require" è il modo Node.js di importare librerie esterne.

const express = require('express');   // Framework per creare il server HTTP
const cors = require('cors');      // Permette al browser di chiamare il server
const dotenv = require('dotenv');    // Legge il file .env con la chiave segreta

// Carica le variabili da .env in process.env
// Questa riga deve stare PRIMA di qualsiasi process.env.QUALCOSA
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Porta su cui gira il server


// ── MIDDLEWARE ───────────────────────────────────────────────────
// I middleware sono funzioni che "elaborano" ogni richiesta prima
// che arrivi al tuo codice.

// CORS: permette al file HTML (aperto dal browser) di fare fetch
// verso questo server. Senza questo il browser blocca la richiesta.
app.use(cors());

// JSON parser: converte automaticamente il body delle richieste
// da testo grezzo a oggetto JavaScript
app.use(express.json());

// File statici: serve l'HTML direttamente dal server.
// Così potrai aprire http://localhost:3000 invece di aprire il file.
app.use(express.static('.'));


// ── ROTTA PRINCIPALE: /api/habit ─────────────────────────────────
/*
  Questa è la "porta" che il frontend chiama.
  Riceve le risposte dell'utente, costruisce il prompt,
  chiama Groq e restituisce il risultato.

  POST /api/habit
  Body: { answers: { goal, time, energy, obstacle, lifestyle } }
*/
app.post('/api/habit', async (req, res) => {

  // ── Leggi la chiave API dall'ambiente (non dal codice!) ──
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Chiave API non configurata. Crea il file .env con GROQ_API_KEY.'
    });
  }

  // ── Estrai le risposte dal body della richiesta ──
  const { answers } = req.body;

  if (!answers) {
    return res.status(400).json({ error: 'Risposte mancanti nel body.' });
  }

  // ── Mappa i valori "tecnici" in testo leggibile ──
  const labels = {
    goal: {
      salute: 'migliorare la salute fisica',
      mente: 'ridurre stress e ansia',
      produttivita: 'essere più produttivo',
      crescita: 'crescita personale e apprendimento',
    },
    time: {
      '5min': '5-10 minuti al giorno',
      '15min': '15-20 minuti al giorno',
      '30min': 'mezz\'ora o più al giorno',
      flessibile: 'tempo variabile e flessibile',
    },
    energy: {
      mattina: 'mattina presto',
      meta: 'metà mattina',
      pomeriggio: 'pomeriggio',
      sera: 'sera',
    },
    obstacle: {
      motivazione: 'perdo la motivazione facilmente',
      tempo: 'non ho abbastanza tempo',
      costanza: 'dimentico o salto giorni',
      troppi: 'voglio fare troppo insieme',
    },
    lifestyle: {
      sedentario: 'prevalentemente sedentario',
      moderato: 'abbastanza attivo',
      attivo: 'molto attivo e dinamico',
      caotico: 'caotico e irregolare',
    },
  };

  // Converti i valori raw in testo
  const goal = labels.goal[answers.goal] || answers.goal;
  const time = labels.time[answers.time] || answers.time;
  const energy = labels.energy[answers.energy] || answers.energy;
  const obstacle = labels.obstacle[answers.obstacle] || answers.obstacle;
  const lifestyle = labels.lifestyle[answers.lifestyle] || answers.lifestyle;

  // ════════════════════════════════════════════════════════════
  //  IL PROMPT — il cuore dell'AI
  // ════════════════════════════════════════════════════════════
  const prompt = `Sei un coach esperto di habit design, psicologia comportamentale e benessere personale.
Analizza il profilo di questo utente e consiglia UN'UNICA abitudine da costruire.

PROFILO UTENTE:
- Obiettivo principale: ${goal}
- Tempo disponibile ogni giorno: ${time}
- Momento più energico: ${energy}
- Ostacolo principale: ${obstacle}
- Stile di vita: ${lifestyle}

ISTRUZIONI:
1. Scegli UN'UNICA abitudine (non più di una) che sia realmente fattibile per questo profilo
2. L'abitudine deve essere molto specifica e concreta (non "fai esercizio" ma "10 minuti di stretching appena sveglio")
3. Il piano 7 giorni deve avere progressione graduale: inizia PICCOLO e cresci
4. Il consiglio finale deve essere personalizzato sull'ostacolo specifico dell'utente

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo prima o dopo.
Usa ESATTAMENTE questa struttura:

{
  "habit_name": "Nome breve e motivante dell'abitudine (max 5 parole)",
  "habit_emoji": "Una singola emoji che rappresenta l'abitudine",
  "explanation": "Spiegazione di 2-3 frasi su perché questa abitudine è perfetta per questo utente specifico. Sii diretto e personale, usa 'tu'.",
  "week_plan": [
    {
      "day": 1,
      "day_label": "Giorno 1",
      "title": "Titolo breve del task (max 4 parole)",
      "task": "Descrizione concreta di cosa fare oggi (1-2 frasi max)",
      "emoji": "emoji rappresentativa",
      "duration": "durata stimata (es: 5 min)"
    },
    { "day": 2, "day_label": "Giorno 2", "title": "...", "task": "...", "emoji": "...", "duration": "..." },
    { "day": 3, "day_label": "Giorno 3", "title": "...", "task": "...", "emoji": "...", "duration": "..." },
    { "day": 4, "day_label": "Giorno 4", "title": "...", "task": "...", "emoji": "...", "duration": "..." },
    { "day": 5, "day_label": "Giorno 5", "title": "...", "task": "...", "emoji": "...", "duration": "..." },
    { "day": 6, "day_label": "Giorno 6", "title": "...", "task": "...", "emoji": "...", "duration": "..." },
    { "day": 7, "day_label": "Giorno 7", "title": "...", "task": "...", "emoji": "...", "duration": "..." }
  ],
  "persistence_tip": "Un consiglio concreto e personalizzato (2-3 frasi) su come non mollare, basato sull'ostacolo specifico dell'utente."
}`;


  // ── CHIAMATA A GROQ API ─────────────────────────────
  try {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const groqResponse = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // Autenticazione per Groq
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Modello aggiornato e potentissimo
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        // Opzionale ma consigliato con Groq per forzare il JSON
        response_format: { type: "json_object" }
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      console.error('Errore Groq:', errorData);
      return res.status(groqResponse.status).json({
        error: `Errore Groq API: ${errorData?.error?.message || 'Errore sconosciuto'}`
      });
    }

    // Leggi la risposta di Groq
    const groqData = await groqResponse.json();

    // Estrai il testo generato dalla struttura di risposta (Standard OpenAI)
    const rawText = groqData?.choices?.[0]?.message?.content;

    if (!rawText) {
      return res.status(500).json({ error: 'Risposta vuota da Groq.' });
    }

    // ── Parsa il JSON restituito ──
    const cleanText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let habitData;
    try {
      habitData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Errore parsing JSON Groq:', cleanText);
      return res.status(500).json({
        error: 'Il modello ha restituito un formato non valido. Riprova.',
        raw: cleanText
      });
    }

    // ── Invia il risultato al frontend ──
    return res.json({ success: true, data: habitData });

  } catch (networkError) {
    console.error('Errore di rete:', networkError);
    return res.status(500).json({
      error: 'Errore di connessione a Groq. Controlla la connessione internet.'
    });
  }
});


// ── AVVIA IL SERVER ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   HabitOne Server (Groq) attivo!         ║
║   http://localhost:${PORT}                 ║
║                                          ║
║   Apri habitone.html nel browser         ║
║   oppure vai su http://localhost:${PORT}    ║
╚══════════════════════════════════════════╝
  `);
});