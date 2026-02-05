import { NextResponse } from "next/server";
import Parser from "rss-parser";

interface SentenceData {
  sentence: string;
  source: string;
  category: string;
  publishedAt: string;
}

// RSSフィードのソース一覧（各ジャンル）
const RSS_FEEDS = [
  // テクノロジー
  { url: "https://gigazine.net/news/rss_2.0/", source: "GIGAZINE", category: "tech" },
  { url: "https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml", source: "ITmedia", category: "tech" },

  // カルチャー・エンタメ
  { url: "https://natalie.mu/music/feed/news", source: "音楽ナタリー", category: "culture" },
  { url: "https://natalie.mu/eiga/feed/news", source: "映画ナタリー", category: "culture" },
  { url: "https://www.cinra.net/feed/reader", source: "CINRA", category: "culture" },

  // 飲食・グルメ
  { url: "https://www.gnavi.co.jp/dressing/feed/", source: "dressing", category: "food" },
  { url: "https://macaro-ni.jp/feed", source: "macaroni", category: "food" },

  // ファッション
  { url: "https://www.wwdjapan.com/feed", source: "WWD JAPAN", category: "fashion" },
  { url: "https://www.fashionsnap.com/feed/", source: "FASHIONSNAP", category: "fashion" },

  // 世界・国際
  { url: "https://www.bbc.com/japanese/index.xml", source: "BBC Japan", category: "world" },
  { url: "https://www.cnn.co.jp/rss/index.rdf", source: "CNN Japan", category: "world" },
];

// NewsAPI設定
interface NewsArticle {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

// 文を抽出する共通関数
function extractSentences(
  text: string,
  source: string,
  category: string,
  publishedAt: string
): SentenceData[] {
  const sentences: SentenceData[] = [];

  // 「。」で文を分割
  const parts = text.split("。").filter((s) => s.trim());

  for (const s of parts) {
    const trimmed = s.trim() + "。";
    // 60文字以内、10文字以上、「…」や「[」を含まない完結した文のみ
    if (
      trimmed.length <= 60 &&
      trimmed.length >= 10 &&
      !trimmed.includes("…") &&
      !trimmed.includes("[") &&
      !trimmed.includes("【")
    ) {
      sentences.push({ sentence: trimmed, source, category, publishedAt });
    }
  }

  return sentences;
}

// RSSフィードから文を取得
async function fetchFromRSS(): Promise<SentenceData[]> {
  const parser = new Parser();
  const allSentences: SentenceData[] = [];

  const feedPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const result = await parser.parseURL(feed.url);
      const sentences: SentenceData[] = [];

      for (const item of result.items.slice(0, 10)) {
        const text = item.contentSnippet || item.content || item.summary || "";
        const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
        sentences.push(...extractSentences(text, feed.source, feed.category, pubDate));
      }

      return sentences;
    } catch (error) {
      console.error(`RSS fetch error for ${feed.source}:`, error);
      return [];
    }
  });

  const results = await Promise.all(feedPromises);
  for (const sentences of results) {
    allSentences.push(...sentences);
  }

  return allSentences;
}

// NewsAPIから文を取得
async function fetchFromNewsAPI(apiKey: string): Promise<SentenceData[]> {
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?domains=nhk.or.jp,asahi.com,mainichi.jp,yomiuri.co.jp&pageSize=50&apiKey=${apiKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) return [];

    const data: NewsAPIResponse = await response.json();
    if (data.status !== "ok" || !data.articles.length) return [];

    const sentences: SentenceData[] = [];
    for (const article of data.articles) {
      if (!article.description) continue;
      sentences.push(
        ...extractSentences(
          article.description,
          article.source.name,
          "news",
          article.publishedAt
        )
      );
    }

    return sentences;
  } catch (error) {
    console.error("NewsAPI error:", error);
    return [];
  }
}

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;

    // 並列で全ソースから取得
    const [rssSentences, newsSentences] = await Promise.all([
      fetchFromRSS(),
      apiKey && apiKey !== "your_newsapi_key_here"
        ? fetchFromNewsAPI(apiKey)
        : Promise.resolve([]),
    ]);

    const allSentences = [...rssSentences, ...newsSentences];

    if (!allSentences.length) {
      return NextResponse.json(
        { error: "No suitable sentences found" },
        { status: 500 }
      );
    }

    // ランダムに1文を選択
    const randomIndex = Math.floor(Math.random() * allSentences.length);
    const selected = allSentences[randomIndex];

    return NextResponse.json({
      sentence: selected.sentence,
      source: selected.source,
      category: selected.category,
      publishedAt: selected.publishedAt,
    });
  } catch (error) {
    console.error("Error fetching sentences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentences" },
      { status: 500 }
    );
  }
}
