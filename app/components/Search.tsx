"use client";

import { Ear, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  SummarizeApiResponse,
  SummaryContent,
} from "@/app/lib/summarize-contract";
import { SUMMARIZE_ERROR_CODES } from "@/app/lib/summarize-contract";
import { useSummarizeMutation } from "@/app/lib/summarize-api";

const RECENT_SEARCHES_KEY = "summarizer-pro:recent-searches";
const MAX_RECENT_SEARCHES = 5;
const LOADING_MESSAGES = [
  "Opening the page...",
  "Reading the page content...",
  "Organizing the main points...",
  "Preparing your summary...",
];

type SavedSummary = Extract<SummarizeApiResponse, { success: true }>;

type RecentSearch = {
  url: string;
  summary: SavedSummary | null;
};

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function parseSummaryContent(value: unknown): SummaryContent | null {
  if (typeof value !== "object" || value === null) return null;
  const content = value as Record<string, unknown>;

  if (
    typeof content.overview === "string" &&
    Array.isArray(content.sections) &&
    content.sections.every(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        typeof (section as Record<string, unknown>).heading === "string" &&
        typeof (section as Record<string, unknown>).body === "string",
    ) &&
    typeof content.conclusion === "string"
  ) {
    return {
      overview: content.overview,
      sections: content.sections as SummaryContent["sections"],
      conclusion: content.conclusion,
    };
  }

  return null;
}

function isSavedSummary(value: unknown): value is SavedSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return summary.success === true && summary.error_code === 0 && typeof summary.message === "string";
}

function isApiFailure(
  value: unknown,
): value is Extract<SummarizeApiResponse, { success: false }> {
  if (typeof value !== "object" || value === null) return false;
  const error = value as Record<string, unknown>;
  return (
    error.success === false &&
    typeof error.error_code === "number" &&
    typeof error.message === "string" &&
    error.content === null
  );
}

function parseRecentSearch(value: unknown): RecentSearch | null {
  if (typeof value === "string" && isHttpUrl(value)) {
    return { url: new URL(value).href, summary: null };
  }

  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (!isHttpUrl(entry.url)) return null;
  const summaryValue = entry.summary;
  const summaryContent =
    typeof summaryValue === "object" && summaryValue !== null
      ? parseSummaryContent((summaryValue as Record<string, unknown>).content)
      : null;

  return {
    url: new URL(entry.url).href,
    summary:
      isSavedSummary(summaryValue) && summaryContent
        ? { ...summaryValue, content: summaryContent }
        : null,
  };
}

function buildSpeechText(summary: SavedSummary): string {
  const sections = summary.content.sections.map(
    (section) => `${section.heading}. ${section.body}`,
  );
  return [
    "Overview.",
    summary.content.overview,
    ...sections,
    summary.content.conclusion
      ? `Conclusion. ${summary.content.conclusion}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function splitSpeechText(text: string, maxLength = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const segments: { text: string; start: number }[] = [];
  let segment = "";
  let segmentStart = 0;
  let position = 0;

  for (const word of normalized.split(" ")) {
    if (segment && segment.length + word.length + 1 > maxLength) {
      segments.push({ text: segment, start: segmentStart });
      segment = "";
    }
    if (!segment) segmentStart = position;
    segment += `${segment ? " " : ""}${word}`;
    position += word.length + 1;
  }

  if (segment) segments.push({ text: segment, start: segmentStart });
  return { text: normalized, segments };
}

export default function Search() {
  const [webURL, setWebURL] = useState("");
  const [result, setResult] = useState<SummarizeApiResponse | null>(null);
  const [summarize, { isLoading }] = useSummarizeMutation();
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const recentSearchesRef = useRef<RecentSearch[]>([]);
  const summaryRef = useRef<HTMLElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRunRef = useRef(0);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
      );

      if (!Array.isArray(stored)) return;

      const restored: RecentSearch[] = [];
      for (const value of stored) {
        const entry = parseRecentSearch(value);
        if (entry && !restored.some((saved) => saved.url === entry.url)) {
          restored.push(entry);
        }
        if (restored.length === MAX_RECENT_SEARCHES) break;
      }

      recentSearchesRef.current = restored;
      setRecentSearches(restored);
    } catch {
    }
  }, []);

  useEffect(() => {
    setCanSpeak("speechSynthesis" in window);
    return () => {
      speechRunRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    speechRunRef.current += 1;
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setSpeechProgress(0);
  }, [result]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingMessage(null);
      return;
    }

    let messageIndex = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const revealTimeout = setTimeout(() => {
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
      intervalId = setInterval(() => {
        messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[messageIndex]);
      }, 3500);
    }, 5000);

    return () => {
      clearTimeout(revealTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading]);

  useEffect(() => {
    if (!result?.success) return;

    const animationFrame = requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [result]);

  const persistRecentSearches = (entries: RecentSearch[]) => {
    const limitedEntries = entries.slice(0, MAX_RECENT_SEARCHES);
    recentSearchesRef.current = limitedEntries;
    setRecentSearches(limitedEntries);

    try {
      localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(limitedEntries),
      );
    } catch {
    }
  };

  const deleteRecentSearch = (url: string) => {
    persistRecentSearches(
      recentSearchesRef.current.filter((entry) => entry.url !== url),
    );
  };

  const rememberSearch = (url: string) => {
    if (!isHttpUrl(url)) return;
    const normalizedUrl = new URL(url).href;
    const existing = recentSearchesRef.current.find(
      (entry) => entry.url === normalizedUrl,
    );
    const updatedSearches = [
      { url: normalizedUrl, summary: existing?.summary ?? null },
      ...recentSearchesRef.current.filter(
        (entry) => entry.url !== normalizedUrl,
      ),
    ];

    persistRecentSearches(updatedSearches);
  };

  const saveSummary = (url: string, response: SummarizeApiResponse) => {
    if (!isHttpUrl(url)) return;
    const normalizedUrl = new URL(url).href;

    if (
      !response.success &&
      response.error_code === SUMMARIZE_ERROR_CODES.ACCESS_BLOCKED
    ) {
      deleteRecentSearch(normalizedUrl);
      return;
    }

    const existing = recentSearchesRef.current.find(
      (entry) => entry.url === normalizedUrl,
    );
    const updatedSearches = [
      {
        url: normalizedUrl,
        summary: response.success ? response : existing?.summary ?? null,
      },
      ...recentSearchesRef.current.filter(
        (entry) => entry.url !== normalizedUrl,
      ),
    ];

    persistRecentSearches(updatedSearches);
  };

  const startSpeech = () => {
    if (!result?.success || !canSpeak) return;

    window.speechSynthesis.cancel();
    const { text, segments } = splitSpeechText(buildSpeechText(result));
    const runId = ++speechRunRef.current;
    setSpeechProgress(0);
    setIsSpeaking(true);
    setIsSpeechPaused(false);

    const speakSegment = (index: number) => {
      if (speechRunRef.current !== runId) return;
      const segment = segments[index];
      if (!segment) {
        setSpeechProgress(100);
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        utteranceRef.current = null;
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.onboundary = (event) => {
        if (
          speechRunRef.current === runId &&
          (event.name === "word" || event.name === "sentence")
        ) {
          setSpeechProgress(
            Math.min(
              99,
              Math.round(((segment.start + event.charIndex) / text.length) * 100),
            ),
          );
        }
      };
      utterance.onend = () => {
        if (speechRunRef.current === runId) speakSegment(index + 1);
      };
      utterance.onerror = () => {
        if (speechRunRef.current !== runId) return;
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    speakSegment(0);
  };

  const pauseSpeech = () => {
    window.speechSynthesis.pause();
    setIsSpeechPaused(true);
  };

  const resumeSpeech = () => {
    window.speechSynthesis.resume();
    setIsSpeechPaused(false);
  };

  const stopSpeech = () => {
    speechRunRef.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setSpeechProgress(0);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submittedURL = webURL.trim();
    stopSpeech();
    setLoadingMessage(null);
    setResult(null);
    rememberSearch(submittedURL);

    try {
      const data = await summarize({ url: submittedURL }).unwrap();
      setResult(data);
      saveSummary(submittedURL, data);
    } catch (error) {
      console.error("Failed to summarize URL:", error);
      const apiError =
        typeof error === "object" && error !== null && "data" in error
          ? (error as { data?: unknown }).data
          : null;
      if (isApiFailure(apiError)) {
        setResult(apiError);
        saveSummary(submittedURL, apiError);
        return;
      }
      setResult({
        success: false,
        error_code: 5000,
        message:
          "Unable to reach the summarizer. Check your connection and try again.",
        content: null,
      });
    } finally {
      setLoadingMessage(null);
    }
  };

  return (
    <section className="mt-16 w-full max-w-xl">
      <div className="col w-full gap-2">
        <form className="relative flex-center" onSubmit={handleSubmit}>
          <img
            src="/link.svg"
            alt="link_icon"
            className="absolute left-0 my-2 ml-3 w-5"
          />
          <input
            type="url"
            name="url"
            value={webURL}
            placeholder="Enter a URL"
            className="url_input peer"
            onChange={(e) => setWebURL(e.target.value)}
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="submit_btn border-none cursor peer-focus:text-gray-700! peer-hover:text-gray-700! disabled:cursor-wait disabled:opacity-60"
            aria-label="Summarize page"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {recentSearches.length > 0 && (
        <section aria-label="Recent pages" className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-600">
            Recent pages
          </h2>
          <ul className="flex flex-col gap-1">
            {recentSearches.map((entry) => (
              <li key={entry.url} className="flex items-center gap-1">
                <button
                  type="button"
                  title={entry.url}
                  disabled={isLoading}
                  onClick={() => {
                    stopSpeech();
                    setWebURL(entry.url);
                    setResult(entry.summary);
                  }}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {entry.url}
                </button>
                <button
                  type="button"
                  title="Delete recent page and saved summary"
                  aria-label={`Delete history for ${entry.url}`}
                  onClick={() => deleteRecentSearch(entry.url)}
                  className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div aria-live="polite" className="mt-8 mb-10 w-full">
        {isLoading && (
          <div role="status" className="flex-center col min-h-20 gap-2">
            <img src="/loader.svg" alt="Summarizing page" className="size-12" />
            <p className="min-h-5 text-center text-sm text-gray-600">
              {loadingMessage}
            </p>
          </div>
        )}

        {result && (
          <article
            ref={summaryRef}
            role={result.success ? "status" : "alert"}
            className="scroll-mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p
              className={`font-semibold ${
                result.success ? "text-gray-900" : "text-red-700"
              }`}
            >
              {result.message}
            </p>

            {result.success && (
              <div className="mt-5 space-y-4 text-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  {!isSpeaking ? (
                    <button
                      type="button"
                      onClick={startSpeech}
                      disabled={!canSpeak}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Listen to summary"
                    >
                      <Ear size={16} aria-hidden="true" />
                      Listen
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={isSpeechPaused ? resumeSpeech : pauseSpeech}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        aria-label={isSpeechPaused ? "Resume speech" : "Pause speech"}
                      >
                        {isSpeechPaused ? (
                          <Play size={16} aria-hidden="true" />
                        ) : (
                          <Pause size={16} aria-hidden="true" />
                        )}
                        {isSpeechPaused ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={stopSpeech}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        aria-label="Stop speech"
                      >
                        <Square size={14} aria-hidden="true" />
                        Stop
                      </button>
                    </>
                  )}
                  {(isSpeaking || speechProgress > 0) && (
                    <div className="flex min-w-40 flex-1 items-center gap-2">
                      <div
                        role="progressbar"
                        aria-label="Speech progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={speechProgress}
                        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
                      >
                        <div
                          className="h-full rounded-full bg-linear-to-r from-amber-500 via-orange-600 to-yellow-500 transition-[width] duration-200"
                          style={{ width: `${speechProgress}%` }}
                        />
                      </div>
                      <span className="min-w-10 text-right text-xs text-gray-500">
                        {speechProgress}%
                      </span>
                    </div>
                  )}
                  {!canSpeak && (
                    <span className="text-xs text-gray-500">
                      Speech playback is unavailable in this browser.
                    </span>
                  )}
                </div>

                <section>
                  <h2 className="font-bold text-gray-900">Overview</h2>
                  <p className="mt-1 whitespace-pre-line">
                    {result.content.overview}
                  </p>
                </section>

                {result.content.sections.map((section, index) => (
                  <section key={`${index}-${section.heading}`}>
                    <h2 className="font-bold text-gray-900">
                      {section.heading}
                    </h2>
                    <p className="mt-1 whitespace-pre-line">{section.body}</p>
                  </section>
                ))}

                <section>
                  <h2 className="font-bold text-gray-900">Conclusion</h2>
                  <p className="mt-1 whitespace-pre-line">
                    {result.content.conclusion}
                  </p>
                </section>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
