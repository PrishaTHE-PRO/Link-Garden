import './globals.css';

export const metadata = {
  title: 'Link Garden',
  description: 'Grow your personal link collection',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
