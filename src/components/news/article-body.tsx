import { inline, parseBody } from "@/lib/news";

function Inline({ text }: { text: string }) {
  return <>{inline(text).map((x, i) => (x.bold ? <strong key={i}>{x.text}</strong> : <span key={i}>{x.text}</span>))}</>;
}

/** El texto de la noticia con su formato (párrafos, ladillos, citas, preguntas y fotos). */
export function ArticleBody({ body, drop = true }: { body: string; drop?: boolean }) {
  const blocks = parseBody(body);
  return (
    <div className={`article-text news-body ${drop ? "drop" : ""}`}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": return <h2 key={i}><Inline text={b.text} /></h2>;
          case "quote": return <blockquote key={i}><Inline text={b.text} /></blockquote>;
          case "q": return <p key={i} className="qa-q"><Inline text={b.text} /></p>;
          case "a": return <p key={i} className="qa-a"><Inline text={b.text} /></p>;
          case "img":
            return (
              <figure key={i}>
                <div className="news-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.url} alt={b.text || "Foto de la noticia"} loading="lazy" className="block h-auto w-full" />
                </div>
                {b.text && <figcaption className="news-caption mt-1.5">{b.text}</figcaption>}
              </figure>
            );
          default: return <p key={i}><Inline text={b.text} /></p>;
        }
      })}
    </div>
  );
}
