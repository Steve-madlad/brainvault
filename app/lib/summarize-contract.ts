export const SUMMARIZE_ERROR_CODES = {
  SUCCESS: 0,
  INVALID_JSON: 1001,
  INVALID_URL: 1002,
  URL_UNAVAILABLE: 2001,
  NOT_AN_ARTICLE: 2002,
  PAGE_TOO_LARGE: 2003,
  ACCESS_BLOCKED: 2004,
  AI_RATE_LIMITED: 3001,
  AI_UNAVAILABLE: 3002,
  AI_INVALID_RESPONSE: 3003,
  INTERNAL_ERROR: 5000,
} as const;

export type SummarySection = {
  heading: string;
  body: string;
};

export type SummaryContent = {
  overview: string;
  sections: SummarySection[];
  conclusion: string;
};

type SuccessResponse = {
  success: true;
  error_code: typeof SUMMARIZE_ERROR_CODES.SUCCESS;
  message: string;
  content: SummaryContent;
};

type ErrorCode = Exclude<
  (typeof SUMMARIZE_ERROR_CODES)[keyof typeof SUMMARIZE_ERROR_CODES],
  typeof SUMMARIZE_ERROR_CODES.SUCCESS
>;

type FailureResponse = {
  success: false;
  error_code: ErrorCode;
  message: string;
  content: null;
};

export type SummarizeApiResponse = SuccessResponse | FailureResponse;
