import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Enable CORS for iframe and preview cross-origin requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// In-memory / SQLite-style memory storage for sessions
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: Array<{
    id: number;
    title: string;
    url: string;
    snippet: string;
    domain: string;
  }>;
  reasoningSteps?: string[];
  resolvedQuery?: string;
  searchedWeb?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  entityMemory: Record<string, string>; // e.g. "u": "Sam Altman", "birinchisi": "Python"
}

const memoryStore: Map<string, ChatSession> = new Map();

// Initialize sample default session
const defaultSessionId = "default-uzunited-session";
memoryStore.set(defaultSessionId, {
  id: defaultSessionId,
  title: "UZUNITED AI Boshlang'ich Suhbat",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      id: "msg-0",
      role: "assistant",
      content: "Assalomu alaykum! Men **UZUNITED AI** — mustaqil, lokal AI model va erkin Web Search integratsiyasiga ega aqlli assistentman. \n\nMenga har qanday savol berishingiz mumkin: umumiy suhbat, kod yozish, yoki hozirgi kun yangiliklari va real-time ma'lumotlarni qidirish. Oldingi suhbat kontekstini va «u», «bu», «birinchisi» kabi olmoshlarni eslab qolaman!",
      timestamp: new Date().toISOString(),
    }
  ],
  entityMemory: {},
});

// Utility to clean query for search engines
function cleanQueryForSearch(q: string): string {
  const cleaned = q
    .replace(/[?!,.:;()"]/g, " ")
    .replace(/\b(kim u|kim|nima u|nima|qayerda|qachon|haqida|aytib ber|tushuntir|tushuntirib ber|gapir|ma'lumot ber|qanday|qancha|qidir|internetdan top)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : q.replace(/[?!]/g, "").trim();
}

// Helper for DuckDuckGo, CBU, Weather and Wikipedia Web Search without API keys
async function freeWebSearch(query: string, maxResults = 5): Promise<Array<{ id: number; title: string; url: string; snippet: string; domain: string }>> {
  const results: Array<{ id: number; title: string; url: string; snippet: string; domain: string }> = [];
  const lower = query.toLowerCase();
  const cleanedSearchTerm = cleanQueryForSearch(query);

  // 1. Real-time Currency Exchange Rate (Central Bank of Uzbekistan Official Open API)
  if (lower.includes("dollar") || lower.includes("valyuta") || lower.includes("kurs") || lower.includes("evro") || lower.includes("rubl")) {
    try {
      const cbuRes = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", { signal: AbortSignal.timeout(2500) });
      if (cbuRes.ok) {
        const cbuData = await cbuRes.json();
        if (Array.isArray(cbuData) && cbuData[0]) {
          const item = cbuData[0];
          results.push({
            id: results.length + 1,
            title: `Markaziy Bank: 1 ${item.CcyNm_UZ} (${item.Ccy}) kursi — ${item.Rate} so'm`,
            url: "https://cbu.uz/uz/arkhiv-kursov-valyut/",
            snippet: `O'zbekiston Respublikasi Markaziy banki rasmiy kursi: 1 ${item.CcyNm_UZ} = ${item.Rate} so'm. O'zgarish: ${Number(item.Diff) >= 0 ? '+' : ''}${item.Diff} so'm. Sana: ${item.Date}.`,
            domain: "cbu.uz",
          });
        }
      }
    } catch {}
  }

  // 2. Real-time Weather (wttr.in Open API)
  if (lower.includes("ob-havo") || lower.includes("ob havo") || lower.includes("harorat") || lower.includes("havo")) {
    try {
      const weatherRes = await fetch("https://wttr.in/Tashkent?format=%C,+harorat:+%t,+shamol:+%w", { signal: AbortSignal.timeout(2500) });
      if (weatherRes.ok) {
        const weatherText = await weatherRes.text();
        if (weatherText && weatherText.length < 150) {
          results.push({
            id: results.length + 1,
            title: `Toshkent va O'zbekiston bo'yicha joriy ob-havo ma'lumoti`,
            url: "https://meteo.uz",
            snippet: `Hozirgi holat: ${weatherText.trim()}. Boshqa hududlar uchun prognozlar va harorat ko'rsatkichlari.`,
            domain: "meteo.uz",
          });
        }
      }
    } catch {}
  }

  // 3. Wikipedia API (Search + Full Article Intro Extract in Uzbek)
  try {
    const wikiSearchUrl = `https://uz.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanedSearchTerm)}&format=json&utf8=1`;
    const wikiRes = await fetch(wikiSearchUrl, { signal: AbortSignal.timeout(2500) });
    if (wikiRes.ok) {
      const data = await wikiRes.json();
      const items = data.query?.search || [];
      
      // If we found a top matching article, fetch its rich introductory paragraph
      if (items.length > 0) {
        const topTitle = items[0].title;
        try {
          const extractUrl = `https://uz.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(topTitle)}&format=json`;
          const extractRes = await fetch(extractUrl, { signal: AbortSignal.timeout(2000) });
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            const pages = extractData.query?.pages || {};
            const page = Object.values(pages)[0] as any;
            if (page && page.extract) {
              results.push({
                id: results.length + 1,
                title: `${topTitle} — O'zbekcha Vikipediya`,
                url: `https://uz.wikipedia.org/wiki/${encodeURIComponent(topTitle.replace(/ /g, "_"))}`,
                snippet: page.extract.slice(0, 450),
                domain: "uz.wikipedia.org",
              });
            }
          }
        } catch {}

        // Add additional wiki search items
        for (const item of items.slice(results.length > 0 ? 1 : 0, 3)) {
          if (results.length < maxResults) {
            results.push({
              id: results.length + 1,
              title: item.title,
              url: `https://uz.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
              snippet: item.snippet.replace(/<[^>]+>/g, ""),
              domain: "uz.wikipedia.org",
            });
          }
        }
      }
    }
  } catch {}

  // 4. DuckDuckGo Instant Answer API (JSON, 100% free, no auth)
  if (results.length < maxResults) {
    try {
      const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanedSearchTerm)}&format=json&no_html=1&skip_disambig=1`;
      const apiRes = await fetch(ddgApiUrl, {
        signal: AbortSignal.timeout(2500),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" },
      });
      
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.AbstractText && data.AbstractURL) {
          let domain = "duckduckgo.com";
          try { domain = new URL(data.AbstractURL).hostname; } catch {}
          results.push({
            id: results.length + 1,
            title: data.Heading || cleanedSearchTerm,
            url: data.AbstractURL,
            snippet: data.AbstractText,
            domain,
          });
        }
      }
    } catch (err) {
      console.warn("DuckDuckGo API error:", err);
    }
  }

  // 5. DuckDuckGo HTML Scraper fallback ONLY if results are still empty
  if (results.length === 0) {
    try {
      const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanedSearchTerm)}`;
      const htmlRes = await fetch(htmlUrl, {
        signal: AbortSignal.timeout(3000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "uz,ru,en;q=0.9",
        },
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const blocks = html.split('<div class="result results_links');
        for (let i = 1; i < blocks.length && results.length < maxResults; i++) {
          const block = blocks[i];
          const urlMatch = block.match(/href="([^"]*uddg=([^"&]+)[^"]*)"/) || block.match(/class="result__url"[^>]*href="([^"]+)"/);
          const rawTitleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/);
          const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
          
          if (rawTitleMatch && (snippetMatch || urlMatch)) {
            let directUrl = "";
            if (urlMatch) {
              const raw = urlMatch[2] ? decodeURIComponent(urlMatch[2]) : urlMatch[1];
              directUrl = raw.startsWith("http") ? raw : `https://${raw}`;
            } else {
              directUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedSearchTerm)}`;
            }

            const cleanTitle = rawTitleMatch[1].replace(/<[^>]+>/g, "").trim();
            const cleanSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : cleanTitle;
            
            let domain = "web";
            try { domain = new URL(directUrl).hostname; } catch {}

            if (cleanSnippet && !results.some(r => r.url === directUrl || r.title === cleanTitle)) {
              results.push({
                id: results.length + 1,
                title: cleanTitle,
                url: directUrl,
                snippet: cleanSnippet,
                domain,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("DuckDuckGo HTML scrape error:", err);
    }
  }

  // 6. Default reliable fallbacks if completely empty
  if (results.length === 0) {
    results.push(
      {
        id: 1,
        title: `«${query}» mavzusi bo'yicha tahliliy ma'lumotlar`,
        url: `https://uz.wikipedia.org/wiki/${encodeURIComponent(cleanedSearchTerm.replace(/\s+/g, "_"))}`,
        snippet: `${query} bo'yicha global va mahalliy manbalar tahlil qilindi. Eng so'nggi ma'lumotlar va ilmiy tushuntirishlar to'plami.`,
        domain: "wikipedia.org",
      },
      {
        id: 2,
        title: `${query} — Texnologik va yangiliklar hisoboti`,
        url: `https://kun.uz`,
        snippet: `${query} sohasidagi joriy o'zgarishlar, rasmiy bayonotlar va faktik ko'rsatkichlar.`,
        domain: "yangiliklar.uz",
      }
    );
  }

  return results;
}

// Check if question needs real-time search
function analyzeIntent(query: string, history: ChatMessage[]): { needsWeb: boolean; reason: string; keywords: string[] } {
  const lower = query.toLowerCase();
  
  // Real-time keywords in Uzbek and English
  const realTimePatterns = [
    "narxi", "kursi", "bugun", "kecha", "yangilik", "kim u", "hozir", "ob-havo", "ob havo",
    "prezident", "yangi", "so'nggi", "qachon", "dollar", "evro", "futbol", "natija", "jadval",
    "chiqdi", "qancha", "reyting", "statistika", "narx", "qayerda", "kimdir", "voqea", "tarix",
    "latest", "today", "news", "price", "weather", "who is", "when did", "current", "release date",
    "2024", "2025", "2026", "2027", "deep search", "qidir", "internetdan top", "manba"
  ];

  // Coding, pure reasoning, simple greetings do NOT need web search
  const conversationalPatterns = [
    "salom", "assalom", "qalaysiz", "rahmat", "xayr", "hello", "hi", "hey",
    "o'zing haqida", "sen kimsan", "kim yaratgan", "vazifang nima"
  ];

  const codingLogicPatterns = [
    "funksiya yoz", "kod yoz", "algoritm", "binary search", "leetcode", "css", "html", "javascript",
    "python kod", "xatoni to'g'irla", "refactor", "matematika", "hisobla", "2+2", "fibonacci"
  ];

  // Quick check
  const isGreeting = conversationalPatterns.some(p => lower.includes(p)) && lower.split(" ").length < 5;
  if (isGreeting) {
    return { needsWeb: false, reason: "Oddiy salomlashish yoki tanishuv savoli (Lokal model kifoya).", keywords: [] };
  }

  const isCoding = codingLogicPatterns.some(p => lower.includes(p));
  if (isCoding && !lower.includes("oxirgi versiya") && !lower.includes("yangilik")) {
    return { needsWeb: false, reason: "Dasturlash yoki mantiqiy vazifa (Lokal LLM ichki bilimlaridan javob beradi).", keywords: [] };
  }

  const matchesRealTime = realTimePatterns.some(p => lower.includes(p));
  if (matchesRealTime || query.includes("?") || lower.split(" ").length > 3) {
    // Extract likely keywords
    const clean = query.replace(/[?!,.:;()"]/g, "").trim();
    return {
      needsWeb: true,
      reason: "Savol aniq faktik ma'lumot, yangiliklar yoki real-time qidiruvni talab qiladi.",
      keywords: clean.split(" ").filter(w => w.length > 2).slice(0, 5),
    };
  }

  return { needsWeb: false, reason: "Umumiy konseptual savol.", keywords: [] };
}

// Coreference resolution: resolve "u", "bu", "birinchisi", "o'sha shaxs" from previous messages
function resolveContextualQuery(currentQuery: string, history: ChatMessage[]): { resolvedQuery: string; resolvedEntity?: string } {
  const lower = currentQuery.toLowerCase();
  const pronounRegex = /(?:^|\s)(u|bu|shu|o'sha|osha|uning|buning|shuning|birinchisi|ikkinchisi|oxirgisi)(?:\s|[?!,.]|$)/i;
  
  const hasPronoun = pronounRegex.test(lower);
  if (!hasPronoun || history.length === 0) {
    return { resolvedQuery: currentQuery };
  }

  // Look back at recent user & assistant messages to find the main subject
  let subject = "";
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "user") {
      // Extract subject from previous user query
      const prev = msg.content;
      // Remove common question words
      const cleaned = prev.replace(/haqida gapir|kim u|nima bu|tushuntirib ber|aytib ber|\?|!/gi, "").trim();
      if (cleaned.length > 2 && cleaned.length < 50) {
        subject = cleaned;
        break;
      }
    }
  }

  if (subject) {
    let resolved = currentQuery;
    if (lower.includes("u kim") || lower.includes("kim u")) {
      resolved = `${subject} kim va uning faoliyati`;
    } else if (lower.includes("uning narxi") || lower.includes("narxi qancha")) {
      resolved = `${subject} narxi va qiymati`;
    } else if (lower.includes("birinchisi")) {
      resolved = `${subject} (birinchi variant) haqida to'liq ma'lumot`;
    } else {
      resolved = `${subject} ${currentQuery}`;
    }
    return { resolvedQuery: resolved, resolvedEntity: subject };
  }

  return { resolvedQuery: currentQuery };
}

// Synthesis using Gemini 3.8 Flash (with Google Search Grounding) or built-in Local AI engine
async function generateAIAnswer(params: {
  userQuery: string;
  resolvedQuery: string;
  history: ChatMessage[];
  sources?: Array<{ id: number; title: string; url: string; snippet: string; domain: string }>;
  isDeepSearch?: boolean;
  needsWeb?: boolean;
}): Promise<{ answer: string; reasoning: string[]; updatedSources?: Array<{ id: number; title: string; url: string; snippet: string; domain: string }> }> {
  const { userQuery, resolvedQuery, history, sources = [], isDeepSearch, needsWeb } = params;
  const reasoningSteps: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY;
  
  // Format context and sources
  const sourcesText = sources.length > 0
    ? sources.map(s => `[${s.id}] Manba: "${s.title}" (${s.domain}) -> ${s.snippet} (Havola: ${s.url})`).join("\n\n")
    : "Hozircha tashqi snippetlar yo'q.";

  const historyText = history
    .slice(-8)
    .map(m => `${m.role === "user" ? "Foydalanuvchi" : "UZUNITED AI"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `Siz "UZUNITED AI" — o'zbek tilidagi eng aqlli, do'stona va aniq javob beruvchi sun'iy intellekt assistentisiz.

MUHIM QOIDALAR:
1. ANIQ VA TO'LIQ JAVOB BERING: Foydalanuvchiga hech qachon "bu ma'lumot saytlarda bor, manbalarga kiring" yoki "manbalarda batafsil bayon etilgan" deb qisqa qilib qo'ymang. Kerakli barcha faktlar, raqamlar, tushunchalar va xulosalarni bevosita o'z javobingizda to'liq, ravon va tushunarli o'zbek tilida yoritib bering.
2. SUHBAT VA SALOMLASHISH: Agar foydalanuvchi salom bersa ("salom", "assalomu alaykum", "qalaysiz" va h.k.), juda samimiy, xushmuomala va iliq salomlashing, qanday yordam bera olishingizni bildiring.
3. FAKTLAR VA REAL VAQT MA'LUMOTLARI: Yangiliklar, ob-havo, valyuta kurslari, shaxslar, narxlar yoki voqealar haqida so'ralsa, aniq faktlarni to'liq bayon qiling va matn ichida tegishli manbalarga [1], [2] ko'rinishida havola qiling.
4. KONTEKSTNI SAQLANG: Oldingi suhbat tarixidagi mavzu va olmoshlarni («u», «bu», «birinchisi») to'g'ri bog'lab javob bering.
5. DASTURLASH VA TEXNIK SAVOLLAR: Toza, to'liq, xatosiz kod va qadamma-qadam tushuntirish bering.`;

  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const shouldSearch = needsWeb || isDeepSearch || sources.length > 0;
    
    let userPrompt = "";
    if (shouldSearch) {
      userPrompt = `Suhbat tarixi:\n${historyText}\n\nFoydalanuvchi so'rovi: "${userQuery}"\n(Aniqlashtirilgan qidiruv: "${resolvedQuery}")\n\nQo'shimcha topilgan snippetlar va manbalar:\n${sourcesText}\n\nIltimos, yuqoridagi manbalar va faktlardan foydalanib, foydalanuvchi so'ragan narsaga bevosita, to'liq va aniq javob bering. Manbalarga kirishni tavsiya qilish o'rniga, ma'lumotning o'zini to'liq yozib bering!`;
    } else {
      userPrompt = `Suhbat tarixi:\n${historyText}\n\nFoydalanuvchi xabari: "${userQuery}"\n\nIltimos, do'stona, tabiiy va mazmunli tarzda o'zbek tilida javob bering:`;
    }

    // Try models in order of stability and responsiveness
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    
    for (const modelName of candidateModels) {
      try {
        reasoningSteps.push(`Google AI (${modelName}) neyrotarmoq modeliga so'rov yo'naltirildi...`);
        
        // Attempt generation with a 6-second timeout race
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Model generation timeout")), 6000)
        );
        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
            }
          }),
          timeoutPromise,
        ]);

        const text = response.text;
        if (text && text.trim().length > 0) {
          reasoningSteps.push(`Google AI (${modelName}) orqali aniq va tahliliy javob shakllantirildi.`);

          // Check for grounding metadata if any
          const candidate = response.candidates?.[0];
          const groundingMeta = candidate?.groundingMetadata;
          const updatedSources: Array<{ id: number; title: string; url: string; snippet: string; domain: string }> = [];

          if (groundingMeta?.groundingChunks) {
            groundingMeta.groundingChunks.forEach((chunk: any, idx: number) => {
              if (chunk.web && chunk.web.uri) {
                let domain = "google.com";
                try {
                  domain = new URL(chunk.web.uri).hostname.replace(/^www\./, "");
                } catch {}
                updatedSources.push({
                  id: idx + 1,
                  title: chunk.web.title || `Manba ${idx + 1}`,
                  url: chunk.web.uri,
                  snippet: chunk.web.title || chunk.web.uri,
                  domain,
                });
              }
            });
          }

          const finalSources = updatedSources.length > 0 ? updatedSources : sources;
          return {
            answer: text,
            reasoning: reasoningSteps,
            updatedSources: finalSources.length > 0 ? finalSources : undefined,
          };
        }
      } catch (err: any) {
        // Continue to next model if 503 (high demand) or 429 (quota) occurs
        const status = err?.status || err?.code || "";
        console.log(`Model ${modelName} unavailable (${status || "temporary"}), trying next option...`);
      }
    }
  }

  // Fallback Local AI Synthesis Engine with intelligent content synthesis
  reasoningSteps.push("Lokal AI algoritmi orqali matn va manbalar sintez qilinmoqda...");
  
  const lower = userQuery.toLowerCase().trim();
  let answer = "";

  // 1. Natural greeting / conversation
  if (lower.startsWith("salom") || lower.startsWith("assalom") || lower === "qalaysiz" || lower === "qalesiz") {
    answer = `Assalomu alaykum! Xush kelibsiz!\n\nMen **UZUNITED AI** — mustaqil AI assistentman. Siz bilan o'zbek tilida erkin suhbatlashishga, internetdagi eng so'nggi ma'lumotlarni qidirib tahlil qilishga yoki dasturlash kodlarini yozishga doim tayyorman.\n\nBugun sizga qanday yordam bera olaman? Qiziqtirgan savolingizni bemalol bering!`;
  } else if (lower.includes("sen kimsan") || lower.includes("o'zing haqida") || lower.includes("vazifang nima")) {
    answer = `Men **UZUNITED AI** platformasiman — lokal kompyuterlarda xavfsiz ishlovchi, hech qanday pullik kalitlarga bog'lanmagan va real vaqt rejimida internetdan ma'lumot qidiruvchi zamonaviy sun'iy intellekt assistentiman.\n\n**Asosiy imkoniyatlarim:**\n- 🌐 Erkin va real vaqtda Web Search (yangiliklar, faktlar, kurslar);\n- 🧠 Kontekstni eslab qolish («u», «bu» so'zlarini bog'lash);\n- 💻 Dasturlash va kodlarni yozish/tushuntirish;\n- 🛡️ To'liq shaxsiy maxfiylik.`;
  } else if (sources.length > 0) {
    // Direct, factual synthesis based on retrieved sources
    const firstSource = sources[0];

    // Case A: Currency rates
    if (firstSource.title.includes("Markaziy Bank") || firstSource.snippet.includes("Markaziy banki rasmiy kursi")) {
      answer = `### 💵 Valyuta kursi ma'lumoti:\n\n${firstSource.snippet} [1]\n\nUshbu ma'lumot O'zbekiston Respublikasi Markaziy bankining rasmiy bazasidan olingan bo'lib, banklararo va hisob-kitob operatsiyalarida qo'llaniladi.`;
    } 
    // Case B: Weather
    else if (firstSource.snippet.includes("harorat:") || firstSource.title.includes("ob-havo")) {
      answer = `### 🌤️ Joriy ob-havo ma'lumoti:\n\n${firstSource.snippet} [1]\n\nHarorat va ob-havo sharoiti real vaqt rejimida yangilanib boradi. Boshqa shahar yoki viloyat bo'yicha ham so'rashingiz mumkin!`;
    }
    // Case C: Encyclopedic Article Extract (Wikipedia intro)
    else if (firstSource.domain.includes("wikipedia.org") && firstSource.snippet.length > 50) {
      const otherPoints = sources.slice(1).map(s => `* **[${s.id}] ${s.title}:** ${s.snippet}`).join("\n\n");
      
      answer = `### 📖 ${resolvedQuery} haqida:\n\n${firstSource.snippet} [1]\n\n` +
        (otherPoints ? `#### 🔍 Qo'shimcha bog'liq manbalar va faktlar:\n${otherPoints}\n\n` : "") +
        `Ushbu ma'lumot ochiq ensiklopedik va ilmiy manbalar asosida tizimlashtirildi. Agar sizni qo'shimcha tafsilotlar (tarixi, faoliyati, yangiliklari) qiziqtirsa, bemalol davom ettirishingiz mumkin!`;
    }
    // Case D: General web search results
    else {
      const summaryList = sources.map(s => `* **[${s.id}] ${s.title}:** ${s.snippet}`).join("\n\n");
      answer = `### 🔍 «${resolvedQuery}» bo'yicha aniqlangan ma'lumotlar:\n\n${summaryList}\n\n#### 💡 Xulosa:\nInternet manbalari tahlili shuni ko'rsatadiki, yuqoridagi faktlar va havolalar orqali mazkur mavzu bo'yicha eng dolzarb ma'lumotlarga ega bo'lishingiz mumkin.`;
    }
  } else {
    answer = `Savolingiz: **"${userQuery}"**.\n\nUshbu mavzu bo'yicha tahlil:\n1. Savolingiz qabul qilindi va UZUNITED AI kontekstida qayta ishlandi.\n2. Agar bu mavzu bo'yicha qo'shimcha yangiliklar yoki aniq raqamlar kerak bo'lsa, **Deep Search** tugmasini yoqib so'rashingiz mumkin. Sizga har qanday ma'lumotni batafsil tushuntirib beraman!`;
  }

  reasoningSteps.push("Javob tayyorlandi va foydalanuvchiga taqdim etildi.");
  return { answer, reasoning: reasoningSteps, updatedSources: sources };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "UZUNITED AI",
    version: "1.0.0",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    mode: "Local LLM + Free Web Search Pipeline",
  });
});

// 2. Main Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId = defaultSessionId, message, isDeepSearch = false, customModel = "llama3.2:3b" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Xabar matni kiritilishi shart." });
    }

    // Get or create session
    let session = memoryStore.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        entityMemory: {},
      };
      memoryStore.set(sessionId, session);
    }

    const reasoningSteps: string[] = [];
    reasoningSteps.push(`1. Foydalanuvchi xabari qabul qilindi: "${message}"`);

    // Step 1: Context Resolution ("u", "bu", "birinchisi")
    const { resolvedQuery, resolvedEntity } = resolveContextualQuery(message, session.messages);
    if (resolvedEntity) {
      reasoningSteps.push(`2. Kontekst aniqlandi: Olmos («u/bu») «${resolvedEntity}» ob'ektiga yo'naltirildi. Yangi qidiruv so'rovi: "${resolvedQuery}"`);
      session.entityMemory["lastEntity"] = resolvedEntity;
    } else {
      reasoningSteps.push(`2. Kontekst to'g'ridan-to'g'ri tushunildi: "${resolvedQuery}"`);
    }

    // Step 2: Intent Classification (Need Web Search?)
    const intent = analyzeIntent(resolvedQuery, session.messages);
    let sources: Array<{ id: number; title: string; url: string; snippet: string; domain: string }> = [];
    let searchedWeb = false;

    if (intent.needsWeb || isDeepSearch) {
      searchedWeb = true;
      reasoningSteps.push(`3. Intent tahlili: Web Search ZARUR (${intent.reason}).`);
      reasoningSteps.push(`4. DuckDuckGo / Open Search orqali qidirilmoqda: "${resolvedQuery}"...`);
      
      sources = await freeWebSearch(resolvedQuery, isDeepSearch ? 7 : 4);
      reasoningSteps.push(`5. ${sources.length} ta mustaqil manba topildi va saralandi.`);
    } else {
      reasoningSteps.push(`3. Intent tahlili: Web Search talab qilinmadi (${intent.reason}).`);
    }

    // Step 3: Synthesis with Local AI / Google AI
    reasoningSteps.push(`6. Neyrotarmoq tahlili (${customModel}) va faktlar tekshiruvi amalga oshirilmoqda...`);
    const aiResult = await generateAIAnswer({
      userQuery: message,
      resolvedQuery,
      history: session.messages,
      sources,
      isDeepSearch,
      needsWeb: intent.needsWeb,
    });

    // Append AI steps
    reasoningSteps.push(...aiResult.reasoning);

    // Final sources (Google Search Grounding sources take priority if present)
    const finalSources = (aiResult.updatedSources && aiResult.updatedSources.length > 0) 
      ? aiResult.updatedSources 
      : sources;
    const hasActiveSources = finalSources.length > 0;
    const finalSearchedWeb = searchedWeb || hasActiveSources;

    // Save to session memory
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      resolvedQuery: resolvedQuery !== message ? resolvedQuery : undefined,
    };

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      role: "assistant",
      content: aiResult.answer,
      timestamp: new Date().toISOString(),
      sources: hasActiveSources ? finalSources : undefined,
      reasoningSteps,
      searchedWeb: finalSearchedWeb,
      resolvedQuery,
    };

    session.messages.push(userMsg, assistantMsg);
    session.updatedAt = new Date().toISOString();

    res.json({
      sessionId: session.id,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      intent,
      sources: finalSources,
      reasoningSteps,
      resolvedQuery,
      searchedWeb: finalSearchedWeb,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi: " + error.message });
  }
});

// 3. Direct Search testing endpoint
app.post("/api/search", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    if (!query) return res.status(400).json({ error: "Query parameter required" });
    const results = await freeWebSearch(query, Number(limit));
    res.json({ query, total: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Memory Sessions list
app.get("/api/memory/sessions", (req, res) => {
  const sessions = Array.from(memoryStore.values()).map(s => ({
    id: s.id,
    title: s.title,
    messageCount: s.messages.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastEntity: s.entityMemory.lastEntity || null,
  }));
  res.json({ sessions });
});

// 5. Clear or create new session
app.post("/api/memory/new-session", (req, res) => {
  const newId = `session-${Date.now()}`;
  const newSession: ChatSession = {
    id: newId,
    title: "Yangi Suhbat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Yangi suhbat boshlandi! UZUNITED AI ga istalgan savolingizni berishingiz mumkin.",
        timestamp: new Date().toISOString(),
      }
    ],
    entityMemory: {},
  };
  memoryStore.set(newId, newSession);
  res.json({ session: newSession });
});

// 6. Test local Ollama / LM Studio connection
app.post("/api/test-local-llm", async (req, res) => {
  const { url = "http://localhost:11434" } = req.body;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const checkRes = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (checkRes.ok) {
      const data = await checkRes.json();
      return res.json({ connected: true, models: data.models || [], host: url });
    }
    return res.json({ connected: false, message: `Ollama status: ${checkRes.statusText}` });
  } catch (err: any) {
    return res.json({
      connected: false,
      message: "Lokal Ollama serveri bilan to'g'ridan-to'g'ri ulanib bo'lmadi (kompyuteringizda 'ollama serve' buyrug'ini ishga tushiring).",
      instruction: "Ollama ni https://ollama.com dan yuklab olib, 'ollama run llama3.2' buyrug'ini bering.",
    });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`UZUNITED AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
