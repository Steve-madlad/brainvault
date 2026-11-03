"use client";

import { Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  SummarizeApiResponse,
  SummaryContent,
} from "@/app/lib/summarize-contract";
import { SUMMARIZE_ERROR_CODES } from "@/app/lib/summarize-contract";

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

  // Migrate URL-only storage entries created before summaries used sections.
  if (
    typeof content.overview === "string" &&
    Array.isArray(content.key_points) &&
    content.key_points.every((point) => typeof point === "string") &&
    typeof content.conclusions === "string"
  ) {
    const keyPoints = content.key_points as string[];
    return {
      overview: content.overview,
      sections: keyPoints.length
        ? [{ heading: "Key points", body: keyPoints.join("\n") }]
        : [],
      conclusion: content.conclusions,
    };
  }

  return null;
}

function isSavedSummary(value: unknown): value is SavedSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return summary.success === true && summary.error_code === 0 && typeof summary.message === "string";
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

export default function Search() {
  const [webURL, setWebURL] = useState("");
  const [result, setResult] = useState<SummarizeApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const recentSearchesRef = useRef<RecentSearch[]>([]);
  const summaryRef = useRef<HTMLElement | null>(null);

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
      // Ignore invalid or unavailable local storage.
    }
  }, []);

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
      // Keep the in-memory history available if storage is unavailable.
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submittedURL = webURL.trim();
    setIsLoading(true);
    setLoadingMessage(null);
    setResult(null);
    rememberSearch(submittedURL);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: encodeURI(submittedURL) }),
      });
      const data = (await response.json()) as SummarizeApiResponse;

      if (!response.ok && data.success) {
        throw new Error("The server returned an unexpected response.");
      }

      setResult(data);
      saveSummary(submittedURL, data);
    } catch (error) {
      console.error("Failed to summarize URL:", error);
      setResult({
        success: false,
        error_code: 5000,
        message:
          "Unable to reach the summarizer. Check your connection and try again.",
        content: null,
      });
    } finally {
      setIsLoading(false);
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
                    setWebURL(entry.url);
                    setResult(entry.summary);
                  }}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {entry.url}
                  {entry.summary && (
                    <span className="ml-2 text-xs text-green-700">
                      Summary saved
                    </span>
                  )}
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
