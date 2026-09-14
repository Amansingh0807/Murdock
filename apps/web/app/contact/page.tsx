import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="shell legal-page">
      <Link href="/" className="brand">
        Mur<i>d</i>ock
      </Link>
      <article className="legal-card">
        <div className="eyebrow">Contact</div>
        <h1>Talk to the Murdock team.</h1>
        <p>
          For product feedback, privacy requests, or security reports, email:
        </p>
        <p className="contact-email">amansingh0807@outlook.com</p>
        <p>
          For a security vulnerability, include a clear reproduction path and
          avoid sharing personal document contents in the report.
        </p>
        <p>
          <Link href="/">← Back to Murdock</Link>
        </p>
      </article>
    </main>
  );
}
