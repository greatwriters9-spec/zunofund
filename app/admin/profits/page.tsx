"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";
import {
  TrendingUp,
  ArrowLeft,
  DollarSign,
  User,
} from "lucide-react";

interface Investor {
  id: string;
  email: string;
  full_name: string;
  user_id: string | null;
}

interface Profit {
  id: string;
  investor_email: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function AdminProfitsPage() {
  const supabase = useSupabase();

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [profits, setProfits] = useState<Profit[]>([]);

  const [selectedInvestor, setSelectedInvestor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchInvestors();
    fetchProfits();
  }, []);

  async function fetchInvestors() {
    const { data } = await supabase
      .from("investors")
      .select("id, email, full_name, user_id")
      .order("created_at", { ascending: false });

    setInvestors(data || []);
  }

  async function fetchProfits() {
    const { data } = await supabase
      .from("profits")
      .select("*")
      .order("created_at", { ascending: false });

    setProfits(data || []);
  }

  async function handleAddProfit(e: React.FormEvent) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const profitAmount = Number(amount);

    if (!selectedInvestor) {
      setErrorMessage("Please select an investor.");
      return;
    }

    if (!profitAmount || profitAmount <= 0) {
      setErrorMessage("Please enter a valid profit amount.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Please enter a profit description.");
      return;
    }

    setLoading(true);

    const selected = investors.find(
      (investor) => investor.email === selectedInvestor
    );

    const { error } = await supabase.from("profits").insert([
      {
        investor_email: selectedInvestor,
        user_id: selected?.user_id ?? null,
        amount: profitAmount,
        description,
        status: "completed",
      },
    ]);

    setLoading(false);

    if (error) {
      setErrorMessage(formatSupabaseError(error));
      return;
    }

    setSuccessMessage("Profit added successfully.");

    setAmount("");
    setDescription("");
    setSelectedInvestor("");

    fetchProfits();
  }

  return (
    <div className="min-h-screen text-white p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-5xl font-bold text-yellow-500 mb-2">
            Profit Management
          </h1>

          <p className="text-gray-400 text-lg">
            Add and manage investor profits.
          </p>
        </div>

        <Link
          href="/admin"
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 transition px-5 py-3 rounded-2xl"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Profit Form */}
        <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-3xl p-8 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="text-yellow-500" size={28} />

            <h2 className="text-2xl font-bold">
              Add Profit
            </h2>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mb-5 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-2xl">
              {errorMessage}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="mb-5 bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-2xl">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleAddProfit} className="space-y-5">
            {/* Investor */}
            <div>
              <label className="block mb-2 text-gray-400">
                Select Investor
              </label>

              <select
                value={selectedInvestor}
                onChange={(e) => setSelectedInvestor(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-2xl px-4 py-3 outline-none focus:border-yellow-500"
              >
                <option value="">Choose Investor</option>

                {investors.map((investor) => (
                  <option
                    key={investor.id}
                    value={investor.email}
                  >
                    {investor.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block mb-2 text-gray-400">
                Profit Amount
              </label>

              <div className="relative">
                <DollarSign
                  className="absolute left-4 top-3.5 text-gray-500"
                  size={18}
                />

                <input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-2xl pl-10 pr-4 py-3 outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block mb-2 text-gray-400">
                Description
              </label>

              <textarea
                placeholder="Example: Gold trade profit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-black border border-zinc-700 rounded-2xl px-4 py-3 outline-none focus:border-yellow-500 resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold py-4 rounded-2xl disabled:opacity-50"
            >
              {loading ? "Adding Profit..." : "Add Profit"}
            </button>
          </form>
        </div>

        {/* Profit History */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-2xl font-bold text-white">
              Recent Profit History
            </h2>

            <p className="text-gray-400 mt-1">
              Latest investor profit distributions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="text-left px-6 py-5 text-gray-400 font-medium">
                    Investor
                  </th>

                  <th className="text-left px-6 py-5 text-gray-400 font-medium">
                    Amount
                  </th>

                  <th className="text-left px-6 py-5 text-gray-400 font-medium">
                    Description
                  </th>

                  <th className="text-left px-6 py-5 text-gray-400 font-medium">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {profits.map((profit) => (
                  <tr
                    key={profit.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900 transition"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="bg-yellow-500/10 p-3 rounded-xl">
                          <User
                            className="text-yellow-500"
                            size={18}
                          />
                        </div>

                        <div>
                          <p className="font-medium text-white">
                            {profit.investor_email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-green-500 font-bold">
                      +${Number(profit.amount).toFixed(2)}
                    </td>

                    <td className="px-6 py-5 text-gray-300">
                      {profit.description}
                    </td>

                    <td className="px-6 py-5 text-gray-500">
                      {new Date(
                        profit.created_at
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {profits.length === 0 && (
              <div className="p-10 text-center text-gray-500">
                No profits added yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}