export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-20 relative overflow-hidden">

      {/* Ambient Glow */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-yellow-500/10 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-500/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="mb-20">

          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-6 py-3 text-yellow-500 text-sm font-semibold mb-8">
            ASKPAULFX LEGAL AGREEMENT
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-8">
            Terms & <span className="text-yellow-500">Conditions</span>
          </h1>

          <p className="text-zinc-400 text-xl leading-relaxed max-w-4xl">
            These Terms & Conditions govern your access to and use of
            ASKPAULFX investment management services, platform tools,
            investor dashboard, financial systems, and all related
            digital infrastructure operated by ASKPAULFX.
          </p>

        </div>

        {/* MAIN CONTAINER */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-[40px] p-10 md:p-14 backdrop-blur-xl shadow-2xl">

          <div className="space-y-16 text-zinc-300 leading-relaxed text-lg">

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                1. Agreement & Acceptance
              </h2>

              <p>
                By registering for an ASKPAULFX account, accessing the
                investor dashboard, depositing funds, or interacting
                with any ASKPAULFX service, you acknowledge that you
                have read, understood, and agreed to be legally bound
                by these Terms & Conditions.
              </p>

              <p className="mt-5">
                If you do not agree with any part of these terms, you
                must immediately discontinue use of the platform and
                refrain from creating or maintaining an account.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                2. Investment Risk Disclosure
              </h2>

              <p>
                Investment activities involve financial risk and market
                uncertainty. ASKPAULFX does not guarantee fixed,
                risk-free, or guaranteed profits under any
                circumstances.
              </p>

              <p className="mt-5">
                Portfolio performance may fluctuate due to:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Market volatility</li>
                <li>Liquidity conditions</li>
                <li>Economic events</li>
                <li>Political developments</li>
                <li>Trading conditions</li>
                <li>Unexpected financial disruptions</li>
              </ul>

              <p className="mt-5">
                Users acknowledge that past performance does not
                guarantee future outcomes and that all investment
                decisions carry inherent financial risk.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                3. No Financial Guarantees
              </h2>

              <p>
                Any displayed portfolio targets, projected growth,
                historical returns, estimated yields, simulated charts,
                visual illustrations, or investment projections are
                strictly informational and should not be interpreted as
                financial guarantees or promises of future performance.
              </p>

              <p className="mt-5">
                ASKPAULFX reserves the right to modify investment
                structures, portfolio strategies, or target allocation
                models without prior notice where necessary.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                4. Account Eligibility
              </h2>

              <p>
                Users must provide accurate, complete, and truthful
                information during registration and throughout their
                use of the platform.
              </p>

              <p className="mt-5">
                ASKPAULFX reserves the right to reject, suspend, or
                terminate accounts that:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Provide false information</li>
                <li>Use fraudulent payment methods</li>
                <li>Violate platform policies</li>
                <li>Engage in suspicious activity</li>
                <li>Attempt unauthorized system access</li>
                <li>Abuse platform infrastructure</li>
              </ul>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                5. Deposits & Funding
              </h2>

              <p>
                Deposits submitted through ASKPAULFX may undergo
                internal review, blockchain confirmation checks,
                compliance screening, and administrative verification
                before being approved into investor balances.
              </p>

              <p className="mt-5">
                ASKPAULFX reserves the right to reject or delay deposit
                approvals where suspicious, incomplete, or unverifiable
                transaction activity is detected.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                6. Withdrawals & Processing
              </h2>

              <p>
                Withdrawal requests are subject to:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Administrative review</li>
                <li>Balance verification</li>
                <li>Security screening</li>
                <li>Fraud prevention procedures</li>
                <li>Network processing timelines</li>
              </ul>

              <p className="mt-5">
                Processing durations may vary depending on transaction
                volume, operational conditions, compliance checks, and
                blockchain confirmation times.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                7. Security Responsibilities
              </h2>

              <p>
                Users are solely responsible for maintaining the
                confidentiality and security of their:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Passwords</li>
                <li>Authentication credentials</li>
                <li>Email access</li>
                <li>Device security</li>
                <li>Wallet access information</li>
              </ul>

              <p className="mt-5">
                ASKPAULFX shall not be held liable for unauthorized
                account access resulting from user negligence, phishing
                attacks, compromised devices, or credential sharing.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                8. Fraud Prevention & Compliance
              </h2>

              <p>
                ASKPAULFX maintains the right to investigate any
                activity suspected of:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Money laundering</li>
                <li>Identity fraud</li>
                <li>Unauthorized payment activity</li>
                <li>System abuse</li>
                <li>Multiple-account manipulation</li>
                <li>Unauthorized access attempts</li>
              </ul>

              <p className="mt-5">
                Accounts under investigation may be temporarily
                suspended while security reviews are conducted.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                9. Platform Availability
              </h2>

              <p>
                ASKPAULFX strives to maintain continuous operational
                availability but does not guarantee uninterrupted
                platform access due to:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>System maintenance</li>
                <li>Infrastructure upgrades</li>
                <li>Third-party outages</li>
                <li>Cybersecurity incidents</li>
                <li>Unexpected technical disruptions</li>
              </ul>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                10. Limitation of Liability
              </h2>

              <p>
                ASKPAULFX shall not be liable for direct, indirect,
                incidental, or consequential financial losses arising
                from:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Market volatility</li>
                <li>Trading losses</li>
                <li>Service interruptions</li>
                <li>Third-party failures</li>
                <li>User investment decisions</li>
                <li>External payment networks</li>
              </ul>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                11. Privacy & Data Handling
              </h2>

              <p>
                ASKPAULFX may collect operational information necessary
                for:
              </p>

              <ul className="mt-5 space-y-3 list-disc pl-8">
                <li>Account management</li>
                <li>Security verification</li>
                <li>Fraud prevention</li>
                <li>Platform analytics</li>
                <li>Customer support</li>
              </ul>

              <p className="mt-5">
                By using the platform, users consent to the processing
                and storage of operational account data in accordance
                with applicable infrastructure and security practices.
              </p>
            </section>

            {/* SECTION */}
            <section>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">
                12. Policy Updates
              </h2>

              <p>
                ASKPAULFX reserves the right to modify, revise, or
                update these Terms & Conditions at any time without
                prior notice.
              </p>

              <p className="mt-5">
                Continued use of the platform following updates
                constitutes acceptance of revised terms.
              </p>
            </section>

          </div>

        </div>

        {/* FOOTER */}
        <div className="mt-16 text-center border-t border-zinc-800 pt-10">

          <p className="text-zinc-500 text-sm">
            © 2026 ASKPAULFX Investment Management. All Rights Reserved.
          </p>

        </div>

      </div>

    </main>
  );
}