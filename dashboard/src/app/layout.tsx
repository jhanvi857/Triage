import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triage - Payment Failure & Revenue Recovery Dispatch Board",
  description: "Autonomous payment failure root-cause diagnosis, bounded interventions, stopping rules, and immutable revenue recovery ledger.",
  keywords: ["Triage", "Revenue Recovery", "Payment Failures", "Razorpay", "Smart Retries", "Interventions", "Dispatch Board"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F5F6F6] text-[#202525] antialiased selection:bg-[#087F83]/15 selection:text-[#087F83]">
        {children}
      </body>
    </html>
  );
}
