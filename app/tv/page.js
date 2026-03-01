import Link from "next/link";
import Tv from "../Tv";

export default function TvPage() {
  return (
    <div className="tv-page">
      <nav className="view-switcher">
        <Link href="/">Galaxy</Link>
        <Link href="/tv" className="active">TV</Link>
      </nav>
      <Tv />
    </div>
  );
}
