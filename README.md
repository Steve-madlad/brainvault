# Brainvault

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.4.4-black?logo=next.js&logoColor=white" alt="Next.js 16.4.4" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.3.0-087ea4?logo=react&logoColor=white" alt="React 19.3.0" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-3178c6?logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4.0-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" /></a>
  <a href="https://redux-toolkit.js.org/rtk-query/overview"><img src="https://img.shields.io/badge/Redux_Toolkit-2.14.0-764abc?logo=redux&logoColor=white" alt="Redux Toolkit 2.14.0" /></a>
  <a href="https://ai.google.dev/gemini-api/docs"><img src="https://img.shields.io/badge/Google_Gen_AI-2.32.0-4285f4?logo=googlegemini&logoColor=white" alt="Google Gen AI 2.32.0" /></a>
  <a href="https://zod.dev/"><img src="https://img.shields.io/badge/Zod-4.6.7-3e67b1?logo=zod&logoColor=white" alt="Zod 4.6.7" /></a>
</p>

Brainvault turns a public web page into a structured summary with an overview, topical sections, and a conclusion. Summaries can be read on the page or played aloud using the browser's speech synthesis. The app is built with Next.js and uses Google's Gemini API to retrieve and summarize page content.

## Features

- Summarize a page by entering its HTTP or HTTPS URL.
- Present the result as an overview, subject sections, and a conclusion.
- Keep up to five recent URLs and their summaries in browser local storage.
- Listen to summaries with browser speech synthesis, with pause, resume, stop, and progress controls.
- Return clear errors for invalid URLs, inaccessible or blocked pages, oversized pages, and provider failures.

Recent pages and saved summaries are stored in the current browser only. Clearing browser storage removes them.

## Requirements

- [Bun](https://bun.sh/) (the package manager declared by this project)
- A Google Gemini API key with access to the configured Gemini models and URL Context

## Run locally

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create `.env.local` in the project root and add your API key:

   ```dotenv
   GEMINI_API_KEY=your_api_key
   ```

   Keep the key on the server. Do not prefix it with `NEXT_PUBLIC_` or commit it to source control.

3. Start the development server:

   ```bash
   bun dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

Other package managers can run the scripts in `package.json`, but Bun is the project's declared package manager and `bun.lock` is the lockfile.

## Available commands

| Command | Description |
| --- | --- |
| `bun dev` | Start the local development server. |
| `bun run build` | Create a production build. |
| `bun start` | Serve the production build. |
| `bun run lint` | Run ESLint. |

## Summarization API

The browser submits URLs to `POST /api/summarize` with a JSON body:

```json
{ "url": "https://example.com/article" }
```

A successful response has this shape:

```json
{
  "success": true,
  "error_code": 0,
  "message": "Summary generated successfully.",
  "content": {
    "overview": "...",
    "sections": [{ "heading": "...", "body": "..." }],
    "conclusion": "..."
  }
}
```

Failures use `success: false`, a numeric `error_code`, a user-readable `message`, and `content: null`. The route validates the request, asks Gemini to retrieve the supplied URL, validates the model response, and tries configured fallback models for transient errors or unusable responses. Pages that require sign-in or otherwise block automated access may not be summarizable.

## Project structure

```text
app/
  api/summarize/route.ts       Server-side URL validation and Gemini summarization
  components/Home.tsx          Landing page heading and introduction
  components/Search.tsx        URL form, result display, history, and audio controls
  components/Providers.tsx     Client-side Redux provider
  lib/summarize-api.ts         RTK Query mutation for the API route
  lib/summarize-contract.ts    Shared response types and error codes
  lib/store.ts                Redux store setup
  globals.css                  Tailwind theme and application styles
  layout.tsx                   Root layout, fonts, and site metadata
  page.tsx                     Home page composition
public/                        Logo, icons, loader, and other static assets
```

## Deployment

Deploy as a Next.js application on a compatible host. Configure `GEMINI_API_KEY` as a server-side environment variable in the deployment environment before building or serving the app. See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for hosting options.
