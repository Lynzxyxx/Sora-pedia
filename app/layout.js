import './globals.css';

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🚀%3C/text%3E%3C/svg%3E";

export const metadata = {
  title: 'Sora Pedia - Social Media Marketing Panel Indonesia',
  description:
    'Sora Pedia: SMM Panel Indonesia dengan layanan followers, likes, views, dan subscribe untuk Instagram, TikTok, YouTube, dan lainnya.',
  icons: { icon: FAVICON }
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
