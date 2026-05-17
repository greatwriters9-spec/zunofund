"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Headset,
  Mail,
  Phone,
  MessageCircle,
  Send,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react"

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">

      {/* TOP BAR */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">

        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-2xl bg-black text-yellow-500 flex items-center justify-center font-black text-lg">
              Z
            </div>

            <div>
              <h1 className="font-bold text-lg">
                ZUNO
              </h1>

              <p className="text-sm text-zinc-500">
                Investor Support
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-zinc-300 hover:bg-zinc-100 transition"
          >
            <ArrowLeft size={18} />
            Back Home
          </Link>

        </div>
      </header>

      {/* HERO */}
      <section className="relative py-24 px-6 lg:px-10 overflow-hidden">

        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">

          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-sm mb-8">
              <ShieldCheck size={16} />
              24/7 Investor Assistance
            </div>

            <h1 className="text-5xl lg:text-7xl font-black leading-tight tracking-tight max-w-3xl">

              We Are Here
              <br />

              To Help You
              <span className="text-yellow-500"> 24/7</span>

            </h1>

            <p className="text-zinc-600 text-lg leading-relaxed max-w-2xl mt-8">
              Our support specialists are available to assist with
              account guidance, investment questions, deposit assistance,
              withdrawal concerns, and platform navigation anytime you need help.
            </p>

            {/* CONTACT METHODS */}
            <div className="space-y-5 mt-12">

              <div className="flex items-center gap-5 p-5 rounded-3xl border border-zinc-200 bg-white shadow-sm">

                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                  <Mail className="text-yellow-600 w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm text-zinc-500">
                    Email Support
                  </p>

                  <h3 className="font-bold text-lg">
                    support@zuno.com
                  </h3>
                </div>

              </div>

              <div className="flex items-center gap-5 p-5 rounded-3xl border border-zinc-200 bg-white shadow-sm">

                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                  <Phone className="text-yellow-600 w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm text-zinc-500">
                    Direct Phone Line
                  </p>

                  <h3 className="font-bold text-lg">
                    +254 700 000 000
                  </h3>
                </div>

              </div>

              <div className="flex items-center gap-5 p-5 rounded-3xl border border-zinc-200 bg-white shadow-sm">

                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                  <Send className="text-yellow-600 w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm text-zinc-500">
                    Telegram Support
                  </p>

                  <h3 className="font-bold text-lg">
                    @ZUNO_SUPPORT
                  </h3>
                </div>

              </div>

              <div className="flex items-center gap-5 p-5 rounded-3xl border border-zinc-200 bg-white shadow-sm">

                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                  <MessageCircle className="text-yellow-600 w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm text-zinc-500">
                    WhatsApp Assistance
                  </p>

                  <h3 className="font-bold text-lg">
                    +254 700 000 000
                  </h3>
                </div>

              </div>

            </div>

          </motion.div>

          {/* RIGHT SIDE IMAGE CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="relative"
          >

            <div className="relative rounded-[40px] overflow-hidden border border-zinc-200 bg-gradient-to-br from-black to-zinc-900 p-10 min-h-[650px] flex flex-col justify-between shadow-2xl">

              <div>

                <div className="w-20 h-20 rounded-3xl bg-yellow-500 flex items-center justify-center">
                  <Headset className="text-black w-10 h-10" />
                </div>

                <h2 className="text-white text-4xl font-black mt-10 leading-tight">
                  Premium
                  <br />
                  Investor Support
                </h2>

                <p className="text-zinc-400 mt-6 leading-relaxed text-lg">
                  Fast response times, secure communication,
                  and dedicated investor assistance designed
                  for a premium investment experience.
                </p>

              </div>

              <div className="space-y-5">

                <div className="rounded-3xl bg-white p-5">

                  <p className="text-zinc-500 text-sm mb-2">
                    Average Response Time
                  </p>

                  <h3 className="text-4xl font-black">
                    Under 5 Minutes
                  </h3>

                </div>

                <div className="rounded-3xl border border-zinc-700 p-5">

                  <p className="text-zinc-500 text-sm mb-2">
                    Support Availability
                  </p>

                  <h3 className="text-white text-3xl font-bold">
                    24 Hours / 7 Days
                  </h3>

                </div>

              </div>

            </div>

          </motion.div>

        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 lg:px-10 bg-zinc-50 border-t border-zinc-200">

        <div className="max-w-5xl mx-auto">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black mb-6">
              Frequently Asked Questions
            </h2>

            <p className="text-zinc-600 text-lg">
              Quick answers to common investor questions.
            </p>

          </div>

          <div className="space-y-6">

            <div className="bg-white rounded-3xl p-8 border border-zinc-200">
              <h3 className="font-bold text-xl mb-4">
                How long do withdrawals take?
              </h3>

              <p className="text-zinc-600 leading-relaxed">
                Withdrawal processing times depend on verification
                and blockchain confirmation speed. Most requests are
                processed within a short timeframe after approval.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-zinc-200">
              <h3 className="font-bold text-xl mb-4">
                Is investor support available every day?
              </h3>

              <p className="text-zinc-600 leading-relaxed">
                Yes. Our support team operates 24/7 to ensure
                continuous assistance for investors worldwide.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-zinc-200">
              <h3 className="font-bold text-xl mb-4">
                How do I begin investing?
              </h3>

              <p className="text-zinc-600 leading-relaxed">
                Create an account, choose your preferred investment
                plan, and proceed with your deposit request through
                the secure investor dashboard.
              </p>
            </div>

          </div>

        </div>
      </section>

    </div>
  )
}