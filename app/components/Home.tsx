export default function Home() {
  return (
    <header className="w-full col-full-center">
      <nav className="w-full align-center gap-3 my-3">
        <img src="/logo.svg?v=2" alt="summarizer_pro_logo" className="size-8" />
        <p className="font-bold text-xl">
          Brain<b className="text-[#f85c00]">vault</b>
        </p>
      </nav>

      <h1 className="head_text">
        Summarize Articles With
        <br className="max-md:hidden" />
        <span className="orange_gradient">Gemini-Flash</span>
      </h1>
      <h2 className="desc">
        Simplify your reading with Brainvault, an open-source article
        summarizer that transforms lengthy articles into clear and concise
        summaries Demo
      </h2>
    </header>
  );
}
