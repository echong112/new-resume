import "./globals.css";

export const metadata = {
  title: "Enrique Chong",
  description: "Resume & Portfolio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link
          href="https://fonts.googleapis.com/css?family=PT+Sans:400,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
