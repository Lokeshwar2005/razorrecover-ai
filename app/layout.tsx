import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import '../src/styles.css'
import '../src/experience.css'
import '../src/components/decision-execution.css'
import '../src/components/recovery-playbooks.css'

export const metadata: Metadata = {
  title: 'RazorRecover AI 2.0 — Autonomous Revenue Recovery Platform',
  description: 'Deterministic Bounded Autonomy for Revenue Recovery · Razorpay AI Buildathon 2026 Track 3',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <Script src="./decision-theater.js" strategy="lazyOnload" />
        <Script src="./nav-journey.js" strategy="lazyOnload" />
        {children}
      </body>
    </html>
  )
}
