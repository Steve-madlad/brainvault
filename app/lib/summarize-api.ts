import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { SummarizeApiResponse } from "@/app/lib/summarize-contract";

export const summarizeApi = createApi({
  reducerPath: "summarizeApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/" }),
  endpoints: (build) => ({
    summarize: build.mutation<SummarizeApiResponse, { url: string }>({
      query: ({ url }) => ({
        url: "summarize",
        method: "POST",
        body: { url },
      }),
    }),
  }),
});

export const { useSummarizeMutation } = summarizeApi;
