const PLANTS = [
  '/plant1.png',
  '/plant2.png',
  '/plant3.png',
  '/plant4.png',
  '/plant5.png',
];

export default function PixelPlant({ variant = 0, size = 1 }) {
  const src    = PLANTS[variant % PLANTS.length];
  const width  = Math.round(80 * size);
  const height = Math.round(80 * size);

  return (
    <img
      src={src}
      width={width}
      height={height}
      alt="plant"
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}
