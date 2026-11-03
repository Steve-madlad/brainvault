import Hero from "./components/Home"
import Search from "./components/Search";

export default function Home() {
  return (
    <main>
      <div className="main">
        <div className="gradient"></div>
      </div>
      <div className="app">
        <Hero/>
        <Search />
      </div>
    </main>
  );
}
