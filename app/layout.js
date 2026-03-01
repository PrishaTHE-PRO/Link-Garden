import './globals.css';
import { Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'Link Garden',
  description: 'Grow your personal link collection',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={fraunces.className}>{children}</body>
    </html>
  );
}
