import { NextResponse } from "next/server";

interface DeepLResponse {
  translations: {
    detected_source_language: string;
    text: string;
  }[];
}

// 除外する一般的な単語（冠詞、前置詞、be動詞など）
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
  "because", "until", "while", "although", "though", "that", "which",
  "who", "whom", "this", "these", "those", "it", "its", "i", "you", "he",
  "she", "we", "they", "me", "him", "her", "us", "them", "my", "your",
  "his", "our", "their", "what", "am", "also", "about", "up", "out",
  "over", "down", "off", "any", "both", "either", "neither", "many",
  "much", "s", "t", "d", "ll", "ve", "re", "m"
]);

// 除外する固有名詞（会社名、ブランド名など）
const PROPER_NOUNS = new Set([
  "google", "apple", "amazon", "microsoft", "meta", "facebook", "twitter",
  "instagram", "youtube", "netflix", "spotify", "uber", "airbnb", "tesla",
  "sony", "nintendo", "toyota", "honda", "nissan", "mazda", "subaru",
  "panasonic", "sharp", "toshiba", "hitachi", "fujitsu", "nec", "canon",
  "nikon", "olympus", "yamaha", "kawasaki", "suzuki", "mitsubishi",
  "softbank", "docomo", "kddi", "rakuten", "line", "mercari", "zozo",
  "uniqlo", "muji", "daiso", "lawson", "familymart", "seven", "eleven",
  "starbucks", "mcdonalds", "disney", "pixar", "marvel", "dc", "warner",
  "universal", "paramount", "fox", "hbo", "bbc", "cnn", "nhk",
  "samsung", "lg", "huawei", "xiaomi", "oppo", "vivo", "oneplus",
  "intel", "amd", "nvidia", "qualcomm", "arm", "ibm", "oracle", "sap",
  "salesforce", "adobe", "zoom", "slack", "dropbox", "github", "gitlab",
  "openai", "anthropic", "deepmind", "chatgpt", "gpt", "claude",
  "iphone", "ipad", "mac", "macbook", "imac", "airpods", "apple watch",
  "android", "windows", "linux", "ios", "macos", "chrome", "safari", "firefox",
  "japan", "tokyo", "osaka", "kyoto", "america", "usa", "china", "korea",
  "europe", "asia", "africa"
]);

// 日本語のカタカナを抽出
function extractKatakana(text: string): string[] {
  const katakanaRegex = /[\u30A0-\u30FF]+/g;
  const matches = text.match(katakanaRegex) || [];
  return matches.filter(k => k.length >= 2);
}

// カタカナを英語に変換するためのDeepL API呼び出し
async function translateKatakana(katakanaWords: string[], apiKey: string): Promise<Set<string>> {
  if (katakanaWords.length === 0) return new Set();

  try {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: katakanaWords,
        source_lang: "JA",
        target_lang: "EN",
      }),
    });

    if (!response.ok) return new Set();

    const data: DeepLResponse = await response.json();
    const translations = data.translations.map(t =>
      t.text.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, "").trim()
    );

    // 翻訳結果の各単語を除外リストに追加
    const excludeWords = new Set<string>();
    for (const translation of translations) {
      const words = translation.split(/\s+/);
      for (const word of words) {
        if (word.length > 1) {
          excludeWords.add(word);
        }
      }
    }
    return excludeWords;
  } catch {
    return new Set();
  }
}

// 英文からキーワードを抽出
function extractKeywords(text: string, excludeKatakana: Set<string>): string[] {
  // 単語に分割（句読点を除去）
  const words = text
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]/g, " ")
    .split(/\s+/)
    .filter(word => {
      if (word.length <= 2) return false;
      if (STOP_WORDS.has(word)) return false;
      if (PROPER_NOUNS.has(word)) return false;
      if (excludeKatakana.has(word)) return false;
      // 数字のみの単語を除外
      if (/^\d+$/.test(word)) return false;
      return true;
    });

  // 重複を除去
  const uniqueWords = [...new Set(words)];

  // 最大5個のキーワードを返す
  return uniqueWords.slice(0, 5);
}

// 文法パターンを検出
function detectGrammarPatterns(text: string): string[] {
  const patterns: string[] = [];
  const lowerText = text.toLowerCase();

  if (lowerText.includes("will ") || lowerText.includes("'ll ")) {
    patterns.push("will + 動詞原形（未来形）");
  }
  if (lowerText.includes("have been") || lowerText.includes("has been")) {
    patterns.push("have/has been + 過去分詞（現在完了受動態）");
  }
  if (lowerText.includes("have ") || lowerText.includes("has ")) {
    if (!lowerText.includes("have to") && !lowerText.includes("has to")) {
      patterns.push("have/has + 過去分詞（現在完了形）");
    }
  }
  if (lowerText.includes("have to") || lowerText.includes("has to")) {
    patterns.push("have to + 動詞原形（〜しなければならない）");
  }
  if (lowerText.includes("was ") || lowerText.includes("were ")) {
    if (lowerText.includes("was ") && /was \w+ed/.test(lowerText)) {
      patterns.push("was/were + 過去分詞（過去受動態）");
    }
  }
  if (lowerText.includes("is ") || lowerText.includes("are ")) {
    if (/(?:is|are) \w+ed/.test(lowerText) || /(?:is|are) being/.test(lowerText)) {
      patterns.push("is/are + 過去分詞（現在受動態）");
    }
  }
  if (lowerText.includes("going to ")) {
    patterns.push("be going to + 動詞原形（〜する予定）");
  }
  if (lowerText.includes("would ")) {
    patterns.push("would + 動詞原形（〜だろう/仮定法）");
  }
  if (lowerText.includes("could ")) {
    patterns.push("could + 動詞原形（〜できた/可能性）");
  }
  if (lowerText.includes("should ")) {
    patterns.push("should + 動詞原形（〜すべき）");
  }
  if (lowerText.includes("must ")) {
    patterns.push("must + 動詞原形（〜しなければならない）");
  }
  if (lowerText.includes("may ") || lowerText.includes("might ")) {
    patterns.push("may/might + 動詞原形（〜かもしれない）");
  }
  if (/\w+ing/.test(lowerText) && (lowerText.includes("is ") || lowerText.includes("are ") || lowerText.includes("was ") || lowerText.includes("were "))) {
    patterns.push("be + 動詞ing（進行形）");
  }
  if (lowerText.includes(" that ") && /(?:said|reported|announced|believed|thought|known) that/.test(lowerText)) {
    patterns.push("that節（〜ということ）");
  }
  if (lowerText.includes(" to ") && /\w+ to \w+/.test(lowerText)) {
    patterns.push("to不定詞");
  }

  return patterns.slice(0, 2);
}

export async function POST(request: Request) {
  try {
    const { sentence } = await request.json();

    if (!sentence) {
      return NextResponse.json(
        { error: "文が指定されていません" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // 日本語文からカタカナを抽出
    const katakanaWords = extractKatakana(sentence);

    // カタカナ語を英語に翻訳して除外リストを作成
    const excludeKatakana = await translateKatakana(katakanaWords, apiKey);

    // DeepL API (Free版) - 全文翻訳
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [sentence],
        source_lang: "JA",
        target_lang: "EN",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepL API error:", response.status, errorText);
      return NextResponse.json(
        { error: "ヒントの取得に失敗しました" },
        { status: 500 }
      );
    }

    const data: DeepLResponse = await response.json();
    const translation = data.translations[0]?.text;

    if (!translation) {
      return NextResponse.json(
        { error: "翻訳結果を取得できませんでした" },
        { status: 500 }
      );
    }

    // キーワードと文法パターンを抽出
    const keywords = extractKeywords(translation, excludeKatakana);
    const grammarPatterns = detectGrammarPatterns(translation);

    // ヒントを構築
    let hint = "";

    if (keywords.length > 0) {
      hint += "【使える単語・熟語】\n";
      hint += keywords.map(word => `• ${word}`).join("\n");
    }

    if (grammarPatterns.length > 0) {
      if (hint) hint += "\n\n";
      hint += "【文法表現】\n";
      hint += grammarPatterns.map(pattern => `• ${pattern}`).join("\n");
    }

    if (!hint) {
      hint = "この文は基本的な単語で構成されています。";
    }

    return NextResponse.json({ hint });
  } catch (error) {
    console.error("Hint API error:", error);
    return NextResponse.json(
      { error: "ヒントの取得に失敗しました" },
      { status: 500 }
    );
  }
}
