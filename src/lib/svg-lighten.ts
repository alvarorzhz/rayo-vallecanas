/**
 * Satori pone a cada imagen un recorte y además una máscara que es un simple rectángulo blanco del
 * tamaño de la imagen: no quita nada. Pero cada máscara obliga a sharp a dibujar una capa aparte del
 * tamaño del póster (40 en la convocatoria). Quitarlas da el mismo dibujo, píxel a píxel, en un
 * tercio del tiempo (4.18.3). Solo se quita una máscara si es un rectángulo blanco que cubre la imagen
 * entera (con menos de un píxel de margen); las demás se dejan como están.
 */

type Box = { x: number; y: number; w: number; h: number };

const num = (tag: string, attr: string) => {
  const m = tag.match(new RegExp(`\\s${attr}="(-?[\\d.]+(?:e-?\\d+)?)"`));
  return m ? Number(m[1]) : null;
};

const boxOf = (tag: string): Box | null => {
  const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => num(tag, a));
  return x === null || y === null || w === null || h === null ? null : { x, y, w, h };
};

export function lighten(svg: string): string {
  const masks = new Map<string, Box>();
  for (const m of svg.matchAll(/<mask id="(satori_om-[^"]+)">(<rect [^>]*fill="#fff"\/>)<\/mask>/g)) {
    const box = boxOf(m[2]);
    if (box) masks.set(m[1], box);
  }
  // Satori redondea la máscara a píxeles enteros: lo que se queda fuera es menos de un píxel, y el recorte sigue
  const E = 1;
  return svg.replace(/<image [^>]*\/>/g, (tag) => {
    const id = tag.match(/ mask="url\(#(satori_om-[^)]+)\)"/)?.[1];
    const mask = id ? masks.get(id) : undefined;
    const img = mask && boxOf(tag);
    if (!mask || !img) return tag;
    const covers = mask.x <= img.x + E && mask.y <= img.y + E && mask.x + mask.w >= img.x + img.w - E && mask.y + mask.h >= img.y + img.h - E;
    return covers ? tag.replace(/ mask="url\(#[^)]+\)"/, "") : tag;
  });
}
