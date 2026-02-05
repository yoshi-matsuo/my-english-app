"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [sentence, setSentence] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [hint, setHint] = useState<string>("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => {
        setTimer(timer - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timer]);

  const fetchHint = async () => {
    if (!sentence || hintLoading) return;

    setHintLoading(true);
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence }),
      });
      const data = await response.json();

      if (data.error) {
        setHint(data.error);
      } else {
        setHint(data.hint);
      }
      setShowHint(true);
    } catch {
      setHint("ヒントの取得に失敗しました");
      setShowHint(true);
    } finally {
      setHintLoading(false);
    }
  };

  const fetchNews = async () => {
    setLoading(true);
    setError("");
    setSentence("");
    setHint("");
    setShowHint(false);

    try {
      const response = await fetch("/api/news");
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSentence(data.sentence);
        setTimer(25);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-8">
      <main className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#173757] mb-2">
            NEW天風録
          </h1>
          <p className="text-slate-500 text-lg">瞬間英作文トレーニング</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          {/* Hint Button */}
          {sentence && (
            <div className="mb-4">
              <button
                onClick={fetchHint}
                disabled={hintLoading}
                className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200 text-[#173757] text-lg font-bold rounded-xl transition-colors duration-200 flex items-center gap-2 shadow-md"
              >
                {hintLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#173757] border-t-transparent rounded-full animate-spin"></div>
                    ヒント
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    ヒント
                  </>
                )}
              </button>
            </div>
          )}

          {/* Hint Display */}
          {showHint && hint && (
            <div className="mb-6 p-5 bg-yellow-50 rounded-xl border-2 border-yellow-300">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[#173757] font-bold text-lg">ヒント</span>
                <button
                  onClick={() => setShowHint(false)}
                  className="text-yellow-500 hover:text-yellow-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-[#173757] text-lg leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {hint.split("\n").map((line, index) => (
                  <div key={index} className={line.startsWith("【") ? "col-span-1 md:col-span-2 font-bold mt-2 first:mt-0" : ""}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentence Display Area */}
          <div className="min-h-32 flex items-center justify-center mb-8 p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-slate-500">ニュースを取得中...</span>
              </div>
            ) : error ? (
              <p className="text-red-500 text-center">{error}</p>
            ) : sentence ? (
              <p className="text-2xl text-slate-800 font-medium text-center leading-relaxed">
                {sentence}
              </p>
            ) : (
              <p className="text-slate-400 text-center">
                「Go」ボタンを押すと
                <br />
                ニュースから英作文の問題が表示されます
              </p>
            )}
          </div>

          {/* Timer */}
          {sentence && timer > 0 && (
            <div className="flex justify-center mb-6">
              <div className={`text-4xl font-bold ${timer <= 5 ? 'text-red-500' : 'text-[#173757]'}`}>
                {timer}
              </div>
            </div>
          )}
          {sentence && timer === 0 && (
            <div className="flex justify-center mb-6">
              <div className="text-2xl font-bold text-slate-400">
                Time up!
              </div>
            </div>
          )}

          {/* Go Button */}
          <button
            onClick={fetchNews}
            disabled={loading}
            className="w-full py-4 px-8 bg-[#173757] hover:bg-[#1e4a6f] disabled:bg-[#7a9bb8] text-white text-xl font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            {loading ? "読み込み中..." : "Go"}
          </button>
        </div>

        {/* Instructions */}
        <div className="text-center text-slate-500 text-sm">
          <p>表示された日本語を英語に訳してみましょう</p>
          <p className="mt-1">最新のニュースから出題されます</p>
        </div>
      </main>

    </div>
  );
}
