import Link from "next/link";
import Galaxy from "./Galaxy";

export default function Home() {
  return (
    <div className="galaxy-page">
      <nav className="view-switcher">
        <Link href="/" className="active">Galaxy</Link>
        <Link href="/tv">TV</Link>
      </nav>
      <Galaxy />
    </div>
  );
}
